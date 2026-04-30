-- ==============================================================================
-- 🔥 BITEZY: HIGHLY REORDERED & COMBO TYPE ENHANCEMENT
-- ==============================================================================
-- Adding real catalog metadata to support premium filtering on the Home Screen.
-- ==============================================================================

-- 1. Add Highly Reordered column to Items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS highly_reordered BOOLEAN DEFAULT FALSE;

-- 2. Add Highly Reordered column to Combos
ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS highly_reordered BOOLEAN DEFAULT FALSE;

-- 3. Add Type column to Combos (to support Pure Veg filter)
ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'veg';

-- 4. Mark some existing items as Highly Reordered (Example for demo)
UPDATE public.items SET highly_reordered = TRUE WHERE name ILIKE '%samosa%' OR name ILIKE '%chai%';
UPDATE public.combos SET highly_reordered = TRUE WHERE name ILIKE '%power%' OR name ILIKE '%mega%';
