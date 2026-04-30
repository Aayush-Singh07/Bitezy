-- BITEZY MASTER LOGISTICS ENGINE (V4.0 - THE SENTINEL)
-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR

-- 1. SCHEMA UPDATES
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS current_load INTEGER DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true;

-- 2. FINALIZED STATUS LIST
-- 'PLACED', 'ACCEPTED', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'

-- 3. UTILITY: HAVERSINE DISTANCE
CREATE OR REPLACE FUNCTION calculate_distance(lat1 float8, lon1 float8, lat2 float8, lon2 float8)
RETURNS float8 AS $$
DECLARE
    R float8 := 6371; -- Earth radius in KM
    dlat float8 := radians(lat2 - lat1);
    dlon float8 := radians(lon2 - lon1);
    a float8;
    c float8;
BEGIN
    a := sin(dlat/2) * sin(dlat/2) +
         cos(radians(lat1)) * cos(radians(lat2)) *
         sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql;

-- 4. LOGIC: THE SENTINEL (LOAD-BALANCED ETA - FIXED NUMBER)
-- Formula: (Travel) + Prep(2 + Load/3) + RiderWait
CREATE OR REPLACE FUNCTION get_load_balanced_eta_mins(p_res_id UUID, p_user_lat float8, p_user_long float8)
RETURNS integer AS $$
DECLARE
    v_res_lat float8; v_res_long float8;
    v_current_load integer;
    v_available_riders integer;
    v_travel_mins float8;
    v_prep_mins float8;
    v_rider_wait_mins float8 := 0;
    v_total_mins integer;
BEGIN
    SELECT lat, long, current_load INTO v_res_lat, v_res_long, v_current_load 
    FROM restaurants WHERE id = p_res_id;
    
    SELECT count(*) INTO v_available_riders FROM riders WHERE status = 'AVAILABLE';

    -- Physics: 20km/h travel
    v_travel_mins = calculate_distance(v_res_lat, v_res_long, p_user_lat, p_user_long) * 3.0;
    
    -- Kitchen Load: 2m base + 1m for every 3 active orders
    v_prep_mins = 2.0 + (v_current_load / 3.0);
    
    -- Rider Load: 0 if someone's free, 5 if everyone's busy
    IF v_available_riders = 0 THEN
        v_rider_wait_mins = 5.0;
    END IF;

    v_total_mins = ceil(v_travel_mins + v_prep_mins + v_rider_wait_mins + 3.0); -- 3m buffer
    
    RETURN v_total_mins;
END;
$$ LANGUAGE plpgsql;

-- 5. FUNCTION: PRE-FLIGHT CHECK (Atomic Evaluation)
CREATE OR REPLACE FUNCTION sentinel_preflight_check(p_res_id UUID, p_user_lat float8, p_user_long float8, p_items jsonb)
RETURNS json AS $$
DECLARE
    v_eta integer;
    v_is_open boolean;
    v_available_riders integer;
    v_item_id UUID;
    v_is_available boolean;
BEGIN
    -- Check Bakery Status
    SELECT is_open INTO v_is_open FROM restaurants WHERE id = p_res_id;
    IF NOT v_is_open THEN 
        RETURN json_build_object('success', false, 'error', 'BAKERY_CLOSED'); 
    END IF;

    -- Check Fleet Status
    SELECT count(*) INTO v_available_riders FROM riders WHERE status IN ('AVAILABLE', 'BUSY');
    IF v_available_riders = 0 THEN 
        RETURN json_build_object('success', false, 'error', 'NO_RIDERS_ONLINE'); 
    END IF;

    -- Calculate Load-Balanced ETA
    v_eta = get_load_balanced_eta_mins(p_res_id, p_user_lat, p_user_long);
    IF v_eta > 18 THEN 
        RETURN json_build_object('success', false, 'error', 'BAKERY_OVERLOADED', 'eta', v_eta); 
    END IF;

    -- Check Item Availability
    -- (This assumes p_items is an array of item_ids)
    -- This is a placeholder for actual item checking logic
    
    RETURN json_build_object('success', true, 'eta', v_eta);
END;
$$ LANGUAGE plpgsql;

-- 6. JIT ASSIGNMENT (IMPROVED - ATOMIC AT PLACEMENT)
CREATE OR REPLACE FUNCTION tr_fn_assign_on_placed()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_id UUID;
    v_res_lat float8; v_res_long float8;
BEGIN
    SELECT lat, long INTO v_res_lat, v_res_long FROM restaurants WHERE id = NEW.restaurant_id;

    -- Find nearest available rider
    SELECT id INTO v_rider_id FROM riders 
    WHERE status = 'AVAILABLE' 
    ORDER BY calculate_distance(lat, long, v_res_lat, v_res_long) ASC 
    LIMIT 1;

    IF v_rider_id IS NOT NULL THEN
        NEW.rider_id = v_rider_id;
        UPDATE riders SET status = 'BUSY' WHERE id = v_rider_id;
        -- Increment Load
        UPDATE restaurants SET current_load = current_load + 1 WHERE id = NEW.restaurant_id;
    ELSE
        -- Strictly block if no rider is available at the moment of insertion
        RAISE EXCEPTION 'NO_RIDERS_AVAILABLE_AT_PLACEMENT';
    END IF;
    
    -- Set Initial ETA
    NEW.estimated_arrival_at = NOW() + (get_load_balanced_eta_mins(NEW.restaurant_id, 28.4595, 77.0266) || ' minutes')::interval; -- Use user's real lat/long in production
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assign_rider_on_insert ON orders;
CREATE TRIGGER tr_assign_rider_on_insert 
BEFORE INSERT ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_assign_on_placed();

-- 7. LOAD TRACKING ON COMPLETION/CANCEL
CREATE OR REPLACE FUNCTION tr_fn_decrement_load()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'DELIVERED' OR NEW.status = 'CANCELLED') AND (OLD.status != 'DELIVERED' AND OLD.status != 'CANCELLED') THEN
        UPDATE restaurants SET current_load = GREATEST(0, current_load - 1) WHERE id = NEW.restaurant_id;
        -- Free the rider
        UPDATE riders SET status = 'AVAILABLE' WHERE id = NEW.rider_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_decrement_load ON orders;
CREATE TRIGGER tr_decrement_load 
AFTER UPDATE ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_decrement_load();
