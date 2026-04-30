-- ─── BITEZY NOTIFICATION HUB (Broadcaster) ────────────────────────────────────
-- This function sends a REALTIME broadcast to a specific user's channel 
-- whenever their order status changes or a nearby bakery opens.

-- 1. Create the broadcast function
CREATE OR REPLACE FUNCTION public.broadcast_bitezy_alert()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  alert_title TEXT;
  alert_body TEXT;
  alert_type TEXT; -- 'ORDER' or 'SYSTEM'
BEGIN
  -- Determine target user and message
  IF (TG_TABLE_NAME = 'orders') THEN
    target_user_id := NEW.user_id;
    alert_type := 'ORDER';
    
    CASE NEW.status
      WHEN 'ACCEPTED' THEN 
        alert_title := 'ORDER LOCKED! 🧤';
        alert_body := 'The bakery secured the bag. Chef is warming up the oven!';
      WHEN 'ARRIVED' THEN 
        alert_title := 'FINAL SPRINT! 🏁';
        alert_body := 'Rider is at your door. The feast has arrived!';
      WHEN 'CANCELLED' THEN 
        alert_title := 'OH NO! 💔';
        alert_body := 'The bakery ran out of snacks. We''re crying too. Refund is on its way.';
      ELSE
        RETURN NEW; 
    END CASE;
  END IF;

  -- Broadcast to the user-specific channel
  -- Channel name format: 'user_alerts:<user_id>'
  PERFORM pg_notify(
    'pgrst',
    json_build_object(
      'channel', 'user_alerts:' || target_user_id::text,
      'message', json_build_object(
        'title', alert_title,
        'body', alert_body,
        'type', alert_type,
        'order_id', NEW.id
      )
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to orders table
DROP TRIGGER IF EXISTS on_order_status_update_notify ON public.orders;
CREATE TRIGGER on_order_status_update_notify
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE PROCEDURE public.broadcast_bitezy_alert();

-- 3. (Optional) Broadcast for Bakery Opening
-- This would require knowing which users are in which zone. 
-- For MVP, we stick to Order Status.
