-- BITEZY MASTER LOGISTICS ENGINE (V5.0 - THE BOSS LOCK)
-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR

-- 1. SCHEMA: NO CHANGES NEEDED (Already has all columns from v4.0)

-- 2. FINALIZED STATUS LIST
-- 'PLACED', 'ACCEPTED', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'

-- 3. LOGIC: ETA LOCKER (ONLY CALCULATE ON PLACEMENT)
CREATE OR REPLACE FUNCTION tr_fn_set_initial_eta()
RETURNS TRIGGER AS $$
DECLARE
    v_eta_mins integer;
    v_user_lat float8; v_user_long float8;
BEGIN
    -- Fetch the specific user's address coordinates for this order
    SELECT lat, long INTO v_user_lat, v_user_long 
    FROM addresses WHERE id = NEW.address_id;

    -- 1. Initial Load-Balanced ETA (Locked at placement)
    v_eta_mins = get_load_balanced_eta_mins(NEW.restaurant_id, v_user_lat, v_user_long);
    NEW.estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval;

    -- 2. Atomic Rider Assignment (Locked at placement)
    -- This ensures the rider_id is NEVER null for an active order
    SELECT id INTO NEW.rider_id FROM riders 
    WHERE status = 'AVAILABLE' 
    ORDER BY calculate_distance(lat, long, (SELECT lat FROM restaurants WHERE id = NEW.restaurant_id), (SELECT long FROM restaurants WHERE id = NEW.restaurant_id)) ASC 
    LIMIT 1;

    IF NEW.rider_id IS NOT NULL THEN
        UPDATE riders SET status = 'BUSY' WHERE id = NEW.rider_id;
        UPDATE restaurants SET current_load = current_load + 1 WHERE id = NEW.restaurant_id;
    ELSE
        -- Strictly block if no rider is available at the moment of insertion
        RAISE EXCEPTION 'NO_RIDERS_AVAILABLE_AT_PLACEMENT';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_initial_eta ON orders;
CREATE TRIGGER tr_set_initial_eta 
BEFORE INSERT ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_set_initial_eta();

-- 4. LOGIC: STATUS SYNC (NO ETA CHANGE)
CREATE OR REPLACE FUNCTION tr_fn_status_change_v5()
RETURNS TRIGGER AS $$
BEGIN
    -- Status progression timestamps
    IF NEW.status = 'ACCEPTED' AND OLD.status = 'PLACED' THEN NEW.accepted_at = NOW(); END IF;
    IF NEW.status = 'READY' AND OLD.status = 'ACCEPTED' THEN NEW.prep_completed_at = NOW(); END IF;
    IF NEW.status = 'ON_THE_WAY' AND OLD.status = 'READY' THEN NEW.picked_up_at = NOW(); END IF;
    
    -- NOTE: WE NO LONGER RECALCULATE ETA HERE. WE KEEP THE LOCKED ETA.
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_status_change ON orders;
CREATE TRIGGER tr_status_change 
BEFORE UPDATE OF status ON orders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_status_change_v5();

-- 5. LOGIC: RIDER MOVEMENT SYNC (THE ONLY WAY ETA UPDATES)
CREATE OR REPLACE FUNCTION tr_fn_recalc_eta_on_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_active_order_id UUID;
    v_user_id UUID;
    v_user_lat float8; v_user_long float8;
    v_eta_mins integer;
BEGIN
    -- 1. Find if this rider has an active ON_THE_WAY order
    SELECT id, address_id INTO v_active_order_id, v_user_id 
    FROM orders WHERE rider_id = NEW.id AND status = 'ON_THE_WAY' LIMIT 1;
    
    IF v_active_order_id IS NOT NULL THEN
        -- 2. Fetch User Location
        SELECT lat, long INTO v_user_lat, v_user_long FROM addresses WHERE id = v_user_id;
        
        -- 3. Dynamic Distance ETA
        -- Only recalculate travel portion (Distance / 20kmh * 3.0) + 3m Buffer
        v_eta_mins = ceil(calculate_distance(NEW.lat, NEW.long, v_user_lat, v_user_long) * 3.0 + 3.0);
        
        UPDATE orders SET estimated_arrival_at = NOW() + (v_eta_mins || ' minutes')::interval 
        WHERE id = v_active_order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_rider_movement_eta ON riders;
CREATE TRIGGER tr_rider_movement_eta 
AFTER UPDATE OF lat, long ON riders 
FOR EACH ROW EXECUTE PROCEDURE tr_fn_recalc_eta_on_movement();
