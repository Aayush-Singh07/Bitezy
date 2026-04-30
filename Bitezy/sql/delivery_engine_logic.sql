-- PHASE 2: BITEZY DELIVERY ENGINE LOGIC (POSTGRES)

-- 1. Function to calculate tiered delivery fee
CREATE OR REPLACE FUNCTION calculate_delivery_fee(p_item_total INTEGER) 
RETURNS INTEGER AS $$
BEGIN
  IF p_item_total < 49 THEN
    RETURN 25;
  ELSIF p_item_total < 89 THEN
    RETURN 15;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger function for initial order setup
CREATE OR REPLACE FUNCTION setup_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_fee INTEGER;
BEGIN
  -- Set unit item amount if not provided
  IF NEW.total_item_amount = 0 THEN
    NEW.total_item_amount = NEW.total_amount;
  END IF;

  -- Calculate dynamic delivery fee
  v_fee = calculate_delivery_fee(NEW.total_item_amount);
  NEW.delivery_fee = v_fee;
  
  -- Re-calculate total_amount (food + delivery)
  NEW.total_amount = NEW.total_item_amount + v_fee;
  
  -- Set fixed rider payout
  NEW.rider_payout = 15;
  
  -- Set initial ETA (Now + 10 mins)
  IF NEW.estimated_arrival_at IS NULL THEN
    NEW.estimated_arrival_at = NOW() + INTERVAL '10 minutes';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_setup_new_order ON orders;
CREATE TRIGGER tr_setup_new_order
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE PROCEDURE setup_new_order();

-- 3. JIT Rider Assignment Simulation Function
-- In a real scenario, this would be more complex (Distance Matrix API)
-- For now, it picks the nearest AVAILABLE rider within the zone.
CREATE OR REPLACE FUNCTION assign_best_rider(p_order_id UUID)
RETURNS UUID AS $$
DECLARE
  v_rider_id UUID;
  v_res_lat DOUBLE PRECISION;
  v_res_long DOUBLE PRECISION;
BEGIN
  -- Get restaurant location
  SELECT r.lat, r.long INTO v_res_lat, v_res_long
  FROM orders o
  JOIN restaurants r ON o.restaurant_id = r.id
  WHERE o.id = p_order_id;

  -- Find nearest available rider (simplified distance sort)
  SELECT id INTO v_rider_id
  FROM riders
  WHERE status = 'AVAILABLE'
  ORDER BY (POW(lat - v_res_lat, 2) + POW(long - v_res_long, 2)) ASC
  LIMIT 1;

  -- If rider found, assign them
  IF v_rider_id IS NOT NULL THEN
    UPDATE orders SET rider_id = v_rider_id, status = 'PREPARING' WHERE id = p_order_id;
    UPDATE riders SET status = 'BUSY' WHERE id = v_rider_id;
    RETURN v_rider_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Dynamic ETA Update trigger
CREATE OR REPLACE FUNCTION update_order_eta_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes, adjust ETA based on travel rules
  -- PLACED -> PREPARING (2 min prep starts)
  IF NEW.status = 'PREPARING' AND OLD.status = 'PLACED' THEN
    NEW.estimated_arrival_at = NOW() + INTERVAL '10 minutes';
  END IF;

  -- PREPARING -> READY (Prep done in 2 mins, now Travel + Buffer)
  IF NEW.status = 'READY' AND OLD.status = 'PREPARING' THEN
    NEW.prep_completed_at = NOW();
    NEW.estimated_arrival_at = NOW() + INTERVAL '6 minutes';
  END IF;

  -- READY -> PICKED (Rider picks it up)
  IF NEW.status = 'PICKED' THEN
    NEW.picked_up_at = NOW();
    NEW.status = 'OUT_FOR_DELIVERY'; -- Auto-advance
    NEW.estimated_arrival_at = NOW() + INTERVAL '5 minutes';
  END IF;

  -- OUT_FOR_DELIVERY -> DELIVERED
  IF NEW.status = 'DELIVERED' THEN
    NEW.estimated_arrival_at = NOW(); -- It has arrived
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_order_eta ON orders;
CREATE TRIGGER tr_update_order_eta
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE PROCEDURE update_order_eta_on_status_change();
