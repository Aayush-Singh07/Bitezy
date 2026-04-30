-- BITEZY MASTER LOGISTICS ENGINE (V8.0 - THE CTO UPGRADE)
-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR

-- 1. UTILITY: CALCULATE DYNAMIC ETA (v8.0)
-- Accounts for Rider -> Bakery (if not picked up) + Bakery -> User
CREATE OR REPLACE FUNCTION get_load_balanced_eta_mins_v8(
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
    v_total_nearby_riders integer;
    v_travel_to_res_mins float8 := 0;
    v_travel_to_user_mins float8 := 0;
    v_prep_mins float8;
    v_rider_wait_mins float8 := 0;
    v_total_mins integer;
BEGIN
    -- 1. Get Restaurant Details
    SELECT lat, long, current_load INTO v_res_lat, v_res_long, v_current_load 
    FROM restaurants WHERE id = p_res_id;
    
    -- 2. Stage-Based Distance Logic
    IF p_order_status IN ('PLACED', 'ACCEPTED', 'READY') THEN
        -- RIDER IS MOVING TO BAKERY
        IF p_rider_id IS NOT NULL THEN
            SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = p_rider_id;
            v_travel_to_res_mins = calculate_distance(v_rider_lat, v_rider_long, v_res_lat, v_res_long) * 3.0;
        END IF;
        
        -- Prep time (2m base + 1m/3 orders)
        v_prep_mins = 2.0 + (v_current_load / 3.0);
        
        -- Delivery time (Bakery -> User)
        v_travel_to_user_mins = calculate_distance(v_res_lat, v_res_long, p_user_lat, p_user_long) * 3.0;
        
        -- Wait penalty (if no rider assigned yet)
        IF p_rider_id IS NULL THEN
            SELECT count(*) INTO v_available_nearby_riders FROM riders 
            WHERE status = 'AVAILABLE' AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5;
            
            IF v_available_nearby_riders = 0 THEN v_rider_wait_mins = 5.0; END IF;
        END IF;

        v_total_mins = ceil(v_travel_to_res_mins + greatest(v_prep_mins, v_travel_to_res_mins) + v_travel_to_user_mins + 3.0);
    
    ELSIF p_order_status = 'ON_THE_WAY' THEN
        -- RIDER IS MOVING TO USER
        SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = p_rider_id;
        v_travel_to_user_mins = calculate_distance(v_rider_lat, v_rider_long, p_user_lat, p_user_long) * 3.0;
        
        v_total_mins = ceil(v_travel_to_user_mins + 3.0);
    
    ELSE
        v_total_mins = 0;
    END IF;

    RETURN v_total_mins;
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER: LOAD RELEASE & RIDER RELEASE (v8.0)
CREATE OR REPLACE FUNCTION tr_fn_finalize_order_v8()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act on completion or cancellation
    IF (NEW.status = 'DELIVERED' OR NEW.status = 'CANCELLED') AND OLD.status NOT IN ('DELIVERED', 'CANCELLED') THEN
        -- 1. Decrement Kitchen Load
        UPDATE restaurants SET current_load = GREATEST(0, current_load - 1) 
        WHERE id = NEW.restaurant_id;
        
        -- 2. Release Rider to AVAILABLE
        -- (Wait: Only release if they don't have another order queued)
        IF NOT EXISTS (SELECT 1 FROM orders WHERE rider_id = NEW.rider_id AND status NOT IN ('DELIVERED', 'CANCELLED')) THEN
            UPDATE riders SET status = 'AVAILABLE' WHERE id = NEW.rider_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_finalize_order ON orders;
CREATE TRIGGER tr_finalize_order 
AFTER UPDATE OF status ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_finalize_order_v8();

-- 3. TRIGGER: PRECISION MOVEMENT SYNC (v8.0)
CREATE OR REPLACE FUNCTION tr_fn_recalc_eta_on_movement_v8()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
    v_user_lat float8; v_user_long float8;
    v_eta_mins integer;
BEGIN
    -- 1. Find the active order for this rider
    FOR v_order IN SELECT id, restaurant_id, address_id, status FROM orders 
                   WHERE rider_id = NEW.id AND status NOT IN ('DELIVERED', 'CANCELLED')
    LOOP
        -- 2. Fetch User Location
        SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = v_order.address_id;
        
        -- 3. Use v8.0 Formula
        v_eta_mins = get_load_balanced_eta_mins_v8(v_order.restaurant_id, v_user_lat, v_user_long, NEW.id, v_order.status);
        
        UPDATE orders SET estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval 
        WHERE id = v_order.id;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_rider_movement_eta ON riders;
CREATE TRIGGER tr_rider_movement_eta 
AFTER UPDATE OF lat, long ON riders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_recalc_eta_on_movement_v8();

-- 4. UPDATE SENTINEL TO USE v8.0
CREATE OR REPLACE FUNCTION sentinel_preflight_check(p_res_id UUID, p_user_lat float8, p_user_long float8, p_items jsonb)
RETURNS json AS $$
DECLARE
    v_eta integer;
    v_is_open boolean;
    v_nearby_rider_count integer;
BEGIN
    SELECT is_open INTO v_is_open FROM restaurants WHERE id = p_res_id;
    IF NOT v_is_open THEN RETURN json_build_object('success', false, 'error', 'BAKERY_CLOSED'); END IF;

    v_nearby_rider_count = fn_count_nearby_riders_v7(p_res_id, 1.5);
    IF v_nearby_rider_count = 0 THEN RETURN json_build_object('success', false, 'error', 'NO_RIDERS_NEARBY'); END IF;

    v_eta = get_load_balanced_eta_mins_v8(p_res_id, p_user_lat, p_user_long);
    IF v_eta > 18 THEN RETURN json_build_object('success', false, 'error', 'BAKERY_OVERLOADED', 'eta', v_eta); END IF;

    RETURN json_build_object('success', true, 'eta', v_eta);
END;
$$ LANGUAGE plpgsql;
