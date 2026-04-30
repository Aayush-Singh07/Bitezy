-- BITEZY MASTER LOGISTICS ENGINE (V19.0 - ROAD-AWARE ENGINE)
-- ⚠️ IMPORTANT: IMPLEMENTS CIRCUITY FACTOR (1.3x) TO CONVERT GPS DISPLACEMENT TO ROAD DISTANCE.

-- ==========================================
-- 1. NUCLEAR PURGE
-- ==========================================
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name, event_object_table, event_object_schema FROM information_schema.triggers WHERE event_object_table IN ('orders', 'riders')) 
    LOOP EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON ' || quote_ident(r.event_object_schema) || '.' || quote_ident(r.event_object_table) || ' CASCADE'; END LOOP;
    DROP FUNCTION IF EXISTS tr_fn_sentinel_initial_setup_v18_2_before() CASCADE;
    DROP FUNCTION IF EXISTS tr_fn_sentinel_initial_setup_v18_2_after() CASCADE;
END $$;

-- ==========================================
-- 2. LOCK TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS order_load_locks (
    order_id UUID PRIMARY KEY,
    incremented_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. UTILITY: ROAD-AWARE DISTANCE (v19.0)
-- ==========================================
CREATE OR REPLACE FUNCTION calculate_road_distance(lat1 float8, lon1 float8, lat2 float8, lon2 float8)
RETURNS float8 AS $$
DECLARE
    v_displacement float8;
    v_circuity_factor float8 := 1.30; -- Urban circuity factor (1.3x)
BEGIN
    v_displacement = calculate_distance(lat1, lon1, lat2, lon2);
    RETURN v_displacement * v_circuity_factor;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 4. UTILITY: ROAD-AWARE ETA (v19.0)
-- ==========================================
CREATE OR REPLACE FUNCTION get_load_balanced_eta_mins_v19(p_res_id UUID, p_user_lat float8, p_user_long float8, p_rider_id UUID DEFAULT NULL, p_order_status TEXT DEFAULT 'PLACED')
RETURNS integer AS $$
DECLARE
    v_res_lat float8; v_res_long float8; v_rider_lat float8; v_rider_long float8; v_current_load integer;
    v_road_dist_to_res float8 := 0; v_road_dist_to_user float8 := 0;
    v_prep_mins float8; v_total_mins integer;
    v_phys_dist_to_user float8; -- Raw displacement
BEGIN
    SELECT lat, long, current_load INTO v_res_lat, v_res_long, v_current_load FROM restaurants WHERE id = p_res_id;
    
    IF p_order_status = 'ARRIVED' THEN RETURN 0; END IF;

    IF p_order_status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY') THEN
        IF p_rider_id IS NOT NULL THEN 
            SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = p_rider_id; 
            v_road_dist_to_res = calculate_road_distance(v_rider_lat, v_rider_long, v_res_lat, v_res_long);
        END IF;
        
        v_prep_mins = 2.0 + (v_current_load / 3.0); 
        v_road_dist_to_user = calculate_road_distance(v_res_lat, v_res_long, p_user_lat, p_user_long);
        
        -- ETA = MAX(Prep, RiderToRest) + RestToUser + 3m Handover
        v_total_mins = ceil(greatest(v_prep_mins, v_road_dist_to_res * 3.5) + (v_road_dist_to_user * 3.5) + 3.0);
    
    ELSIF p_order_status = 'ON_THE_WAY' THEN
        SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = p_rider_id; 
        v_phys_dist_to_user = calculate_distance(v_rider_lat, v_rider_long, p_user_lat, p_user_long);
        v_road_dist_to_user = v_phys_dist_to_user * 1.30;
        
        -- 'Arriving Now' logic based on physical proximity (displacement)
        IF v_phys_dist_to_user < 0.05 THEN v_total_mins = 0; -- (< 50m)
        ELSIF v_phys_dist_to_user < 0.15 THEN v_total_mins = 1; -- (< 150m)
        ELSE v_total_mins = ceil(v_road_dist_to_user * 3.5 + 1.0); END IF;
    ELSE 
        v_total_mins = 0; 
    END IF;
    
    RETURN greatest(0, v_total_mins);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. TRIGGER: INITIAL SETUP (v19.0)
-- ==========================================
CREATE OR REPLACE FUNCTION tr_fn_sentinel_initial_setup_v19_before()-- ROAD-AWARE
RETURNS TRIGGER AS $$
DECLARE
    v_eta_mins integer; v_user_lat float8; v_user_long float8; v_res_lat float8; v_res_long float8;
BEGIN
    -- [PRICING]
    IF NEW.total_item_amount < 49 THEN NEW.delivery_fee = 25; ELSIF NEW.total_item_amount < 89 THEN NEW.delivery_fee = 15; ELSE NEW.delivery_fee = 0; END IF;
    NEW.total_amount = NEW.total_item_amount + NEW.delivery_fee;

    -- [ETA]
    SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = NEW.address_id;
    SELECT lat, long INTO v_res_lat, v_res_long FROM restaurants WHERE id = NEW.restaurant_id;
    v_eta_mins = get_load_balanced_eta_mins_v19(NEW.restaurant_id, v_user_lat, v_user_long);
    NEW.estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval;

    -- [ASSIGNMENT]
    -- Note: Assignment still uses displacement for search speed, but ordering could use road distance.
    -- For now, search displacement for discovery, then order by displacement (closest in line is closest on road anyway).
    SELECT id INTO NEW.rider_id FROM riders WHERE status IN ('AVAILABLE', 'BUSY') 
    AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5 
    ORDER BY (status = 'AVAILABLE') DESC, calculate_distance(lat, long, v_res_lat, v_res_long) ASC LIMIT 1;

    -- [RIDER LOCK]
    IF NEW.rider_id IS NOT NULL THEN UPDATE riders SET status = 'BUSY' WHERE id = NEW.rider_id;
    ELSE RAISE EXCEPTION 'NO_NEARBY_RIDERS'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tr_fn_sentinel_initial_setup_v19_after()
RETURNS TRIGGER AS $$
BEGIN
    -- [GOD-TIER LOAD LOCK]
    INSERT INTO order_load_locks (order_id) VALUES (NEW.id) ON CONFLICT (order_id) DO NOTHING;
    IF FOUND THEN UPDATE restaurants SET current_load = current_load + 1 WHERE id = NEW.restaurant_id; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sentinel_initial_setup_before ON orders;
CREATE TRIGGER tr_sentinel_initial_setup_before BEFORE INSERT ON orders FOR EACH ROW EXECUTE PROCEDURE tr_fn_sentinel_initial_setup_v19_before();

DROP TRIGGER IF EXISTS tr_sentinel_initial_setup_after ON orders;
CREATE TRIGGER tr_sentinel_initial_setup_after AFTER INSERT ON orders FOR EACH ROW EXECUTE PROCEDURE tr_fn_sentinel_initial_setup_v19_after();

-- ==========================================
-- 6. TRIGGER: STATUS SYNC (v19.0)
-- ==========================================
CREATE OR REPLACE FUNCTION tr_fn_sentinel_status_sync_v19()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ACCEPTED' AND OLD.status = 'PLACED' THEN NEW.accepted_at = NOW(); END IF;
    IF NEW.status = 'PREPARING' AND OLD.status = 'ACCEPTED' THEN NEW.prep_started_at = NOW(); END IF;
    IF NEW.status = 'READY' AND (OLD.status = 'PREPARING' OR OLD.status = 'ACCEPTED') THEN NEW.prep_completed_at = NOW(); END IF;
    IF NEW.status = 'ON_THE_WAY' AND OLD.status = 'READY' THEN 
        NEW.picked_up_at = NOW(); 
        UPDATE restaurants SET current_load = GREATEST(0, current_load - 1) WHERE id = NEW.restaurant_id;
    END IF;
    IF NEW.status = 'ARRIVED' AND OLD.status = 'ON_THE_WAY' THEN NEW.arrived_at = NOW(); END IF;
    IF (NEW.status = 'DELIVERED' OR NEW.status = 'CANCELLED') AND OLD.status NOT IN ('DELIVERED', 'CANCELLED') THEN
        IF OLD.status NOT IN ('ON_THE_WAY', 'ARRIVED', 'DELIVERED') THEN UPDATE restaurants SET current_load = GREATEST(0, current_load - 1) WHERE id = NEW.restaurant_id; END IF;
        IF NOT EXISTS (SELECT 1 FROM orders WHERE rider_id = NEW.rider_id AND status NOT IN ('DELIVERED', 'CANCELLED') AND id != NEW.id) THEN UPDATE riders SET status = 'AVAILABLE' WHERE id = NEW.rider_id; END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sentinel_status_sync BEFORE UPDATE OF status ON orders FOR EACH ROW EXECUTE PROCEDURE tr_fn_sentinel_status_sync_v19();

-- ==========================================
-- 7. LIVE ETA SYNC (v19.0)
-- ==========================================
CREATE OR REPLACE FUNCTION tr_fn_sentinel_movement_sync_v19()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD; v_user_lat float8; v_user_long float8; v_eta_mins integer;
BEGIN
    FOR v_order IN SELECT id, restaurant_id, address_id, status FROM orders WHERE rider_id = NEW.id AND status NOT IN ('DELIVERED', 'CANCELLED')
    LOOP
        SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = v_order.address_id;
        v_eta_mins = get_load_balanced_eta_mins_v19(v_order.restaurant_id, v_user_lat, v_user_long, NEW.id, v_order.status);
        UPDATE orders SET estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval WHERE id = v_order.id;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sentinel_movement_sync AFTER UPDATE OF lat, long ON riders FOR EACH ROW EXECUTE PROCEDURE tr_fn_sentinel_movement_sync_v19();

-- ==========================================
-- 8. RPC: PREFLIGHT (v19.0)
-- ==========================================
CREATE OR REPLACE FUNCTION sentinel_preflight_check(p_res_id UUID, p_user_lat float8, p_user_long float8, p_item_ids UUID[] DEFAULT ARRAY[]::UUID[], p_combo_ids UUID[] DEFAULT ARRAY[]::UUID[])
RETURNS json AS $$
DECLARE
    v_eta integer; v_is_open boolean; v_nearby_rider_count integer; v_res_lat float8; v_res_long float8;
BEGIN
    SELECT is_open, lat, long INTO v_is_open, v_res_lat, v_res_long FROM restaurants WHERE id = p_res_id;
    IF NOT v_is_open THEN RETURN json_build_object('success', false, 'error', 'BAKERY_CLOSED'); END IF;
    SELECT count(*) INTO v_nearby_rider_count FROM riders WHERE status IN ('AVAILABLE', 'BUSY') AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5;
    IF v_nearby_rider_count = 0 THEN RETURN json_build_object('success', false, 'error', 'NO_RIDERS_NEARBY'); END IF;
    v_eta = get_load_balanced_eta_mins_v19(p_res_id, p_user_lat, p_user_long);
    RETURN json_build_object('success', true, 'eta', v_eta);
END;
$$ LANGUAGE plpgsql;
