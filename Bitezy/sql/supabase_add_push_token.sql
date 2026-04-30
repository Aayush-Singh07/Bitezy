-- Add a column to store the user's push token
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
