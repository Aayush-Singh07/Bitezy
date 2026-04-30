-- BITEZY DELIVERY SIMULATION SCRIPT
-- RUN THIS IN SUPABASE SQL CONSOLE TO SIMULATE AN ORDER FLOW

-- 1. Create a dummy order
-- Note: Replace 'USER_ID_HERE', 'RESTAURANT_ID_HERE', 'ADDRESS_ID_HERE' with actual IDs from your DB if needed.
-- Or just use these dummy UUIDs if testing from scratch.

-- Let's find some real IDs to make it work out of the box
DO $$
DECLARE
  v_user_id UUID;
  v_res_id UUID;
  v_addr_id UUID;
  v_order_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.users LIMIT 1;
  SELECT id INTO v_res_id FROM public.restaurants LIMIT 1;
  SELECT id INTO v_addr_id FROM public.addresses WHERE user_id = v_user_id LIMIT 1;

  IF v_user_id IS NULL OR v_res_id IS NULL OR v_addr_id IS NULL THEN
    RAISE NOTICE 'Missing data: Check users, restaurants, and addresses tables';
    RETURN;
  END IF;

  -- Create Order (Tier 1: < 49 -> 25 delivery) 
  -- Note: Backend will set the initial ETA based on JIT assignment.
  INSERT INTO orders (user_id, restaurant_id, address_id, total_item_amount, status)
  VALUES (v_user_id, v_res_id, v_addr_id, 30, 'PLACED')
  RETURNING id INTO v_order_id;
  
  RAISE NOTICE 'ORDER_ID: %', v_order_id;
  
  -- Run Assignment Algo
  PERFORM find_best_rider_v2(v_order_id);
  
END $$;

-- 2. SIMULATE RIDER MOVEMENT (COPY-PASTE RIDER_ID from public.riders)
-- Run this repeatedly with different lat/long to watch the app ETA update:
-- UPDATE riders SET lat = 28.4600, long = 77.0270 WHERE id = 'YOUR_RIDER_ID';
-- UPDATE riders SET lat = 28.4610, long = 77.0280 WHERE id = 'YOUR_RIDER_ID';

-- 3. TO ADVANCE STATUS MANUALLY (COPY-PASTE ORDER_ID):
-- UPDATE orders SET status = 'READY' WHERE id = 'YOUR_ORDER_ID';
-- UPDATE orders SET status = 'PICKED' WHERE id = 'YOUR_ORDER_ID';
-- UPDATE orders SET status = 'DELIVERED' WHERE id = 'YOUR_ORDER_ID';
