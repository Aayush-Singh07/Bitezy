-- Ensure the users table has the password column for plain-text storage
-- This is used for the "Forgot Password" feature to send the password back to the user.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
