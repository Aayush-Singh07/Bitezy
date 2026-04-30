-- BITEZY MASTER LOGISTICS ENGINE (V7.0 - THE RIDER QUEUEING FIX)
-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR

-- 1. UTILITY: COUNT RIDERS WITHIN RADIUS
CREATE OR REPLACE FUNCTION fn_count_nearby_riders_v7(p_res_id UUID, p_radius_km float8 DEFAULT 1.5)
RETURNS integer AS $$
DECLARE
    v_res_lat float8; v_res_long float8;
    v_count integer;
BEGIN
    SELECT lat, long INTO v_res_lat, v_res_long FROM restaurants WHERE id = p_res_id;
    
    SELECT count(*) INTO v_count FROM riders 
    WHERE status IN ('AVAILABLE', 'BUSY')
    AND calculate_distance(lat, long, v_res_lat, v_res_long) <= p_radius_km;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 2. LOGIC: THE GEOFENCED ETA (v7.0)
CREATE OR REPLACE FUNCTION get_load_balanced_eta_mins_v7(p_res_id UUID, p_user_lat float8, p_user_long float8)
RETURNS integer AS $$
DECLARE
    v_res_lat float8; v_res_long float8;
    v_current_load integer;
    v_available_nearby_riders integer;
    v_total_nearby_riders integer;
    v_travel_mins float8;
    v_prep_mins float8;
    v_rider_wait_mins float8 := 0;
    v_total_mins integer;
BEGIN
    SELECT lat, long, current_load INTO v_res_lat, v_res_long, v_current_load 
    FROM restaurants WHERE id = p_res_id;
    
    -- ONLY COUNT RIDERS WITHIN 1.5 KM (The "Strike Zone")
    SELECT count(*) INTO v_available_nearby_riders FROM riders 
    WHERE status = 'AVAILABLE' AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5;
    
    SELECT count(*) INTO v_total_nearby_riders FROM riders 
    WHERE status IN ('AVAILABLE', 'BUSY') AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5;

    -- HARD BLOCK: If no riders are even "Online" within 1.5km, return 999
    IF v_total_nearby_riders = 0 THEN RETURN 999; END IF;

    -- Physics: 20km/h travel
    v_travel_mins = calculate_distance(v_res_lat, v_res_long, p_user_lat, p_user_long) * 3.0;
    
    -- Kitchen Load: 2m base + 1m for every 3 active orders
    v_prep_mins = 2.0 + (v_current_load / 3.0);
    
    -- Rider Load Penalty (Wait for busy rider to finish)
    IF v_available_nearby_riders = 0 THEN v_rider_wait_mins = 5.0; END IF;

    v_total_mins = ceil(v_travel_mins + v_prep_mins + v_rider_wait_mins + 3.0);
    
    RETURN v_total_mins;
END;
$$ LANGUAGE plpgsql;

-- 3. FUNCTION: GEOFENCED PRE-FLIGHT CHECK
CREATE OR REPLACE FUNCTION sentinel_preflight_check(p_res_id UUID, p_user_lat float8, p_user_long float8, p_items jsonb)
RETURNS json AS $$
DECLARE
    v_eta integer;
    v_is_open boolean;
    v_nearby_rider_count integer;
BEGIN
    -- 1. Check Bakery Manual Status
    SELECT is_open INTO v_is_open FROM restaurants WHERE id = p_res_id;
    IF NOT v_is_open THEN 
        RETURN json_build_object('success', false, 'error', 'BAKERY_CLOSED'); 
    END IF;

    -- 2. Check Rider Geofence (1.5km strict)
    v_nearby_rider_count = fn_count_nearby_riders_v7(p_res_id, 1.5);
    IF v_nearby_rider_count = 0 THEN 
        RETURN json_build_object('success', false, 'error', 'NO_RIDERS_NEARBY'); 
    END IF;

    -- 3. Calculate Load-Balanced ETA
    v_eta = get_load_balanced_eta_mins_v7(p_res_id, p_user_lat, p_user_long);
    IF v_eta > 18 AND v_eta < 999 THEN 
        RETURN json_build_object('success', false, 'error', 'BAKERY_OVERLOADED', 'eta', v_eta); 
    END IF;
    
    IF v_eta >= 999 THEN
        RETURN json_build_object('success', false, 'error', 'NO_RIDERS_NEARBY'); 
    END IF;

    RETURN json_build_object('success', true, 'eta', v_eta);
END;
$$ LANGUAGE plpgsql;

-- 4. TRIGGER: GEOFENCED QUEUEING ASSIGNMENT (v7.0)
CREATE OR REPLACE FUNCTION tr_fn_set_initial_eta_v7()
RETURNS TRIGGER AS $$
DECLARE
    v_eta_mins integer;
    v_user_lat float8; v_user_long float8;
    v_res_lat float8; v_res_long float8;
BEGIN
    SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = NEW.address_id;
    SELECT lat, long INTO v_res_lat, v_res_long FROM restaurants WHERE id = NEW.restaurant_id;

    -- Initial Locked ETA
    v_eta_mins = get_load_balanced_eta_mins_v7(NEW.restaurant_id, v_user_lat, v_user_long);
    NEW.estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval;

    -- ATOMIC ASSIGNMENT WITH RIDER QUEUEING (v7.0)
    -- We look for riders within 1.5km who are EITHER Available or Busy.
    -- We prioritize 'AVAILABLE' riders, then sort by Distance.
    SELECT id INTO NEW.rider_id FROM riders 
    WHERE status IN ('AVAILABLE', 'BUSY') 
    AND calculate_distance(lat, long, v_res_lat, v_res_long) <= 1.5
    ORDER BY (status = 'AVAILABLE') DESC, calculate_distance(lat, long, v_res_lat, v_res_long) ASC 
    LIMIT 1;

    IF NEW.rider_id IS NOT NULL THEN
        -- Locking: If they were AVAILABLE, they become BUSY. If they were already BUSY, they stay BUSY.
        UPDATE riders SET status = 'BUSY' WHERE id = NEW.rider_id;
        UPDATE restaurants SET current_load = current_load + 1 WHERE id = NEW.restaurant_id;
    ELSE
        -- Strictly block if no online rider is within 1.5km
        RAISE EXCEPTION 'NO_NEARBY_RIDERS_FOR_ASSIGNMENT';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_initial_eta ON orders;
CREATE TRIGGER tr_set_initial_eta 
BEFORE INSERT ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_set_initial_eta_v7();
