-- ==============================================================================
-- 🔥 BITEZY: GIMMICK PRICING & PROTEIN ENHANCEMENT
-- ==============================================================================
-- Adding psychological pricing (strikethrough) and nutritional labels.
-- ==============================================================================

-- 1. Add Columns to ITEMS
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS gimmick_price INTEGER;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_high_protein BOOLEAN DEFAULT FALSE;

-- 2. Add Columns to COMBOS
ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS gimmick_price INTEGER;
ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS is_high_protein BOOLEAN DEFAULT FALSE;

-- 3. Update Existing Data (Gimmick Pricing = Price + 10)
UPDATE public.items SET gimmick_price = price + 10;
UPDATE public.combos SET gimmick_price = price + 10;

-- 4. Seed Protein Labels (For the Demo, marking certain items as high protein)
UPDATE public.items SET is_high_protein = TRUE 
WHERE name ILIKE '%paneer%' 
OR name ILIKE '%chicken%' 
OR name ILIKE '%egg%' 
OR name ILIKE '%dal%';

UPDATE public.combos SET is_high_protein = TRUE 
WHERE name ILIKE '%power%' 
OR name ILIKE '%protein%';
