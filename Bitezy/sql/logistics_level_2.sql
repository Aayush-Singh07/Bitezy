-- PHASE 6: LOGISTICS LEVEL 2 - DISTANCE ENGINE (BITEZY)

-- 1. Haversine Distance Function (Standard Geography math)
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

-- 2. Travel Time Calculation (Min floor of 3 mins, Avg Speed 20km/h)
CREATE OR REPLACE FUNCTION get_travel_time_mins(dist_km float8)
RETURNS float8 AS $$
BEGIN
    -- 20km/h = 1km every 3 minutes
    -- We add a 3-minute "Building/Parking" floor.
    RETURN GREATEST(3.0, (dist_km * 3.0));
END;
$$ LANGUAGE plpgsql;

-- 3. Dynamic ETA Calculation Trigger on Rider Movement
CREATE OR REPLACE FUNCTION recalculate_order_eta_on_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_order_status TEXT;
    v_res_lat float8;
    v_res_long float8;
    v_user_lat float8;
    v_user_long float8;
    v_dist_1 float8; -- Rider to Restaurant
    v_dist_2 float8; -- Restaurant to User
    v_time_mins float8;
BEGIN
    -- Only trigger if coordinates changed
    IF (OLD.lat = NEW.lat AND OLD.long = NEW.long) THEN
        RETURN NEW;
      END IF;

    -- Find active order assigned to this rider
    SELECT o.id, o.status, r.lat, r.long, a.lat, a.long
    INTO v_order_id, v_order_status, v_res_lat, v_res_long, v_user_lat, v_user_long
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    JOIN addresses a ON o.address_id = a.id
    WHERE o.rider_id = NEW.id 
      AND o.status IN ('PREPARING', 'READY', 'OUT_FOR_DELIVERY')
    LIMIT 1;

    IF v_order_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calculate based on status
    IF v_order_status = 'OUT_FOR_DELIVERY' THEN
        -- Case: Rider heading to User
        v_dist_1 = calculate_distance(NEW.lat, NEW.long, v_user_lat, v_user_long);
        v_time_mins = get_travel_time_mins(v_dist_1);
    ELSE
        -- Case: Rider heading to Bakery, then to User
        v_dist_1 = calculate_distance(NEW.lat, NEW.long, v_res_lat, v_res_long);
        v_dist_2 = calculate_distance(v_res_lat, v_res_long, v_user_lat, v_user_long);
        v_time_mins = get_travel_time_mins(v_dist_1 + v_dist_2);
        
        -- Add 2 mins prep if still preparing
        IF v_order_status = 'PREPARING' THEN
            v_time_mins = v_time_mins + 2.0;
        END IF;
    END IF;

    -- Update Order ETA
    UPDATE orders 
    SET estimated_arrival_at = NOW() + (v_time_mins || ' minutes')::interval
    WHERE id = v_order_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_recalc_order_eta ON riders;
CREATE TRIGGER tr_recalc_order_eta
AFTER UPDATE ON riders
FOR EACH ROW
EXECUTE FUNCTION recalculate_order_eta_on_movement();

-- 4. Improved Rider Assignment (Uses Distance)
CREATE OR REPLACE FUNCTION find_best_rider_v2(p_order_id UUID)
RETURNS UUID AS $$
DECLARE
    v_rider_id UUID;
    v_res_lat float8;
    v_res_long float8;
BEGIN
    SELECT lat, long INTO v_res_lat, v_res_long 
    FROM restaurants r 
    JOIN orders o ON r.id = o.restaurant_id 
    WHERE o.id = p_order_id;

    -- Find closest available rider
    SELECT r.id INTO v_rider_id
    FROM riders r
    WHERE status = 'AVAILABLE'
    ORDER BY calculate_distance(r.lat, r.long, v_res_lat, v_res_long) ASC
    LIMIT 1;

    IF v_rider_id IS NOT NULL THEN
        UPDATE orders SET rider_id = v_rider_id, status = 'PREPARING' WHERE id = p_order_id;
        UPDATE riders SET status = 'BUSY' WHERE id = v_rider_id;
        RETURN v_rider_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
