-- BITEZY PRODUCTION SCHEMA

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE users (
  id uuid not null,
  name text null,
  phone text null,
  email text null,
  created_at timestamp with time zone null default now(),
  last_active timestamp with time zone null default now(),
  password text null,
  constraint users_pkey primary key (id),
  constraint users_id_fkey foreign KEY (id) references auth.users (id)
) TABLESPACE pg_default;

-- Trigger to insert row in public.users when auth.user is created
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, phone, name)
  VALUES (
    new.id, 
    new.email, 
    new.phone, 
    (new.raw_user_meta_data->>'full_name')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. ZONES
CREATE TABLE zones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_lat DOUBLE PRECISION,
  center_long DOUBLE PRECISION,
  radius INTEGER DEFAULT 600
);

-- 3. RESTAURANTS
CREATE TABLE restaurants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  open_time TIME,
  close_time TIME,
  is_open BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  zone_id UUID REFERENCES zones(id)
);

-- 4. ITEMS
CREATE TABLE items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  type TEXT, -- veg/nonveg
  is_available BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  description TEXT
);

-- 5. COMBOS
CREATE TABLE combos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  items_json JSONB,
  is_available BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  description TEXT
);

-- 6. ADDRESSES
CREATE TABLE addresses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  label TEXT, -- Home/Hostel
  address_line TEXT,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. RIDERS
CREATE TABLE riders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_number TEXT,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  is_available BOOLEAN DEFAULT FALSE
);

-- 8. CARTS
CREATE TABLE carts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  total_amount INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

-- 9. CART_ITEMS
CREATE TABLE cart_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  combo_id UUID REFERENCES combos(id),
  quantity INTEGER DEFAULT 1,
  price INTEGER NOT NULL
);

-- 10. ORDERS
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  rider_id UUID REFERENCES riders(id),
  address_id UUID REFERENCES addresses(id),
  status TEXT DEFAULT 'PLACED', -- PLACED, PREPARING, OUT_FOR_DELIVERY, DELIVERED
  total_amount INTEGER NOT NULL,
  payment_mode TEXT,
  rating INTEGER DEFAULT NULL,
  rating_comment TEXT DEFAULT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. ORDER_ITEMS
CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  combo_id UUID REFERENCES combos(id),
  quantity INTEGER DEFAULT 1,
  price INTEGER NOT NULL
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;

-- SIMPLE POLICIES
CREATE POLICY "Users can manage their own data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage their addresses" ON addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their carts" ON carts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their order data" ON orders FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage cart_items via cart join" ON cart_items FOR ALL USING (
  EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid())
);

-- Allow public read for catalog
CREATE POLICY "Restaurants are viewable by everyone" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Items are viewable by everyone" ON items FOR SELECT USING (true);
CREATE POLICY "Combos are viewable by everyone" ON combos FOR SELECT USING (true);
