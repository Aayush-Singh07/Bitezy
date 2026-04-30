-- BITEZY DB SEED COMPONENT
-- WARNING: Run this AFTER running supabase_schema.sql

-- Safe ALTER in case it's missing from schema
ALTER TABLE items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Enable UUID extension if not enabled natively
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ZONE 1: Gurgaon (original)
-- ============================================================
INSERT INTO zones (id, center_lat, center_long, radius) 
VALUES ('11111111-1111-1111-1111-111111111111', 28.4595, 77.0266, 600)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ZONE 2: Goa — Chicalim
-- ============================================================
INSERT INTO zones (id, center_lat, center_long, radius)
VALUES ('11111111-1111-1111-1111-222222222222', 15.392085, 73.837243, 2000)
ON CONFLICT DO NOTHING;

-- ============================================================
-- RESTAURANT 1: Bitezy Classics Bakery — Gurgaon (original)
-- ============================================================
INSERT INTO restaurants (id, name, lat, long, open_time, close_time, is_open, zone_id)
VALUES ('22222222-2222-2222-2222-222222222222', 'Bitezy Classics Bakery', 28.4595, 77.0266, '08:00:00', '23:00:00', true, '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RESTAURANT 2: Baked Fusion, Chicalim — GOA
-- ============================================================
INSERT INTO restaurants (id, name, lat, long, open_time, close_time, is_open, zone_id)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Baked Fusion, Chicalim',
  15.392085571573903,
  73.83724327297314,
  '08:00:00',
  '22:00:00',
  true,
  '11111111-1111-1111-1111-222222222222'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ITEMS — Bitezy Classics Bakery (Gurgaon)
-- ============================================================
INSERT INTO items (id, restaurant_id, name, price, type, is_available, image_url, description, category) VALUES
('33333333-3333-3333-3333-333333330001', '22222222-2222-2222-2222-222222222222', 'Classic Samosa (2 pcs)', 30, 'veg', true, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop', 'Two large, golden-brown crispy samosas filled with spiced potato and peas.', 'Savory'),
('33333333-3333-3333-3333-333333330002', '22222222-2222-2222-2222-222222222222', 'Spicy Vada Pav', 35, 'veg', true, 'https://images.unsplash.com/photo-1596450514735-111a2fe02935?w=400&h=400&fit=crop', 'The classic Mumbai street food! Crispy vada in a soft pav with green chutney.', 'Savory'),
('33333333-3333-3333-3333-333333330003', '22222222-2222-2222-2222-222222222222', 'Keema Roll', 69, 'nonveg', true, 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=400&fit=crop', 'Juicy spiced chicken minced keema wrapped in a flaky paratha roll.', 'Savory'),
('33333333-3333-3333-3333-333333330004', '22222222-2222-2222-2222-222222222222', 'Cold Coffee', 59, 'veg', true, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=400&fit=crop', 'Thick, creamy, and chilled frothy coffee blended to perfection.', 'Drinks'),
('33333333-3333-3333-3333-333333330005', '22222222-2222-2222-2222-222222222222', 'Egg Devil', 39, 'nonveg', true, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?w=400&h=400&fit=crop', 'Bite-sized boiled eggs wrapped in a tangy spiced potato coating.', 'Savory'),
('33333333-3333-3333-3333-333333330006', '22222222-2222-2222-2222-222222222222', 'Choco Lava Muffin', 45, 'veg', true, 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=400&h=400&fit=crop', 'Soft and warm chocolate muffin filled with gooey molten chocolate.', 'Sweet'),
('33333333-3333-3333-3333-333333330007', '22222222-2222-2222-2222-222222222222', 'Adrak Masala Chai', 20, 'veg', true, 'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=400&h=400&fit=crop', 'Authentic rich ginger and cardamom infused Indian tea, freshly brewed.', 'Drinks')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ITEMS — Baked Fusion, Chicalim (Goa)
-- ============================================================
INSERT INTO items (id, restaurant_id, name, price, type, is_available, image_url, description, category) VALUES

-- Bakery Specials
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Goan Chorizo Pao', 55, 'nonveg', true,
 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400&h=400&fit=crop',
 'Locally spiced Goan pork chorizo stuffed in a fresh-baked pao. A true Goan classic.', 'Bakery'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Butter Garlic Croissant', 49, 'veg', true,
 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=400&h=400&fit=crop',
 'Flaky, buttery croissant with a rich garlic herb butter filling. Baked fresh every morning.', 'Bakery'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Coconut Jaggery Balls', 35, 'veg', true,
 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop',
 'Traditional Goan sweet — soft coconut milk dough balls with a sweet jaggery-coconut core.', 'Sweet'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Prawn Rissois', 79, 'nonveg', true,
 'https://images.unsplash.com/photo-1509722747487-23d51f4d6e6f?w=400&h=400&fit=crop',
 'Golden-fried Portuguese-Goan pastry stuffed with a creamy prawn béchamel filling. 3 pcs.', 'Savory'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Baked Egg Puffs', 45, 'nonveg', true,
 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop',
 'Crumbly puff pastry generously filled with a spiced masala egg mixture. 2 pcs.', 'Bakery'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Tutti Frutti Cake Slice', 55, 'veg', true,
 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=400&h=400&fit=crop',
 'Classic Goan bakery staple — moist sponge cake dotted with colourful tutti frutti. One thick slice.', 'Sweet'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb07', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Sol Kadhi', 39, 'veg', true,
 'https://images.unsplash.com/photo-1620769004914-e78c80adfb67?w=400&h=400&fit=crop',
 'Refreshing, tangy Goan kokum and coconut milk drink. Naturally digestive and cooling.', 'Drinks'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb08', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Filter Coffee', 29, 'veg', true,
 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop',
 'South Indian style strong filter coffee with frothed milk. The morning essential.', 'Drinks'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb09', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Stuffed Veg Focaccia', 89, 'veg', true,
 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop',
 'Oven-baked focaccia loaded with roasted bell peppers, olives, sundried tomatoes, and herbed cream cheese.', 'Bakery'),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Chicken Xacuti Patty', 69, 'nonveg', true,
 'https://images.unsplash.com/photo-1535400255456-985b16ee5704?w=400&h=400&fit=crop',
 'Spiced Goan Xacuti chicken filling in a short-crust pastry shell. Boldly flavoured.', 'Savory')

ON CONFLICT DO NOTHING;

-- ============================================================
-- COMBOS — Bitezy Classics Bakery (Gurgaon)
-- ============================================================
INSERT INTO combos (id, restaurant_id, name, price, items_json, is_available, image_url, description) VALUES
('44444444-4444-4444-4444-444444440001', '22222222-2222-2222-2222-222222222222',
 'Chai & Samosa Combo', 49,
 '[{"name": "Adrak Masala Chai", "qty": 1}, {"name": "Classic Samosa", "qty": 2}]',
 true,
 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop',
 'The ultimate comfort pairing — piping hot chai with two golden samosas.'),
('44444444-4444-4444-4444-444444440002', '22222222-2222-2222-2222-222222222222',
 'The Muscle Meal', 89,
 '[{"name": "Keema Roll", "qty": 1}, {"name": "Cold Coffee", "qty": 1}]',
 true,
 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=600&h=400&fit=crop',
 'A hearty Keema Roll paired with a thick Frappe Cold Coffee. Fuel up right.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- COMBOS — Baked Fusion, Chicalim (Goa)
-- ============================================================
INSERT INTO combos (id, restaurant_id, name, price, items_json, is_available, image_url, description) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccc01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'The Goa Morning Box', 99,
 '[{"name": "Butter Garlic Croissant", "qty": 1}, {"name": "Filter Coffee", "qty": 1}, {"name": "Tutti Frutti Cake Slice", "qty": 1}]',
 true,
 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&h=400&fit=crop',
 'Start your Goa morning right — a golden croissant, a slice of classic cake and a hot filter coffee.'),

('cccccccc-cccc-cccc-cccc-cccccccccc02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Fusion Bites Platter', 149,
 '[{"name": "Goan Chorizo Pao", "qty": 1}, {"name": "Prawn Rissois", "qty": 3}, {"name": "Sol Kadhi", "qty": 1}]',
 true,
 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop',
 'The ultimate Goan snack spread — Chorizo Pao, Prawn Rissois, and refreshing Sol Kadhi.')

ON CONFLICT DO NOTHING;

-- ============================================================
-- DUMMY RIDER
-- ============================================================
INSERT INTO riders (id, name, phone, vehicle_number, lat, long, is_available) VALUES
('55555555-5555-5555-5555-555555555555', 'Rakesh P.', '+919876543210', 'DL-1C-AA-1111', 28.4590, 77.0260, true)
ON CONFLICT DO NOTHING;
