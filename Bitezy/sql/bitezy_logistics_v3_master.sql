-- BITEZY MASTER LOGISTICS ENGINE (V3.0 - ZOMATO GRADE)
-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR

-- 1. FINALIZED STATUS LIST
-- 'PLACED', 'ACCEPTED', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'

-- 2. SCHEMA: HAVERSINE & AVAILABILITY
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

-- 3. LOGIC: DYNAMIC ETA ENGINE (Strict 18m Ceiling)
CREATE OR REPLACE FUNCTION get_dynamic_eta_mins(p_order_id UUID)
RETURNS float8 AS $$
DECLARE
    v_status TEXT;
    v_res_lat float8; v_res_long float8;
    v_user_lat float8; v_user_long float8;
    v_rider_id UUID; v_rider_lat float8; v_rider_long float8;
    v_dist_rider_to_res float8 := 0; 
    v_dist_res_to_user float8 := 0; 
    v_total_mins float8 := 0;
BEGIN
    SELECT o.status, r.lat, r.long, a.lat, a.long, o.rider_id
    INTO v_status, v_res_lat, v_res_long, v_user_lat, v_user_long, v_rider_id
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    JOIN addresses a ON o.address_id = a.id
    WHERE o.id = p_order_id;

    -- Distance Restaurant -> User (Target)
    v_dist_res_to_user = calculate_distance(v_res_lat, v_res_long, v_user_lat, v_user_long);

    IF v_rider_id IS NOT NULL THEN
        SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = v_rider_id;
        
        IF v_status = 'ON_THE_WAY' THEN
            -- Rider heading to user
            v_total_mins = calculate_distance(v_rider_lat, v_rider_long, v_user_lat, v_user_long) * 3.0; -- 20km/h
        ELSE
            -- Rider heading to bakery (ACCEPTED or READY)
            v_dist_rider_to_res = calculate_distance(v_rider_lat, v_rider_long, v_res_lat, v_res_long);
            v_total_mins = (v_dist_rider_to_res + v_dist_res_to_user) * 3.0;
        END IF;
    ELSE
        -- No rider yet (only possible in PLACED)
        v_total_mins = (v_dist_res_to_user * 3.0) + 7.0; -- 7m baseline for assignment + travel
    END IF;

    -- Buffers based on state
    IF v_status = 'PLACED' THEN v_total_mins = v_total_mins + 10.0; END IF;
    IF v_status = 'ACCEPTED' THEN v_total_mins = v_total_mins + 2.0; END IF;
    
    -- Strict Optimization: Cap at 18 mins, floor at 3 mins
    RETURN LEAST(18.0, GREATEST(3.0, v_total_mins));
END;
$$ LANGUAGE plpgsql;

-- 4. UTILITY: FLEET AVAILABILITY GUARD
CREATE OR REPLACE FUNCTION get_available_rider_count(p_restaurant_id UUID)
RETURNS integer AS $$
DECLARE
    v_count integer;
BEGIN
    -- For now, we assume hyperlocal zone-wide coverage (single bakery model)
    -- Simply count riders with status 'AVAILABLE'
    SELECT count(*) INTO v_count FROM riders WHERE status = 'AVAILABLE';
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER: STATUS COMPLIANCE
CREATE OR REPLACE FUNCTION tr_fn_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log timestamps
    IF NEW.status = 'ACCEPTED' AND OLD.status = 'PLACED' THEN NEW.accepted_at = NOW(); END IF;
    IF NEW.status = 'READY' AND OLD.status = 'ACCEPTED' THEN NEW.prep_completed_at = NOW(); END IF;
    IF NEW.status = 'ON_THE_WAY' THEN NEW.picked_up_at = NOW(); END IF;
    
    -- Recalculate ETA
    NEW.estimated_arrival_at = NOW() + (get_dynamic_eta_mins(NEW.id) || ' minutes')::interval;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sync Triggers (Clean start)
DROP TRIGGER IF EXISTS tr_update_order_on_status_change ON orders;
CREATE TRIGGER tr_update_order_on_status_change 
BEFORE UPDATE OF status ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_status_change();

-- 6. JIT ASSIGNMENT (Zomato-style)
CREATE OR REPLACE FUNCTION assign_best_rider_v3(p_order_id UUID)
RETURNS UUID AS $$
DECLARE
    v_rider_id UUID;
    v_res_lat float8; v_res_long float8;
BEGIN
    SELECT r.lat, r.long INTO v_res_lat, v_res_long 
    FROM restaurants r JOIN orders o ON r.id = o.restaurant_id 
    WHERE o.id = p_order_id;
    
    -- Closest rider first
    SELECT id INTO v_rider_id FROM riders 
    WHERE status = 'AVAILABLE' 
    ORDER BY calculate_distance(lat, long, v_res_lat, v_res_long) ASC 
    LIMIT 1;

    IF v_rider_id IS NOT NULL THEN
        UPDATE orders SET rider_id = v_rider_id WHERE id = p_order_id;
        UPDATE riders SET status = 'BUSY' WHERE id = v_rider_id;
        RETURN v_rider_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
