-- BITEZY MASTER LOGISTICS ENGINE (V16.0 - THE PRICING FIX)
-- ⚠️ IMPORTANT: RUN THIS SCRIPT TO FIX THE 'TOTAL_AMOUNT IS NULL' ERROR

-- ==========================================
-- 1. PURGE THE PAST (DELETE ALL OLD TRIGGERS)
-- ==========================================
DROP TRIGGER IF EXISTS tr_setup_new_order ON orders;
DROP TRIGGER IF EXISTS tr_update_order_eta ON orders;
DROP TRIGGER IF EXISTS tr_update_order_on_status_change ON orders;
DROP TRIGGER IF EXISTS tr_recalc_eta_on_movement ON riders;
DROP TRIGGER IF EXISTS tr_rider_movement_eta ON riders;
DROP TRIGGER IF EXISTS tr_status_change ON orders;
DROP TRIGGER IF EXISTS tr_set_initial_eta ON orders;
DROP TRIGGER IF EXISTS tr_sentinel_initial_setup ON orders;
DROP TRIGGER IF EXISTS tr_sentinel_status_sync ON orders;
DROP TRIGGER IF EXISTS tr_sentinel_movement_sync ON riders;

-- ==========================================
-- 2. UTILITY: CALCULATE DYNAMIC ETA (v16.0)
-- ==========================================
CREATE OR REPLACE FUNCTION get_load_balanced_eta_mins_v16(
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
    v_travel_to_res_mins float8 := 0;
    v_travel_to_user_mins float8 := 0;
    v_prep_mins float8;
    v_total_mins integer;
    v_handover_buffer float8 := 3.0; 
    v_dist_to_user float8;
BEGIN
    SELECT lat, long, current_load INTO v_res_lat, v_res_long, v_current_load 
    FROM restaurants WHERE id = p_res_id;
    
    IF p_order_status = 'ARRIVED' THEN RETURN 0; END IF;

    IF p_order_status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY') THEN
        IF p_rider_id IS NOT NULL THEN
            SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = p_rider_id;
            v_travel_to_res_mins = calculate_distance(v_rider_lat, v_rider_long, v_res_lat, v_res_long) * 3.0;
        END IF;
        
        v_prep_mins = 2.0 + (v_current_load / 3.0);
        v_travel_to_user_mins = calculate_distance(v_res_lat, v_res_long, p_user_lat, p_user_long) * 3.0;
        v_total_mins = ceil(greatest(v_prep_mins, v_travel_to_res_mins) + v_travel_to_user_mins + v_handover_buffer);
    
    ELSIF p_order_status = 'ON_THE_WAY' THEN
        SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = p_rider_id;
        v_dist_to_user = calculate_distance(v_rider_lat, v_rider_long, p_user_lat, p_user_long);
        v_travel_to_user_mins = v_dist_to_user * 3.0;
        
        IF v_dist_to_user < 0.05 THEN
            v_total_mins = 0;
        ELSIF v_dist_to_user < 0.5 THEN
            v_total_mins = 1;
        ELSE
            v_handover_buffer = 2.0;
            v_total_mins = ceil(v_travel_to_user_mins + v_handover_buffer);
        END IF;

        IF v_total_mins < 1 AND v_dist_to_user >= 0.05 THEN v_total_mins = 1; END IF;
    ELSE
        v_total_mins = 0;
    END IF;
    RETURN v_total_mins;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 3. TRIGGER: INITIAL SETUP (PRICING + ETA + ASSIGNMENT)
-- ==========================================
CREATE OR REPLACE FUNCTION tr_fn_sentinel_initial_setup_v16()
RETURNS TRIGGER AS $$
DECLARE
    v_eta_mins integer;
    v_user_lat float8; v_user_long float8;
    v_res_lat float8; v_res_long float8;
BEGIN
    -- [PRICING LOGIC] (v16.0)
    -- Tiered Pricing: ₹49/₹89 limits
    IF NEW.total_item_amount < 49 THEN 
        NEW.delivery_fee = 25;
    ELSIF NEW.total_item_amount < 89 THEN 
        NEW.delivery_fee = 15;
    ELSE 
        NEW.delivery_fee = 0;
    END IF;
    
    NEW.total_amount = NEW.total_item_amount + NEW.delivery_fee;

    -- [ETA LOGIC]
    SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = NEW.address_id;
    SELECT lat, long INTO v_res_lat, v_res_long FROM restaurants WHERE id = NEW.restaurant_id;

    v_eta_mins = get_load_balanced_eta_mins_v16(NEW.restaurant_id, v_user_lat, v_user_long);
    NEW.estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval;

    -- [ASSIGNMENT LOGIC]
    SELECT id INTO NEW.rider_id FROM riders 
    WHERE status IN ('AVAILABLE', 'BUSY') 
    AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5
    ORDER BY (status = 'AVAILABLE') DESC, calculate_distance(lat, long, v_res_lat, v_res_long) ASC 
    LIMIT 1;

    -- [LOAD MANAGEMENT]
    IF NEW.rider_id IS NOT NULL THEN
        UPDATE riders SET status = 'BUSY' WHERE id = NEW.rider_id;
        UPDATE restaurants SET current_load = current_load + 1 WHERE id = NEW.restaurant_id;
    ELSE
        RAISE EXCEPTION 'NO_NEARBY_RIDERS_FOR_ASSIGNMENT';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sentinel_initial_setup 
BEFORE INSERT ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_sentinel_initial_setup_v16();

-- ==========================================
-- 4. TRIGGER: STATUS SYNC (TIMESTAMPING + LOAD RELEASE)
-- ==========================================
CREATE OR REPLACE FUNCTION tr_fn_sentinel_status_sync_v16()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ACCEPTED' AND OLD.status = 'PLACED' THEN NEW.accepted_at = NOW(); END IF;
    IF NEW.status = 'PREPARING' AND OLD.status = 'ACCEPTED' THEN NEW.prep_started_at = NOW(); END IF;
    IF NEW.status = 'READY' AND (OLD.status = 'PREPARING' OR OLD.status = 'ACCEPTED') THEN NEW.prep_completed_at = NOW(); END IF;
    IF NEW.status = 'ON_THE_WAY' AND OLD.status = 'READY' THEN NEW.picked_up_at = NOW(); END IF;
    IF NEW.status = 'ARRIVED' AND OLD.status = 'ON_THE_WAY' THEN NEW.arrived_at = NOW(); END IF;

    IF NEW.status = 'ON_THE_WAY' AND OLD.status != 'ON_THE_WAY' THEN
        UPDATE restaurants SET current_load = GREATEST(0, current_load - 1) WHERE id = NEW.restaurant_id;
    END IF;

    IF (NEW.status = 'DELIVERED' OR NEW.status = 'CANCELLED') AND OLD.status NOT IN ('DELIVERED', 'CANCELLED') THEN
        IF OLD.status NOT IN ('ON_THE_WAY', 'ARRIVED', 'DELIVERED') THEN
            UPDATE restaurants SET current_load = GREATEST(0, current_load - 1) WHERE id = NEW.restaurant_id;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM orders WHERE rider_id = NEW.rider_id AND status NOT IN ('DELIVERED', 'CANCELLED') AND id != NEW.id) THEN
            UPDATE riders SET status = 'AVAILABLE' WHERE id = NEW.rider_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sentinel_status_sync 
