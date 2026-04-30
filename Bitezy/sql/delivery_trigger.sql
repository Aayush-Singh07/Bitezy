-- 1. Create the function that sets delivered_at to current timestamp
CREATE OR REPLACE FUNCTION set_delivered_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DELIVERED' AND (OLD.status IS NULL OR OLD.status != 'DELIVERED') THEN
    NEW.delivered_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger to execute before update
DROP TRIGGER IF EXISTS on_order_delivered ON orders;
CREATE TRIGGER on_order_delivered
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_delivered_at_timestamp();
