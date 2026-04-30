-- ==============================================================================
-- 💂‍♂️ BITEZY AUTO-CANCEL: THE STALE-ORDER SHIELD
-- ==============================================================================
-- This function identifies and cancels orders that haven't been accepted 
-- by a restaurant within the 3-minute window (Bitezy Standard).
-- ==============================================================================

-- 1. Create the auto-cancel logic
CREATE OR REPLACE FUNCTION public.fn_auto_cancel_stale_orders()
RETURNS void AS $$
BEGIN
    -- Identify and update orders to 'CANCELLED'
    -- Criteria: Status is 'PLACED' and they were created > 3 minutes ago
    UPDATE public.orders 
    SET status = 'CANCELLED' 
    WHERE status = 'PLACED' 
    AND created_at < now() - interval '3 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Schedule the Cron Job (Assumes pg_cron is enabled)
-- Iska naam rakhte hain 'bitezy-auto-cancel-stale-orders'
-- Loop: Every minute to ensure zero stale orders escape
SELECT cron.schedule(
    'bitezy-auto-cancel-stale-orders',
    '* * * * *',
    'SELECT public.fn_auto_cancel_stale_orders();'
);

-- Note: Our existing 'tr_push_on_order_status_update' trigger will automatically
-- send the push notification to the user because we updated the status to 'CANCELLED'.
