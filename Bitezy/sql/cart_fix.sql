-- BITEZY CART TOTAL SYNCHRONIZATION FIX
-- RUN THIS IN SUPABASE SQL CONSOLE

-- 1. Function to update cart total
CREATE OR REPLACE FUNCTION update_cart_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE carts
  SET total_amount = (
    SELECT COALESCE(SUM(price * quantity), 0)
    FROM cart_items
    WHERE cart_id = COALESCE(NEW.cart_id, OLD.cart_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger for cart_items
DROP TRIGGER IF EXISTS tr_update_cart_total ON cart_items;
CREATE TRIGGER tr_update_cart_total
AFTER INSERT OR UPDATE OR DELETE ON cart_items
FOR EACH ROW EXECUTE PROCEDURE update_cart_total();