BEFORE UPDATE OF status ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_sentinel_status_sync_v16();

-- ==========================================
-- 5. TRIGGER: LIVE ETA TRACKING
-- ==========================================
CREATE OR REPLACE FUNCTION tr_fn_sentinel_movement_sync_v16()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
    v_user_lat float8; v_user_long float8;
    v_eta_mins integer;
BEGIN
    FOR v_order IN SELECT id, restaurant_id, address_id, status FROM orders 
                   WHERE rider_id = NEW.id AND status NOT IN ('DELIVERED', 'CANCELLED')
    LOOP
        SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = v_order.address_id;
        v_eta_mins = get_load_balanced_eta_mins_v16(v_order.restaurant_id, v_user_lat, v_user_long, NEW.id, v_order.status);
        UPDATE orders SET estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval 
        WHERE id = v_order.id;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sentinel_movement_sync 
AFTER UPDATE OF lat, long ON riders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_sentinel_movement_sync_v16();

-- ==========================================
-- 6. SENTINEL STRENGTHENED PRE-FLIGHT (v16.0)
-- ==========================================
CREATE OR REPLACE FUNCTION sentinel_preflight_check(
    p_res_id UUID, 
    p_user_lat float8, 
    p_user_long float8, 
    p_item_ids UUID[] DEFAULT ARRAY[]::UUID[],
    p_combo_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS json AS $$
DECLARE
    v_eta integer;
    v_is_open boolean;
    v_nearby_rider_count integer;
    v_res_lat float8; v_res_long float8;
    v_item_missing_count integer := 0;
    v_combo_missing_count integer := 0;
BEGIN
    SELECT is_open, lat, long INTO v_is_open, v_res_lat, v_res_long FROM restaurants WHERE id = p_res_id;
    IF NOT v_is_open THEN RETURN json_build_object('success', false, 'error', 'BAKERY_CLOSED'); END IF;

    IF array_length(p_item_ids, 1) > 0 THEN SELECT count(*) INTO v_item_missing_count FROM items WHERE id = ANY(p_item_ids) AND is_available = false; END IF;
    IF array_length(p_combo_ids, 1) > 0 THEN SELECT count(*) INTO v_combo_missing_count FROM combos WHERE id = ANY(p_combo_ids) AND is_available = false; END IF;

    IF (v_item_missing_count + v_combo_missing_count) > 0 THEN RETURN json_build_object('success', false, 'error', 'ITEMS_UNAVAILABLE'); END IF;

    SELECT count(*) INTO v_nearby_rider_count FROM riders 
    WHERE status IN ('AVAILABLE', 'BUSY')
    AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5;
    
    IF v_nearby_rider_count = 0 THEN RETURN json_build_object('success', false, 'error', 'NO_RIDERS_NEARBY'); END IF;

    v_eta = get_load_balanced_eta_mins_v16(p_res_id, p_user_lat, p_user_long);
    IF v_eta > 18 THEN RETURN json_build_object('success', false, 'error', 'BAKERY_OVERLOADED', 'eta', v_eta); END IF;

    RETURN json_build_object('success', true, 'eta', v_eta);
END;
$$ LANGUAGE plpgsql;
