-- 1. Create a function to invoke the push-notify Edge Function
CREATE OR REPLACE FUNCTION public.fn_trigger_push_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_title TEXT;
    v_body TEXT;
    v_status TEXT;
BEGIN
    -- Only trigger for specific high-value status changes to avoid notification fatigue
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('ACCEPTED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED')) THEN
        v_user_id := NEW.user_id;
        v_status := NEW.status;

        -- Formulate the Quirky Message based on the new status
        CASE v_status
            WHEN 'ACCEPTED' THEN
                v_title := 'BITE LOCKED! 🔐';
                v_body := 'The bakery secured the bag. Chef is hyped!';
            WHEN 'PREPARING' THEN
                v_title := 'MAGIC IN OVEN ✨';
                v_body := 'Dough is rising and the oven is heating up!';
            WHEN 'READY' THEN
                v_title := 'READY TO FLY 🚀';
                v_body := 'Your treats are freshly packed and ready to go!';
            WHEN 'ON_THE_WAY' THEN
                v_title := 'ZOOMING TO YOU 🚲';
                v_body := 'Rider is on the move. Prepare your tastebuds!';
            WHEN 'ARRIVED' THEN
                v_title := 'OUTSIDE! OPEN UP! 🚪';
                v_body := 'The snack has landed. Doorstep vibes only!';
            WHEN 'DELIVERED' THEN
                v_title := 'THE SNACK HAS LANDED! 🍟';
                v_body := 'Order delivered. Quick, grab a bite before it cools down!';
            WHEN 'CANCELLED' THEN
                v_title := 'OH NO! 💔';
                v_body := 'The bakery ran out of snacks. We''re crying too.';
            ELSE
                v_title := 'ORDER STATUS UPDATE 🧤';
                v_body := 'Your Bitezy order status is now ' || v_status;
        END CASE;

        -- Invoke the Edge Function via a non-blocking background worker
        -- Hardcoded URL for absolute stability (Project Ref: tcqkoknzhjbpqdqypczb)
        PERFORM
            net.http_post(
                url := 'https://tcqkoknzhjbpqdqypczb.supabase.co/functions/v1/push-notify',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || COALESCE((current_setting('request.headers', true)::jsonb)->>'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjcWtva256aGpicHFkcXlwY3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5MzYsImV4cCI6MjA5MDE2NDkzNn0.QqHiFKOzMAnC2_0I_wL_4wZpUJwtLRIUUWi4m403QSs')
                ),
                body := jsonb_build_object(
                    'user_id', v_user_id,
                    'title', v_title,
                    'body', v_body,
                    'data', jsonb_build_object('order_id', NEW.id, 'status', v_status)
                )
            );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the orders table
DROP TRIGGER IF EXISTS tr_push_on_order_status_update ON public.orders;
CREATE TRIGGER tr_push_on_order_status_update
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trigger_push_on_status_change();
