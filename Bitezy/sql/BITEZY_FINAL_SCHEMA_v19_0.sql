-- ==============================================================================
-- 💂‍♂️ BITEZY FINAL PRODUCTION SCHEMA (v19.0)
-- ==============================================================================
-- This is the complete, consolidated schema including all logistics enhancements,
-- state trackers, and atomic load shields.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & AUTH SYNC
-- ==========================================
CREATE TABLE users (
  id uuid not null PRIMARY KEY REFERENCES auth.users (id),
  name text,
  phone text,
  email text,
  created_at timestamp with time zone default now(),
  last_active timestamp with time zone default now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, phone, name)
  VALUES (new.id, new.email, new.phone, (new.raw_user_meta_data->>'full_name'));
  RETURN new;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. HYPERLOCAL ZONING
-- ==========================================
CREATE TABLE zones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_lat DOUBLE PRECISION,
  center_long DOUBLE PRECISION,
  radius INTEGER DEFAULT 750 -- Defaulting to the 750m Golden Radius
);

-- 3. RESTAURANTS (FULFILLMENT NODES)
-- ==========================================
CREATE TABLE restaurants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  is_open BOOLEAN DEFAULT FALSE,
  current_load INTEGER DEFAULT 0, -- Atomic Load Counter
  image_url TEXT,
  zone_id UUID REFERENCES zones(id)
);

-- 4. INVENTORY (ITEMS & COMBOS)
-- ==========================================
CREATE TABLE items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  description TEXT
);

CREATE TABLE combos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  items_json JSONB,
  is_available BOOLEAN DEFAULT TRUE,
  image_url TEXT
);

-- 5. LOGISTICS (RIDERS & ADDRESSES)
-- ==========================================
CREATE TABLE addresses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  label TEXT, -- Home/Hostel/Work
  address_line TEXT,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE riders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  status TEXT DEFAULT 'OFFLINE' -- AVAILABLE, BUSY, OFFLINE
);

-- 6. STATE MACHINE (ORDERS & ITEMS)
-- ==========================================
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  rider_id UUID REFERENCES riders(id),
  address_id UUID REFERENCES addresses(id),
  
  -- Financials
  total_item_amount INTEGER DEFAULT 0,
  delivery_fee INTEGER DEFAULT 0,
  total_amount INTEGER NOT NULL,
  payment_mode TEXT DEFAULT 'COD',
  
  -- State Tracking
  status TEXT DEFAULT 'PLACED', 
  
  -- Zomato-Grade Lifecycle Markers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  prep_started_at TIMESTAMP WITH TIME ZONE,
  prep_completed_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  arrived_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  estimated_arrival_at TIMESTAMP WITH TIME ZONE,
  
  -- Feedback
  rating INTEGER,
  rating_comment TEXT
);

CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  combo_id UUID REFERENCES combos(id),
  quantity INTEGER DEFAULT 1,
  price INTEGER NOT NULL
);

-- 7. ATOMIC SHIELD (IDEMPOTENCY)
-- ==========================================
CREATE TABLE IF NOT EXISTS order_load_locks (
    order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    incremented_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SECURITY (RLS POLICIES)
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users manage own addresses" ON addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);

-- PUBLIC READS FOR DISCOVERY
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Public Read Items" ON items FOR SELECT USING (true);
