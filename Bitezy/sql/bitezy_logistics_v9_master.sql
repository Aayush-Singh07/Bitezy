-- BITEZY MASTER LOGISTICS ENGINE (V9.0 - THE FINAL STABILIZER)
-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR

-- 1. UTILITY: CALCULATE DYNAMIC ETA (v9.0)
CREATE OR REPLACE FUNCTION get_load_balanced_eta_mins_v9(
    p_res_id UUID, 
    p_user_lat float8, 
    p_user_long float8, 
    p_rider_id UUID DEFAULT NULL, 
    p_order_status TEXT DEFAULT 'PLACED'
)
RETURNS integer AS $$
DECLARE
    v_res_lat float8; v_res_long float8;
    v_rider_lat float8; v_rider_long float8;
    v_current_load integer;
    v_available_nearby_riders integer;
    v_travel_to_res_mins float8 := 0;
    v_travel_to_user_mins float8 := 0;
    v_prep_mins float8;
    v_total_mins integer;
BEGIN
    SELECT lat, long, current_load INTO v_res_lat, v_res_long, v_current_load 
    FROM restaurants WHERE id = p_res_id;
    
    IF p_order_status IN ('PLACED', 'ACCEPTED', 'READY') THEN
        -- RIDER IS MOVING TO BAKERY
        IF p_rider_id IS NOT NULL THEN
            SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = p_rider_id;
            v_travel_to_res_mins = calculate_distance(v_rider_lat, v_rider_long, v_res_lat, v_res_long) * 3.0;
        END IF;
        
        v_prep_mins = 2.0 + (v_current_load / 3.0);
        v_travel_to_user_mins = calculate_distance(v_res_lat, v_res_long, p_user_lat, p_user_long) * 3.0;
        
        -- Logic: We either wait for prep or wait for rider to arrive at bakery
        v_total_mins = ceil(greatest(v_prep_mins, v_travel_to_res_mins) + v_travel_to_user_mins + 3.0);
    
    ELSIF p_order_status = 'ON_THE_WAY' THEN
        -- RIDER IS MOVING TO USER (PURE TRAVEL MODE)
        SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = p_rider_id;
        v_travel_to_user_mins = calculate_distance(v_rider_lat, v_rider_long, p_user_lat, p_user_long) * 3.0;
        v_total_mins = ceil(v_travel_to_user_mins + 2.0); -- 2m final buffer (parking/doorbell)
    
    ELSE
        v_total_mins = 0;
    END IF;

    RETURN v_total_mins;
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER: ATOMIC PLACEMENT & LOAD ENFORCEMENT
CREATE OR REPLACE FUNCTION tr_fn_set_initial_eta_v9()
RETURNS TRIGGER AS $$
DECLARE
    v_eta_mins integer;
    v_user_lat float8; v_user_long float8;
    v_res_lat float8; v_res_long float8;
BEGIN
    SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = NEW.address_id;
    SELECT lat, long INTO v_res_lat, v_res_long FROM restaurants WHERE id = NEW.restaurant_id;

    -- 1. Initial ETA
    v_eta_mins = get_load_balanced_eta_mins_v9(NEW.restaurant_id, v_user_lat, v_user_long);
    NEW.estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval;

    -- 2. Atomic JIT Assignment
    SELECT id INTO NEW.rider_id FROM riders 
    WHERE status IN ('AVAILABLE', 'BUSY') 
    AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5
    ORDER BY (status = 'AVAILABLE') DESC, calculate_distance(lat, long, v_res_lat, v_res_long) ASC 
    LIMIT 1;

    IF NEW.rider_id IS NOT NULL THEN
        UPDATE riders SET status = 'BUSY' WHERE id = NEW.rider_id;
        -- INCREMENT LOAD ON PLACEMENT
        UPDATE restaurants SET current_load = current_load + 1 WHERE id = NEW.restaurant_id;
    ELSE
        RAISE EXCEPTION 'NO_NEARBY_RIDERS_FOR_ASSIGNMENT';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_initial_eta ON orders;
CREATE TRIGGER tr_set_initial_eta 
BEFORE INSERT ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_set_initial_eta_v9();

