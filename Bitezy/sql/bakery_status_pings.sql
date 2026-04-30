-- ==============================================================================
-- 💂‍♂️ BITEZY PINGS: AUTOMATED HYPERLOCAL MARKETING
-- ==============================================================================
-- This script implements proximity-based push notifications for restaurant
-- status changes (Open / Closing Soon).
-- ==============================================================================

-- 1. Function to notify nearby users when a bakery opens
CREATE OR REPLACE FUNCTION public.fn_ping_nearby_users_on_bakery_open()
RETURNS TRIGGER AS $$
DECLARE
    v_user RECORD;
    v_title TEXT;
    v_body TEXT;
    v_rand INTEGER;
BEGIN
    -- Only trigger when is_open flips from FALSE to TRUE
    IF (OLD.is_open IS FALSE AND NEW.is_open IS TRUE) THEN
        
        -- Pick a random quirky message (5 Samples)
        v_rand := floor(random() * 5);
        CASE v_rand
            WHEN 0 THEN v_title := 'OVEN IS ON! 🔥'; v_body := NEW.name || ' is live. Come get it!';
            WHEN 1 THEN v_title := 'FRESH DOUGH ALERT 🧤'; v_body := NEW.name || ' is open. Smells like heaven.';
            WHEN 2 THEN v_title := 'BITE TIME? 🥨'; v_body := NEW.name || ' is open. Don''t let your coffee wait.';
            WHEN 3 THEN v_title := 'WAKE & BAKE 🌬️'; v_body := NEW.name || ' is flipping the sign. Samosas are ready!';
            ELSE v_title := 'HOT STUFF! 🌶️'; v_body := NEW.name || ' is open for your morning snack.';
        END CASE;

        -- Find nearby users (Default Address within 750m)
        FOR v_user IN 
            SELECT DISTINCT user_id 
            FROM public.addresses 
            WHERE is_default = TRUE 
            AND (
                6371000 * acos(
                    cos(radians(NEW.lat)) * cos(radians(lat)) * 
                    cos(radians(long) - radians(NEW.long)) + 
                    sin(radians(NEW.lat)) * sin(radians(lat))
                )
            ) <= 750 -- 750m Golden Radius
        LOOP
            -- Send individual push notifications
            PERFORM
                net.http_post(
                    url := 'https://tcqkoknzhjbpqdqypczb.supabase.co/functions/v1/push-notify',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || COALESCE((current_setting('request.headers', true)::jsonb)->>'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjcWtva256aGpicHFkcXlwY3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5MzYsImV4cCI6MjA5MDE2NDkzNn0.QqHiFKOzMAnC2_0I_wL_4wZpUJwtLRIUUWi4m403QSs')
                    ),
                    body := jsonb_build_object(
                        'user_id', v_user.user_id,
                        'title', v_title,
                        'body', v_body,
                        'data', jsonb_build_object('restaurant_id', NEW.id, 'type', 'MARKETING_OPEN')
                    )
                );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to Poll and Notify users 15 minutes before closing
-- This should be called every minute (e.g., via pg_cron or an Edge Function trigger)
CREATE OR REPLACE FUNCTION public.fn_poller_ping_closing_soon()
RETURNS void AS $$
DECLARE
    v_restaurant RECORD;
    v_user RECORD;
    v_title TEXT;
    v_body TEXT;
    v_rand INTEGER;
BEGIN
    -- Find restaurants closing in exactly 15-17 minutes
    -- Using Asia/Kolkata timezone to match IST (Indian Standard Time)
    FOR v_restaurant IN 
        SELECT id, name, lat, long 
        FROM public.restaurants 
        WHERE is_open IS TRUE 
        AND close_time IS NOT NULL 
        AND (close_time - (now() AT TIME ZONE 'Asia/Kolkata')::time) < interval '17 minutes' 
        AND (close_time - (now() AT TIME ZONE 'Asia/Kolkata')::time) >= interval '15 minutes'
    LOOP
        
        -- Pick a random quirky message (5 Samples)
        v_rand := floor(random() * 5);
        CASE v_rand
            WHEN 0 THEN v_title := 'FOMO HITS HARD 💔'; v_body := v_restaurant.name || ' closing in 15. Last call for snacks!';
            WHEN 1 THEN v_title := 'FINAL SPRINT 🏁'; v_body := v_restaurant.name || ' is wrapping up. Quick-quick!';
            WHEN 2 THEN v_title := 'STACK UP NOW 🔐'; v_body := 'Closing soon. Snatched that last bite yet?';
            WHEN 3 THEN v_title := 'OVEN COOLING 🧊'; v_body := v_restaurant.name || ' is calling it a night. Hurry up!';
            ELSE v_title := 'LAST SNACK CALL 🥊'; v_body := '10 mins left for ' || v_restaurant.name || '. Don''t miss out!';
        END CASE;

        -- Find nearby users (Default Address within 750m)
        FOR v_user IN 
            SELECT DISTINCT user_id 
            FROM public.addresses 
            WHERE is_default = TRUE 
            AND (
                6371000 * acos(
                    cos(radians(v_restaurant.lat)) * cos(radians(lat)) * 
                    cos(radians(long) - radians(v_restaurant.long)) + 
                    sin(radians(v_restaurant.lat)) * sin(radians(lat))
                )
            ) <= 750
        LOOP
            -- Send individual push notifications
            PERFORM
                net.http_post(
                    url := 'https://tcqkoknzhjbpqdqypczb.supabase.co/functions/v1/push-notify',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || COALESCE((current_setting('request.headers', true)::jsonb)->>'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjcWtva256aGpicHFkcXlwY3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5MzYsImV4cCI6MjA5MDE2NDkzNn0.QqHiFKOzMAnC2_0I_wL_4wZpUJwtLRIUUWi4m403QSs')
                    ),
                    body := jsonb_build_object(
                        'user_id', v_user.user_id,
                        'title', v_title,
                        'body', v_body,
                        'data', jsonb_build_object('restaurant_id', v_restaurant.id, 'type', 'MARKETING_CLOSE')
                    )
                );
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to the restaurants table
DROP TRIGGER IF EXISTS tr_ping_nearby_users_on_open ON public.restaurants;
CREATE TRIGGER tr_ping_nearby_users_on_open
    AFTER UPDATE ON public.restaurants
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_ping_nearby_users_on_bakery_open();
