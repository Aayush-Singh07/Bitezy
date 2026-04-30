-- BITEZY MASTER LOGISTICS ENGINE (V2.0 - STRICT HUMAN-TRIGGERED)
-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR

-- 1. ADD MISSING COLUMNS (If not already there)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_payout INTEGER DEFAULT 15;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_item_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prep_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE riders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OFFLINE';

-- 2. RESET TRIGGERS & FUNCTIONS (Clean slate)
DROP TRIGGER IF EXISTS tr_setup_new_order ON orders;
DROP TRIGGER IF EXISTS tr_update_order_eta ON orders;
DROP TRIGGER IF EXISTS tr_recalc_order_eta ON riders;
DROP FUNCTION IF EXISTS setup_new_order();
DROP FUNCTION IF EXISTS update_order_eta_on_status_change();
DROP FUNCTION IF EXISTS recalculate_order_eta_on_movement();
DROP FUNCTION IF EXISTS calculate_distance(float8, float8, float8, float8);
DROP FUNCTION IF EXISTS find_best_rider(UUID);
DROP FUNCTION IF EXISTS find_best_rider_v2(UUID);

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

-- 4. LOGIC: ETA CALCULATION (CORE ENGINE)
-- Formulas:
-- PLACED -> (Rest to User Dist) / 20kmh + 10m (Estimated Prep + Assignment)
-- PREPARING -> (Rider to Rest Dist) + (Rest to User Dist) + (Prep Time Remaining) + 3m Buffer
-- READY -> (Rider to Rest Dist) + (Rest to User Dist) + 3m Buffer
-- OUT_FOR_DELIVERY -> (Rider to User Dist) + 3m Buffer
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

    -- Basic Restaurant to User Distance (Used in almost all cases)
    v_dist_res_to_user = calculate_distance(v_res_lat, v_res_long, v_user_lat, v_user_long);

    -- If Rider assigned, add their distance
    IF v_rider_id IS NOT NULL THEN
        SELECT lat, long INTO v_rider_lat, v_rider_long FROM riders WHERE id = v_rider_id;
        
        IF v_status = 'OUT_FOR_DELIVERY' THEN
            -- Rider is already moving towards user
            v_total_mins = calculate_distance(v_rider_lat, v_rider_long, v_user_lat, v_user_long) * 3.0; -- 20km/h
        ELSE
            -- Rider heading to bakery (PREPARING or READY)
            v_dist_rider_to_res = calculate_distance(v_rider_lat, v_rider_long, v_res_lat, v_res_long);
            v_total_mins = (v_dist_rider_to_res + v_dist_res_to_user) * 3.0;
        END IF;
    ELSE
        -- No rider yet, use estimated baseline
        v_total_mins = (v_dist_res_to_user * 3.0) + 7.0;
    END IF;

    -- Status-specific buffers
    IF v_status = 'PLACED' THEN v_total_mins = v_total_mins + 10.0; END IF;
    IF v_status = 'PREPARING' THEN v_total_mins = v_total_mins + 2.0; END IF;
    
    -- Minimum floor of 3 minutes for Building Entry/Handover
    RETURN GREATEST(3.0, v_total_mins);
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER: INITIAL ORDER SETUP (Pricing)
CREATE OR REPLACE FUNCTION tr_fn_setup_order()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_item_amount = 0 THEN NEW.total_item_amount = NEW.total_amount; END IF;
    NEW.rider_payout = 15;
    
    -- Tiered Pricing Logic
    IF NEW.total_item_amount < 49 THEN NEW.delivery_fee = 25;
    ELSIF NEW.total_item_amount < 89 THEN NEW.delivery_fee = 15;
    ELSE NEW.delivery_fee = 0;
    END IF;
    
    NEW.total_amount = NEW.total_item_amount + NEW.delivery_fee;
    NEW.estimated_arrival_at = NOW() + INTERVAL '10 minutes';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_setup_new_order BEFORE INSERT ON orders FOR EACH ROW EXECUTE PROCEDURE tr_fn_setup_order();

-- 6. TRIGGER: STATUS CHANGE LOGIC (No auto-advance)
CREATE OR REPLACE FUNCTION tr_fn_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'PREPARING' AND OLD.status = 'PLACED' THEN NEW.accepted_at = NOW(); END IF;
    IF NEW.status = 'READY' AND OLD.status = 'PREPARING' THEN NEW.prep_completed_at = NOW(); END IF;
    IF NEW.status = 'OUT_FOR_DELIVERY' THEN NEW.picked_up_at = NOW(); END IF;
    
    -- Update ETA on every human-triggered status change
    NEW.estimated_arrival_at = NOW() + (get_dynamic_eta_mins(NEW.id) || ' minutes')::interval;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_order_on_status_change BEFORE UPDATE OF status ON orders FOR EACH ROW EXECUTE PROCEDURE tr_fn_status_change();

-- 7. TRIGGER: RIDER MOVEMENT (Live Tracking)
CREATE OR REPLACE FUNCTION tr_fn_rider_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
BEGIN
    IF (OLD.lat = NEW.lat AND OLD.long = NEW.long) THEN RETURN NEW; END IF;

    -- Only update orders that are "Active"
    FOR v_order_id IN 
        SELECT id FROM orders WHERE rider_id = NEW.id AND status IN ('PREPARING', 'READY', 'OUT_FOR_DELIVERY')
    LOOP
        UPDATE orders SET estimated_arrival_at = NOW() + (get_dynamic_eta_mins(id) || ' minutes')::interval
        WHERE id = v_order_id;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_recalc_eta_on_movement AFTER UPDATE OF lat, long ON riders FOR EACH ROW EXECUTE PROCEDURE tr_fn_rider_movement();

-- 8. UTILITY: FIND RIDER (Geographically Nearest)
CREATE OR REPLACE FUNCTION assign_best_rider_v2(p_order_id UUID)
RETURNS UUID AS $$
DECLARE
    v_rider_id UUID;
    v_res_lat float8; v_res_long float8;
BEGIN
    SELECT r.lat, r.long INTO v_res_lat, v_res_long FROM restaurants r JOIN orders o ON r.id = o.restaurant_id WHERE o.id = p_order_id;
    
    SELECT id INTO v_rider_id FROM riders WHERE status = 'AVAILABLE' ORDER BY calculate_distance(lat, long, v_res_lat, v_res_long) ASC LIMIT 1;

    IF v_rider_id IS NOT NULL THEN
        UPDATE orders SET rider_id = v_rider_id WHERE id = p_order_id; -- Note: User must manually trigger PREPARING via 'Accept' button in future
        UPDATE riders SET status = 'BUSY' WHERE id = v_rider_id;
        RETURN v_rider_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