-- 3. TRIGGER: STATUS CHANGE & EARLY LOAD RELEASE
CREATE OR REPLACE FUNCTION tr_fn_on_status_change_v9()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Timestamp management
    IF NEW.status = 'ACCEPTED' AND OLD.status = 'PLACED' THEN NEW.accepted_at = NOW(); END IF;
    IF NEW.status = 'READY' AND OLD.status = 'ACCEPTED' THEN NEW.prep_completed_at = NOW(); END IF;
    IF NEW.status = 'ON_THE_WAY' AND OLD.status = 'READY' THEN NEW.picked_up_at = NOW(); END IF;

    -- 2. EARLY LOAD RELEASE (Bakery's role ends at pickup)
    IF NEW.status = 'ON_THE_WAY' AND OLD.status != 'ON_THE_WAY' THEN
        UPDATE restaurants SET current_load = GREATEST(0, current_load - 1) 
        WHERE id = NEW.restaurant_id;
    END IF;

    -- 3. RIDER RELEASE (Rider becomes available at door)
    IF (NEW.status = 'DELIVERED' OR NEW.status = 'CANCELLED') AND OLD.status NOT IN ('DELIVERED', 'CANCELLED') THEN
        -- If it was cancelled BEFORE pickup, release load then too
        IF OLD.status != 'ON_THE_WAY' AND OLD.status != 'DELIVERED' THEN
            UPDATE restaurants SET current_load = GREATEST(0, current_load - 1) 
            WHERE id = NEW.restaurant_id;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM orders WHERE rider_id = NEW.rider_id AND status NOT IN ('DELIVERED', 'CANCELLED') AND id != NEW.id) THEN
            UPDATE riders SET status = 'AVAILABLE' WHERE id = NEW.rider_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_status_change ON orders;
CREATE TRIGGER tr_status_change 
BEFORE UPDATE OF status ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_on_status_change_v9();

-- 4. TRIGGER: PRECISION TRACKING COUNTDOWN
CREATE OR REPLACE FUNCTION tr_fn_recalc_eta_on_movement_v9()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
    v_user_lat float8; v_user_long float8;
    v_eta_mins integer;
BEGIN
    -- Update all active orders for this rider
    FOR v_order IN SELECT id, restaurant_id, address_id, status FROM orders 
                   WHERE rider_id = NEW.id AND status NOT IN ('DELIVERED', 'CANCELLED')
    LOOP
        SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = v_order.address_id;
        
        -- Formula v9.0
        v_eta_mins = get_load_balanced_eta_mins_v9(v_order.restaurant_id, v_user_lat, v_user_long, NEW.id, v_order.status);
        
        -- UPDATE THE TIMESTAMP IN REAL-TIME
        UPDATE orders SET estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval 
        WHERE id = v_order.id;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_rider_movement_eta ON riders;
CREATE TRIGGER tr_rider_movement_eta 
AFTER UPDATE OF lat, long ON riders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_recalc_eta_on_movement_v9();

-- 5. SENTINEL PRE-FLIGHT (v9.0)
CREATE OR REPLACE FUNCTION sentinel_preflight_check(p_res_id UUID, p_user_lat float8, p_user_long float8, p_items jsonb)
RETURNS json AS $$
DECLARE
    v_eta integer;
    v_is_open boolean;
    v_nearby_rider_count integer;
BEGIN
    SELECT is_open INTO v_is_open FROM restaurants WHERE id = p_res_id;
    IF NOT v_is_open THEN RETURN json_build_object('success', false, 'error', 'BAKERY_CLOSED'); END IF;

    -- Geofence (1.5km)
    SELECT count(*) INTO v_nearby_rider_count FROM riders 
    WHERE status IN ('AVAILABLE', 'BUSY')
    AND calculate_distance(lat, long, (SELECT lat FROM restaurants WHERE id = p_res_id), (SELECT long FROM restaurants WHERE id = p_res_id)) <= 1.5;
    
    IF v_nearby_rider_count = 0 THEN RETURN json_build_object('success', false, 'error', 'NO_RIDERS_NEARBY'); END IF;

    v_eta = get_load_balanced_eta_mins_v9(p_res_id, p_user_lat, p_user_long);
    IF v_eta > 18 THEN RETURN json_build_object('success', false, 'error', 'BAKERY_OVERLOADED', 'eta', v_eta); END IF;

    RETURN json_build_object('success', true, 'eta', v_eta);
END;
$$ LANGUAGE plpgsql;
