CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- CGCC Cafeteria Express - Full Consolidated Database Setup Script
-- Combines all 28 Supabase baseline migrations + 9 security & feature migrations
-- Generated for direct execution in the Supabase SQL Editor.
-- =====================================================================

-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- ---------------------------------------------------------------------
-- Migration 1 of 37: 20260708132103_3f9b678b-0c4f-49ab-9ee8-5e0e7ab9518b.sql
-- ---------------------------------------------------------------------

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories readable" ON public.categories;
DROP POLICY IF EXISTS "categories readable" ON public.categories;
CREATE POLICY "categories readable" ON public.categories FOR SELECT USING (true);

-- Menu items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id text PRIMARY KEY,
  category_id text NOT NULL REFERENCES public.categories(id),
  name text NOT NULL,
  price integer NOT NULL,
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu readable" ON public.menu_items;
DROP POLICY IF EXISTS "menu readable" ON public.menu_items;
CREATE POLICY "menu readable" ON public.menu_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "menu updatable" ON public.menu_items;
DROP POLICY IF EXISTS "menu updatable" ON public.menu_items;
CREATE POLICY "menu updatable" ON public.menu_items FOR UPDATE USING (true) WITH CHECK (true);

-- App settings (single row)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  ordering_open boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings readable" ON public.app_settings;
DROP POLICY IF EXISTS "settings readable" ON public.app_settings;
CREATE POLICY "settings readable" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings insertable" ON public.app_settings;
DROP POLICY IF EXISTS "settings insertable" ON public.app_settings;
CREATE POLICY "settings insertable" ON public.app_settings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "settings updatable" ON public.app_settings;
DROP POLICY IF EXISTS "settings updatable" ON public.app_settings;
CREATE POLICY "settings updatable" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);

-- Customers (kept for future use; orders currently store customer inline)
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_key UNIQUE (phone)
);
GRANT SELECT, INSERT, UPDATE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers readable" ON public.customers;
DROP POLICY IF EXISTS "customers readable" ON public.customers;
CREATE POLICY "customers readable" ON public.customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "customers insertable" ON public.customers;
DROP POLICY IF EXISTS "customers insertable" ON public.customers;
CREATE POLICY "customers insertable" ON public.customers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "customers updatable" ON public.customers;
DROP POLICY IF EXISTS "customers updatable" ON public.customers;
CREATE POLICY "customers updatable" ON public.customers FOR UPDATE USING (true) WITH CHECK (true);

-- Orders
CREATE SEQUENCE IF NOT EXISTS public.order_code_seq;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  receipt_no text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id),
  customer_name text NOT NULL,
  phone text NOT NULL,
  note text,
  order_type text NOT NULL CHECK (order_type IN ('dine-in','takeaway')),
  total integer NOT NULL,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid','unpaid')),
  pickup_status text NOT NULL DEFAULT 'pending' CHECK (pickup_status IN ('pending','confirmed','preparing','ready','collected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders readable" ON public.orders;
DROP POLICY IF EXISTS "orders readable" ON public.orders;
CREATE POLICY "orders readable" ON public.orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "orders insertable" ON public.orders;
DROP POLICY IF EXISTS "orders insertable" ON public.orders;
CREATE POLICY "orders insertable" ON public.orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "orders updatable" ON public.orders;
DROP POLICY IF EXISTS "orders updatable" ON public.orders;
CREATE POLICY "orders updatable" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id text REFERENCES public.menu_items(id),
  name text NOT NULL,
  price integer NOT NULL,
  qty integer NOT NULL
);
GRANT SELECT, INSERT ON public.order_items TO anon, authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items readable" ON public.order_items;
DROP POLICY IF EXISTS "order_items readable" ON public.order_items;
CREATE POLICY "order_items readable" ON public.order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "order_items insertable" ON public.order_items;
DROP POLICY IF EXISTS "order_items insertable" ON public.order_items;
CREATE POLICY "order_items insertable" ON public.order_items FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

-- Auto-generate order code and receipt number
CREATE OR REPLACE FUNCTION public.set_order_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CG-' || lpad(nextval('public.order_code_seq')::text, 3, '0');
  END IF;
  IF NEW.receipt_no IS NULL OR NEW.receipt_no = '' THEN
    NEW.receipt_no := 'R' || right((extract(epoch FROM now())::bigint)::text, 8);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS set_order_code_trg ON public.orders;
CREATE TRIGGER set_order_code_trg
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_code();

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- Migration 2 of 37: 20260709101221_4a24a6f2-7928-440f-890b-3ae7d029b411.sql
-- ---------------------------------------------------------------------

-- 1. Role enum + user_roles table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin',
      'moderator',
      'user',
      'food_vendor',
      'snacks_vendor',
      'coffee_vendor',
      'drinks_vendor',
      'cashier'
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. has_role security-definer function (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Tighten RLS on existing tables

-- categories: public read only
DROP POLICY IF EXISTS "categories readable" ON public.categories;
DROP POLICY IF EXISTS "categories readable" ON public.categories;
CREATE POLICY "categories readable" ON public.categories
  FOR SELECT TO anon, authenticated USING (true);

-- menu_items: public read; admin update
DROP POLICY IF EXISTS "menu readable" ON public.menu_items;
DROP POLICY IF EXISTS "menu updatable" ON public.menu_items;
DROP POLICY IF EXISTS "menu readable" ON public.menu_items;
CREATE POLICY "menu readable" ON public.menu_items
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin updates menu" ON public.menu_items;
DROP POLICY IF EXISTS "admin updates menu" ON public.menu_items;
CREATE POLICY "admin updates menu" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- app_settings: public read; admin insert/update
DROP POLICY IF EXISTS "settings readable" ON public.app_settings;
DROP POLICY IF EXISTS "settings insertable" ON public.app_settings;
DROP POLICY IF EXISTS "settings updatable" ON public.app_settings;
DROP POLICY IF EXISTS "settings readable" ON public.app_settings;
CREATE POLICY "settings readable" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin inserts settings" ON public.app_settings;
DROP POLICY IF EXISTS "admin inserts settings" ON public.app_settings;
CREATE POLICY "admin inserts settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin updates settings" ON public.app_settings;
DROP POLICY IF EXISTS "admin updates settings" ON public.app_settings;
CREATE POLICY "admin updates settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- customers: anyone can insert or update-by-phone during checkout; only admins can read the list
DROP POLICY IF EXISTS "customers insertable" ON public.customers;
DROP POLICY IF EXISTS "customers readable" ON public.customers;
DROP POLICY IF EXISTS "customers updatable" ON public.customers;
DROP POLICY IF EXISTS "public inserts customers" ON public.customers;
DROP POLICY IF EXISTS "public inserts customers" ON public.customers;
CREATE POLICY "public inserts customers" ON public.customers
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public updates customers" ON public.customers;
DROP POLICY IF EXISTS "public updates customers" ON public.customers;
CREATE POLICY "public updates customers" ON public.customers
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin reads customers" ON public.customers;
DROP POLICY IF EXISTS "admin reads customers" ON public.customers;
CREATE POLICY "admin reads customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- orders: anyone can create; only admins can view or update
DROP POLICY IF EXISTS "orders insertable" ON public.orders;
DROP POLICY IF EXISTS "orders readable" ON public.orders;
DROP POLICY IF EXISTS "orders updatable" ON public.orders;
DROP POLICY IF EXISTS "public inserts orders" ON public.orders;
DROP POLICY IF EXISTS "public inserts orders" ON public.orders;
CREATE POLICY "public inserts orders" ON public.orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin reads orders" ON public.orders;
DROP POLICY IF EXISTS "admin reads orders" ON public.orders;
CREATE POLICY "admin reads orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin updates orders" ON public.orders;
DROP POLICY IF EXISTS "admin updates orders" ON public.orders;
CREATE POLICY "admin updates orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- order_items: anyone can insert (during checkout); only admins can view
DROP POLICY IF EXISTS "order_items insertable" ON public.order_items;
DROP POLICY IF EXISTS "order_items readable" ON public.order_items;
DROP POLICY IF EXISTS "public inserts order_items" ON public.order_items;
DROP POLICY IF EXISTS "public inserts order_items" ON public.order_items;
CREATE POLICY "public inserts order_items" ON public.order_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin reads order_items" ON public.order_items;
DROP POLICY IF EXISTS "admin reads order_items" ON public.order_items;
CREATE POLICY "admin reads order_items" ON public.order_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Revoke broad anon SELECT on orders/customers/order_items that used to exist
REVOKE SELECT ON public.orders FROM anon;
REVOKE SELECT ON public.order_items FROM anon;
REVOKE SELECT ON public.customers FROM anon;
REVOKE UPDATE ON public.orders FROM anon;
REVOKE UPDATE ON public.menu_items FROM anon;
REVOKE UPDATE ON public.app_settings FROM anon;
REVOKE INSERT ON public.app_settings FROM anon;


-- ---------------------------------------------------------------------
-- Migration 3 of 37: 20260710095345_147195cd-7fa7-4c77-bf4c-4f40bd4bebb2.sql
-- ---------------------------------------------------------------------

-- 1. Remove permissive public UPDATE on customers (PII tampering risk)
DROP POLICY IF EXISTS "public updates customers" ON public.customers;

DROP POLICY IF EXISTS "admin updates customers" ON public.customers;
CREATE POLICY "admin updates customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Lock down SECURITY DEFINER functions from direct API execution.
-- has_role is only needed inside RLS policies (evaluated with definer rights),
-- and set_order_code is a trigger function.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_code() FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------
-- Migration 4 of 37: 20260710095735_2c4a65da-d61d-450a-a578-aa297b9bbdc8.sql
-- ---------------------------------------------------------------------

-- Enforce authoritative pricing server-side.

-- 1. Overwrite submitted price with the real menu price; reject invalid items.
CREATE OR REPLACE FUNCTION public.enforce_order_item_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_price INTEGER;
  real_name TEXT;
  is_available BOOLEAN;
BEGIN
  IF NEW.menu_item_id IS NULL THEN
    RAISE EXCEPTION 'menu_item_id is required';
  END IF;

  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN
    RAISE EXCEPTION 'qty must be positive';
  END IF;

  SELECT price, name, available
    INTO real_price, real_name, is_available
  FROM public.menu_items
  WHERE id = NEW.menu_item_id;

  IF real_price IS NULL THEN
    RAISE EXCEPTION 'Unknown menu item: %', NEW.menu_item_id;
  END IF;

  IF NOT is_available THEN
    RAISE EXCEPTION 'Menu item is not available: %', NEW.menu_item_id;
  END IF;

  NEW.price := real_price;
  NEW.name := real_name;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_order_item_price() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_enforce_price ON public.order_items;
CREATE TRIGGER order_items_enforce_price
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_price();

-- 2. Recompute the parent order's total from its items after any change.
CREATE OR REPLACE FUNCTION public.recompute_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_order_id UUID;
BEGIN
  target_order_id := COALESCE(NEW.order_id, OLD.order_id);
  UPDATE public.orders
     SET total = COALESCE((
       SELECT SUM(price * qty)::INTEGER
       FROM public.order_items
       WHERE order_id = target_order_id
     ), 0)
   WHERE id = target_order_id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_order_total() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_recompute_total ON public.order_items;
CREATE TRIGGER order_items_recompute_total
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_order_total();

-- 3. Zero out orders.total on insert; it will be recomputed from real item prices.
CREATE OR REPLACE FUNCTION public.reset_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total := 0;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_order_total() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_reset_total ON public.orders;
CREATE TRIGGER orders_reset_total
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.reset_order_total();


-- ---------------------------------------------------------------------
-- Migration 5 of 37: 20260710122239_1953d543-0a17-4145-8e2c-79207305f731.sql
-- ---------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;


-- ---------------------------------------------------------------------
-- Migration 6 of 37: 20260710125837_69410763-49f4-437a-ae6f-5c90f582d2d1.sql
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_customer_order(
  _customer_name TEXT,
  _phone TEXT,
  _note TEXT,
  _order_type TEXT,
  _items JSONB
)
RETURNS TABLE (id UUID, code TEXT, receipt_no TEXT, total INTEGER, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_order_id UUID;
  item JSONB;
BEGIN
  IF _customer_name IS NULL OR length(btrim(_customer_name)) = 0 THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  IF _phone IS NULL OR length(btrim(_phone)) = 0 THEN
    RAISE EXCEPTION 'phone is required';
  END IF;
  IF _order_type NOT IN ('dine-in', 'takeaway') THEN
    RAISE EXCEPTION 'invalid order_type';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'at least one item is required';
  END IF;

  INSERT INTO public.orders (customer_name, phone, note, order_type, total, code, receipt_no)
  VALUES (
    btrim(_customer_name),
    btrim(_phone),
    NULLIF(btrim(COALESCE(_note, '')), ''),
    _order_type,
    0,
    '',
    ''
  )
  RETURNING orders.id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, qty)
    VALUES (
      new_order_id,
      item->>'id',
      COALESCE(item->>'name', ''),
      COALESCE((item->>'price')::INTEGER, 0),
      COALESCE((item->>'qty')::INTEGER, 0)
    );
  END LOOP;

  RETURN QUERY
  SELECT o.id, o.code, o.receipt_no, o.total, o.created_at
  FROM public.orders o
  WHERE o.id = new_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_order(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- Migration 7 of 37: 20260711041231_bffddcf7-554e-4a92-b383-7dd4533637b3.sql
-- ---------------------------------------------------------------------

-- 1) Harden create_customer_order: ignore client-supplied prices/names.
-- Prices and names are fetched from menu_items server-side.
CREATE OR REPLACE FUNCTION public.create_customer_order(
  _customer_name TEXT,
  _phone TEXT,
  _note TEXT,
  _order_type TEXT,
  _items JSONB
)
RETURNS TABLE (id UUID, code TEXT, receipt_no TEXT, total INTEGER, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_order_id UUID;
  item JSONB;
  item_id TEXT;
  item_qty INTEGER;
BEGIN
  IF _customer_name IS NULL OR length(btrim(_customer_name)) = 0 THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  IF _phone IS NULL OR length(btrim(_phone)) = 0 THEN
    RAISE EXCEPTION 'phone is required';
  END IF;
  IF _order_type NOT IN ('dine-in', 'takeaway') THEN
    RAISE EXCEPTION 'invalid order_type';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'at least one item is required';
  END IF;

  INSERT INTO public.orders (customer_name, phone, note, order_type, total, code, receipt_no)
  VALUES (
    btrim(_customer_name),
    btrim(_phone),
    NULLIF(btrim(COALESCE(_note, '')), ''),
    _order_type,
    0,
    '',
    ''
  )
  RETURNING orders.id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    item_id := item->>'id';
    item_qty := COALESCE((item->>'qty')::INTEGER, 0);
    IF item_id IS NULL OR item_qty <= 0 THEN
      RAISE EXCEPTION 'invalid item entry';
    END IF;
    -- price and name are enforced by enforce_order_item_price trigger
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, qty)
    VALUES (new_order_id, item_id, '', 0, item_qty);
  END LOOP;

  RETURN QUERY
  SELECT o.id, o.code, o.receipt_no, o.total, o.created_at
  FROM public.orders o
  WHERE o.id = new_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_order(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- 2) Public receipt lookup by order code (no PII exposure beyond the receipt data itself).
CREATE OR REPLACE FUNCTION public.get_order_by_code(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'code', o.code,
    'receipt_no', o.receipt_no,
    'customer_name', o.customer_name,
    'phone', o.phone,
    'note', o.note,
    'order_type', o.order_type,
    'total', o.total,
    'payment_status', o.payment_status,
    'pickup_status', o.pickup_status,
    'created_at', o.created_at,
    'order_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'menu_item_id', oi.menu_item_id,
        'name', oi.name,
        'price', oi.price,
        'qty', oi.qty
      ) ORDER BY oi.name)
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.orders o
  WHERE o.code = btrim(_code);

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_code(TEXT) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- Migration 8 of 37: 20260717115955_79b05b4a-3636-4f3f-9ec8-6c22c3123e53.sql
-- ---------------------------------------------------------------------

-- 1. Extend app_role enum with vendor roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'food_vendor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'snacks_vendor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coffee_vendor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'drinks_vendor';


-- ---------------------------------------------------------------------
-- Migration 9 of 37: 20260717120056_1edb8e43-f5c9-4dce-bcbc-f2fbfb40b419.sql
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_type text NOT NULL UNIQUE CHECK (vendor_type IN ('food','snacks','coffee','drinks')),
  username text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages vendors" ON public.vendors;
DROP POLICY IF EXISTS "admin manages vendors" ON public.vendors;
CREATE POLICY "admin manages vendors" ON public.vendors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "vendor reads self" ON public.vendors;
DROP POLICY IF EXISTS "vendor reads self" ON public.vendors;
CREATE POLICY "vendor reads self" ON public.vendors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.vendor_type_for_user(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vendor_type FROM public.vendors
   WHERE user_id = _user_id AND active = true LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.vendor_type_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_type_for_user(uuid) TO authenticated, service_role;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS vendor_type text
    CHECK (vendor_type IN ('food','snacks','coffee','drinks'));

UPDATE public.menu_items SET vendor_type = CASE
  WHEN category_id IN ('meals','proteins','soups_sides','sandwiches','small_chops','extras') THEN 'food'
  WHEN category_id IN ('snacks_pastries','desserts_yogurt') THEN 'snacks'
  WHEN category_id = 'coffee_tea' THEN 'coffee'
  WHEN category_id IN ('drinks','water') THEN 'drinks'
  ELSE 'food'
END
WHERE vendor_type IS NULL;

ALTER TABLE public.menu_items ALTER COLUMN vendor_type SET NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS vendor_type text
    CHECK (vendor_type IN ('food','snacks','coffee','drinks'));

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS preparation_status text NOT NULL DEFAULT 'pending'
    CHECK (preparation_status IN ('pending','preparing','ready','collected'));

UPDATE public.order_items oi
   SET vendor_type = mi.vendor_type
  FROM public.menu_items mi
 WHERE oi.menu_item_id = mi.id AND oi.vendor_type IS NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_time text;

CREATE OR REPLACE FUNCTION public.enforce_order_item_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  real_price INTEGER; real_name TEXT; real_vendor TEXT; is_available BOOLEAN;
BEGIN
  IF NEW.menu_item_id IS NULL THEN RAISE EXCEPTION 'menu_item_id is required'; END IF;
  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;
  SELECT price, name, available, vendor_type
    INTO real_price, real_name, is_available, real_vendor
    FROM public.menu_items WHERE id = NEW.menu_item_id;
  IF real_price IS NULL THEN RAISE EXCEPTION 'Unknown menu item: %', NEW.menu_item_id; END IF;
  IF NOT is_available THEN RAISE EXCEPTION 'Menu item is not available: %', NEW.menu_item_id; END IF;
  NEW.price := real_price; NEW.name := real_name; NEW.vendor_type := real_vendor;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_by_code(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
DECLARE result JSONB;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'id', o.id, 'code', o.code, 'receipt_no', o.receipt_no,
    'customer_name', o.customer_name, 'phone', o.phone, 'note', o.note,
    'order_type', o.order_type, 'pickup_time', o.pickup_time,
    'total', o.total, 'payment_status', o.payment_status,
    'pickup_status', o.pickup_status, 'created_at', o.created_at,
    'order_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'menu_item_id', oi.menu_item_id, 'name', oi.name, 'price', oi.price, 'qty', oi.qty,
        'vendor_type', oi.vendor_type, 'preparation_status', oi.preparation_status
      ) ORDER BY oi.name)
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  ) INTO result FROM public.orders o WHERE o.code = btrim(_code);
  RETURN result;
END;
$function$;

DROP POLICY IF EXISTS "vendor reads own order items" ON public.order_items;
DROP POLICY IF EXISTS "vendor reads own order items" ON public.order_items;
CREATE POLICY "vendor reads own order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (vendor_type IS NOT NULL AND vendor_type = public.vendor_type_for_user(auth.uid()));

DROP POLICY IF EXISTS "vendor reads relevant orders" ON public.orders;
DROP POLICY IF EXISTS "vendor reads relevant orders" ON public.orders;
CREATE POLICY "vendor reads relevant orders" ON public.orders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi
     WHERE oi.order_id = orders.id
       AND oi.vendor_type = public.vendor_type_for_user(auth.uid())
  ));

DROP POLICY IF EXISTS "vendor updates own prep status" ON public.order_items;
DROP POLICY IF EXISTS "vendor updates own prep status" ON public.order_items;
CREATE POLICY "vendor updates own prep status" ON public.order_items
  FOR UPDATE TO authenticated
  USING (vendor_type IS NOT NULL AND vendor_type = public.vendor_type_for_user(auth.uid()))
  WITH CHECK (vendor_type IS NOT NULL AND vendor_type = public.vendor_type_for_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS vendors_touch_updated_at ON public.vendors;
CREATE TRIGGER vendors_touch_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------------------------------------------------------------------
-- Migration 10 of 37: 20260725072515_d79fbf1d-c708-45d2-9b03-5ccddf8b0cfb.sql
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_customer_order(
  _customer_name TEXT,
  _phone TEXT,
  _note TEXT,
  _order_type TEXT,
  _items JSONB,
  _pickup_time TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, code TEXT, receipt_no TEXT, total INTEGER, created_at TIMESTAMPTZ, pickup_time TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_order_id UUID;
  item JSONB;
  item_id TEXT;
  item_qty INTEGER;
  clean_pickup TEXT;
BEGIN
  IF _customer_name IS NULL OR length(btrim(_customer_name)) = 0 THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  IF _phone IS NULL OR length(btrim(_phone)) = 0 THEN
    RAISE EXCEPTION 'phone is required';
  END IF;
  IF _order_type NOT IN ('dine-in', 'takeaway') THEN
    RAISE EXCEPTION 'invalid order_type';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'at least one item is required';
  END IF;

  clean_pickup := NULLIF(btrim(COALESCE(_pickup_time, '')), '');
  IF clean_pickup IS NULL THEN
    RAISE EXCEPTION 'pickup_time is required';
  END IF;
  IF length(clean_pickup) > 20 THEN
    RAISE EXCEPTION 'pickup_time too long';
  END IF;

  INSERT INTO public.orders (customer_name, phone, note, order_type, pickup_time, total, code, receipt_no)
  VALUES (
    btrim(_customer_name),
    btrim(_phone),
    NULLIF(btrim(COALESCE(_note, '')), ''),
    _order_type,
    clean_pickup,
    0,
    '',
    ''
  )
  RETURNING orders.id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    item_id := item->>'id';
    item_qty := COALESCE((item->>'qty')::INTEGER, 0);
    IF item_id IS NULL OR item_qty <= 0 THEN
      RAISE EXCEPTION 'invalid item entry';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, qty)
    VALUES (new_order_id, item_id, '', 0, item_qty);
  END LOOP;

  RETURN QUERY
  SELECT o.id, o.code, o.receipt_no, o.total, o.created_at, o.pickup_time
  FROM public.orders o
  WHERE o.id = new_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- Migration 11 of 37: 20260725075608_92c6f507-bbcc-4a62-96ea-f51914a57976.sql
-- ---------------------------------------------------------------------

-- 1. Expand payment_status allowed values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid','pending','paid','failed','cancelled','refunded'));

-- 2. Add payment tracking columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_amount integer,
  ADD COLUMN IF NOT EXISTS payment_meta jsonb,
  ADD COLUMN IF NOT EXISTS payment_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_key
  ON public.orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 3. Add payment_config to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS payment_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Update get_order_by_code to expose new payment fields
CREATE OR REPLACE FUNCTION public.get_order_by_code(_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result JSONB;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'id', o.id, 'code', o.code, 'receipt_no', o.receipt_no,
    'customer_name', o.customer_name, 'phone', o.phone, 'note', o.note,
    'order_type', o.order_type, 'pickup_time', o.pickup_time,
    'total', o.total, 'payment_status', o.payment_status,
    'payment_provider', o.payment_provider,
    'payment_reference', o.payment_reference,
    'pickup_status', o.pickup_status, 'created_at', o.created_at,
    'order_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'menu_item_id', oi.menu_item_id, 'name', oi.name, 'price', oi.price, 'qty', oi.qty,
        'vendor_type', oi.vendor_type, 'preparation_status', oi.preparation_status
      ) ORDER BY oi.name)
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  ) INTO result FROM public.orders o WHERE o.code = btrim(_code);
  RETURN result;
END;
$function$;

-- 5. Apply verified payment result (idempotent). Callable by anon so the
-- customer's browser can finalize a simulated (Test Mode) payment; on real
-- webhooks the server route should also call this after verifying the signature.
-- Amount verification prevents client from marking a cheaper order paid.
CREATE OR REPLACE FUNCTION public.apply_payment_result(
  _code text,
  _reference text,
  _status text,
  _provider text,
  _amount integer,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  existing public.orders%ROWTYPE;
  new_pickup text;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN RAISE EXCEPTION 'code required'; END IF;
  IF _reference IS NULL OR length(btrim(_reference)) = 0 THEN RAISE EXCEPTION 'reference required'; END IF;
  IF _status NOT IN ('pending','paid','failed','cancelled','refunded') THEN
    RAISE EXCEPTION 'invalid status: %', _status;
  END IF;

  SELECT * INTO existing FROM public.orders WHERE code = btrim(_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found: %', _code; END IF;

  -- Idempotency: same reference + status = no-op
  IF existing.payment_reference IS NOT NULL
     AND existing.payment_reference = _reference
     AND existing.payment_status = _status THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'code', existing.code, 'payment_status', existing.payment_status);
  END IF;

  -- Reject reference collision across different orders
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE payment_reference = _reference AND code <> existing.code
  ) THEN
    RAISE EXCEPTION 'payment reference already used by another order';
  END IF;

  -- Amount verification for paid state
  IF _status = 'paid' AND _amount IS NOT NULL AND _amount <> existing.total THEN
    RAISE EXCEPTION 'amount mismatch: expected %, got %', existing.total, _amount;
  END IF;

  -- Advance pickup status on success
  new_pickup := existing.pickup_status;
  IF _status = 'paid' AND existing.pickup_status = 'pending' THEN
    new_pickup := 'confirmed';
  END IF;

  UPDATE public.orders SET
    payment_status = _status,
    payment_provider = COALESCE(_provider, payment_provider),
    payment_reference = _reference,
    payment_amount = COALESCE(_amount, payment_amount),
    payment_meta = COALESCE(_meta, payment_meta),
    payment_updated_at = now(),
    pickup_status = new_pickup
  WHERE id = existing.id;

  RETURN jsonb_build_object('ok', true, 'code', existing.code, 'payment_status', _status);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payment_result(text, text, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payment_result(text, text, text, text, integer, jsonb) TO anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- Migration 12 of 37: 20260725084455_aebe1bed-1ec8-4c21-9243-6dd630fd8d2f.sql
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_orders_by_phone(_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean text;
  result jsonb;
BEGIN
  clean := btrim(COALESCE(_phone, ''));
  IF length(clean) < 6 THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO result
  FROM (
    SELECT o.code, o.receipt_no, o.customer_name, o.pickup_time,
           o.total, o.payment_status, o.pickup_status, o.created_at
    FROM public.orders o
    WHERE o.phone = clean
    ORDER BY o.created_at DESC
    LIMIT 100
  ) t;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_orders_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orders_by_phone(text) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- Migration 13 of 37: 20260725114245_8e30bbd1-b595-4df6-bd8a-d56772beb7a2.sql
-- ---------------------------------------------------------------------

-- 1) menu_items: stock columns
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS stock_qty INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 10;

-- 2) Add cashier role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='cashier' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'cashier';
  END IF;
END$$;

-- 3) Vendor UPDATE rights on their own category's menu_items (stock + available)
DROP POLICY IF EXISTS "vendor updates own menu items" ON public.menu_items;
DROP POLICY IF EXISTS "vendor updates own menu items" ON public.menu_items;
CREATE POLICY "vendor updates own menu items" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (vendor_type IS NOT NULL AND vendor_type = public.vendor_type_for_user(auth.uid()))
  WITH CHECK (vendor_type IS NOT NULL AND vendor_type = public.vendor_type_for_user(auth.uid()));

-- 4) inventory_history
CREATE TABLE IF NOT EXISTS public.inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id TEXT NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  vendor_type TEXT,
  previous_qty INTEGER NOT NULL,
  new_qty INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- manual | online_order | walk_in | admin_override | auto
  changed_by UUID,
  changed_by_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_history_item_idx ON public.inventory_history(menu_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_history_vendor_idx ON public.inventory_history(vendor_type, created_at DESC);

GRANT SELECT ON public.inventory_history TO authenticated;
GRANT ALL ON public.inventory_history TO service_role;
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin reads inventory history" ON public.inventory_history;
DROP POLICY IF EXISTS "admin reads inventory history" ON public.inventory_history;
CREATE POLICY "admin reads inventory history" ON public.inventory_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "vendor reads own inventory history" ON public.inventory_history;
DROP POLICY IF EXISTS "vendor reads own inventory history" ON public.inventory_history;
CREATE POLICY "vendor reads own inventory history" ON public.inventory_history
  FOR SELECT TO authenticated
  USING (vendor_type IS NOT NULL AND vendor_type = public.vendor_type_for_user(auth.uid()));

-- 5) cashier_sales tables
CREATE SEQUENCE IF NOT EXISTS public.cashier_sale_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.cashier_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  receipt_no TEXT NOT NULL UNIQUE,
  cashier_id UUID NOT NULL,
  cashier_label TEXT,
  customer_name TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','pos','transfer','opay')),
  total INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cashier_sales_created_idx ON public.cashier_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS cashier_sales_cashier_idx ON public.cashier_sales(cashier_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cashier_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.cashier_sales(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES public.menu_items(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  vendor_type TEXT
);
CREATE INDEX IF NOT EXISTS cashier_sale_items_sale_idx ON public.cashier_sale_items(sale_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashier_sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashier_sale_items TO authenticated;
GRANT ALL ON public.cashier_sales TO service_role;
GRANT ALL ON public.cashier_sale_items TO service_role;

ALTER TABLE public.cashier_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cashier reads own sales" ON public.cashier_sales;
DROP POLICY IF EXISTS "cashier reads own sales" ON public.cashier_sales;
CREATE POLICY "cashier reads own sales" ON public.cashier_sales
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin manages sales" ON public.cashier_sales;
DROP POLICY IF EXISTS "admin manages sales" ON public.cashier_sales;
CREATE POLICY "admin manages sales" ON public.cashier_sales
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "cashier reads own sale items" ON public.cashier_sale_items;
DROP POLICY IF EXISTS "cashier reads own sale items" ON public.cashier_sale_items;
CREATE POLICY "cashier reads own sale items" ON public.cashier_sale_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cashier_sales s WHERE s.id = sale_id AND (s.cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
DROP POLICY IF EXISTS "admin manages sale items" ON public.cashier_sale_items;
DROP POLICY IF EXISTS "admin manages sale items" ON public.cashier_sale_items;
CREATE POLICY "admin manages sale items" ON public.cashier_sale_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Vendors read items in their category (for realtime + reporting)
DROP POLICY IF EXISTS "vendor reads own sale items" ON public.cashier_sale_items;
DROP POLICY IF EXISTS "vendor reads own sale items" ON public.cashier_sale_items;
CREATE POLICY "vendor reads own sale items" ON public.cashier_sale_items
  FOR SELECT TO authenticated
  USING (vendor_type IS NOT NULL AND vendor_type = public.vendor_type_for_user(auth.uid()));

-- 6) Enforce trusted price/name on cashier_sale_items (mirrors order_items)
CREATE OR REPLACE FUNCTION public.enforce_cashier_sale_item_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_price INTEGER; real_name TEXT; real_vendor TEXT; is_available BOOLEAN;
BEGIN
  IF NEW.menu_item_id IS NULL THEN RAISE EXCEPTION 'menu_item_id is required'; END IF;
  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;
  SELECT price, name, available, vendor_type
    INTO real_price, real_name, is_available, real_vendor
    FROM public.menu_items WHERE id = NEW.menu_item_id;
  IF real_price IS NULL THEN RAISE EXCEPTION 'Unknown menu item: %', NEW.menu_item_id; END IF;
  IF NOT is_available THEN RAISE EXCEPTION 'Menu item is not available: %', NEW.menu_item_id; END IF;
  NEW.price := real_price; NEW.name := real_name; NEW.vendor_type := real_vendor;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cashier_sale_item_price ON public.cashier_sale_items;
CREATE TRIGGER cashier_sale_item_price BEFORE INSERT ON public.cashier_sale_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_cashier_sale_item_price();

-- 7) Recompute cashier_sales.total
CREATE OR REPLACE FUNCTION public.recompute_cashier_sale_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_sale_id UUID;
BEGIN
  target_sale_id := COALESCE(NEW.sale_id, OLD.sale_id);
  UPDATE public.cashier_sales
     SET total = COALESCE((SELECT SUM(price*qty)::INTEGER FROM public.cashier_sale_items WHERE sale_id = target_sale_id), 0)
   WHERE id = target_sale_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS cashier_sale_item_total ON public.cashier_sale_items;
CREATE TRIGGER cashier_sale_item_total AFTER INSERT OR UPDATE OR DELETE ON public.cashier_sale_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_cashier_sale_total();

-- 8) Stock decrement + history logging trigger (used by both order_items and cashier_sale_items)
CREATE OR REPLACE FUNCTION public.decrement_stock_from_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_qty INTEGER;
  next_qty INTEGER;
  cur_available BOOLEAN;
  it_name TEXT;
  it_vendor TEXT;
  src TEXT;
BEGIN
  IF TG_TABLE_NAME = 'order_items' THEN
    src := 'online_order';
  ELSE
    src := 'walk_in';
  END IF;

  SELECT stock_qty, available, name, vendor_type
    INTO prev_qty, cur_available, it_name, it_vendor
    FROM public.menu_items WHERE id = NEW.menu_item_id
    FOR UPDATE;

  IF prev_qty IS NULL THEN
    RETURN NEW; -- unknown item; enforce trigger will have already rejected
  END IF;

  next_qty := GREATEST(prev_qty - NEW.qty, 0);

  UPDATE public.menu_items
     SET stock_qty = next_qty,
         available = CASE WHEN next_qty <= 0 THEN false ELSE available END
   WHERE id = NEW.menu_item_id;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by, changed_by_label)
  VALUES
    (NEW.menu_item_id, it_name, it_vendor, prev_qty, next_qty, next_qty - prev_qty,
     CASE WHEN src='online_order' THEN 'Online order' ELSE 'Walk-in sale' END,
     src, auth.uid(), NULL);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_item_decrement_stock ON public.order_items;
CREATE TRIGGER order_item_decrement_stock AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_from_sale();

DROP TRIGGER IF EXISTS cashier_sale_item_decrement_stock ON public.cashier_sale_items;
CREATE TRIGGER cashier_sale_item_decrement_stock AFTER INSERT ON public.cashier_sale_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_from_sale();

-- 9) adjust_stock RPC (admin or matching vendor)
CREATE OR REPLACE FUNCTION public.adjust_stock(_item_id TEXT, _new_qty INTEGER, _reason TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_qty INTEGER; it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  is_admin BOOLEAN;
  caller_vendor TEXT;
  src TEXT;
BEGIN
  IF _new_qty IS NULL OR _new_qty < 0 THEN RAISE EXCEPTION 'new qty must be >= 0'; END IF;

  SELECT stock_qty, name, vendor_type, available
    INTO prev_qty, it_name, it_vendor, cur_available
    FROM public.menu_items WHERE id = _item_id
    FOR UPDATE;
  IF prev_qty IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());

  IF NOT is_admin AND (caller_vendor IS NULL OR caller_vendor <> it_vendor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;

  UPDATE public.menu_items
     SET stock_qty = _new_qty,
         available = CASE WHEN _new_qty <= 0 THEN false
                          WHEN _new_qty > 0 AND cur_available = false AND prev_qty <= 0 THEN true
                          ELSE cur_available END
   WHERE id = _item_id;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES
    (_item_id, it_name, it_vendor, prev_qty, _new_qty, _new_qty - prev_qty,
     NULLIF(btrim(COALESCE(_reason,'')), ''), src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'previous', prev_qty, 'new', _new_qty);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_stock(TEXT, INTEGER, TEXT) TO authenticated;

-- 10) create_cashier_sale RPC
CREATE OR REPLACE FUNCTION public.create_cashier_sale(
  _payment_method TEXT,
  _customer_name TEXT,
  _note TEXT,
  _items JSONB
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  item JSONB;
  item_id TEXT;
  item_qty INTEGER;
  gen_code TEXT;
  gen_receipt TEXT;
  is_admin BOOLEAN;
  is_cashier BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  is_admin := public.has_role(auth.uid(), 'admin');
  is_cashier := public.has_role(auth.uid(), 'cashier');
  IF NOT (is_admin OR is_cashier) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _payment_method NOT IN ('cash','pos','transfer','opay') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'at least one item is required';
  END IF;

  gen_code := 'WK-' || lpad(nextval('public.cashier_sale_code_seq')::text, 3, '0');
  gen_receipt := 'W' || right((extract(epoch FROM now())::bigint)::text, 8);

  INSERT INTO public.cashier_sales
    (code, receipt_no, cashier_id, cashier_label, customer_name, payment_method, note, total)
  VALUES
    (gen_code, gen_receipt, auth.uid(),
     COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'cashier'),
     NULLIF(btrim(COALESCE(_customer_name,'')), ''),
     _payment_method,
     NULLIF(btrim(COALESCE(_note,'')), ''),
     0)
  RETURNING id INTO new_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    item_id := item->>'id';
    item_qty := COALESCE((item->>'qty')::INTEGER, 0);
    IF item_id IS NULL OR item_qty <= 0 THEN RAISE EXCEPTION 'invalid item entry'; END IF;
    INSERT INTO public.cashier_sale_items (sale_id, menu_item_id, name, price, qty)
    VALUES (new_id, item_id, '', 0, item_qty);
  END LOOP;

  RETURN (SELECT jsonb_build_object(
    'id', s.id, 'code', s.code, 'receipt_no', s.receipt_no,
    'payment_method', s.payment_method, 'customer_name', s.customer_name,
    'total', s.total, 'created_at', s.created_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('menu_item_id', i.menu_item_id, 'name', i.name, 'price', i.price, 'qty', i.qty, 'vendor_type', i.vendor_type) ORDER BY i.name)
      FROM public.cashier_sale_items i WHERE i.sale_id = s.id), '[]'::jsonb)
  ) FROM public.cashier_sales s WHERE s.id = new_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_cashier_sale(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_cashier_sale(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- 11) List inventory history (admin)
CREATE OR REPLACE FUNCTION public.list_inventory_history(_limit INTEGER DEFAULT 200, _vendor TEXT DEFAULT NULL)
RETURNS SETOF public.inventory_history
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.inventory_history
   WHERE (_vendor IS NULL OR vendor_type = _vendor)
   ORDER BY created_at DESC
   LIMIT LEAST(COALESCE(_limit, 200), 1000);
$$;
REVOKE EXECUTE ON FUNCTION public.list_inventory_history(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_inventory_history(INTEGER, TEXT) TO authenticated;

-- 12) Realtime publication
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_history;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cashier_sales') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cashier_sales;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cashier_sale_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cashier_sale_items;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- Migration 14 of 37: 20260725122032_2a0f7d9a-f303-4dc4-80af-01febe727079.sql
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "public inserts orders" ON public.orders;
DROP POLICY IF EXISTS "public inserts order_items" ON public.order_items;
REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;


-- ---------------------------------------------------------------------
-- Migration 15 of 37: 20260725124750_aabe02fd-6975-4bd1-b1f6-a02399b00729.sql
-- ---------------------------------------------------------------------

-- 1. Add business_day + archived_at columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS business_day date,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.cashier_sales
  ADD COLUMN IF NOT EXISTS business_day date,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Backfill from created_at in Africa/Lagos
UPDATE public.orders
  SET business_day = (created_at AT TIME ZONE 'Africa/Lagos')::date
  WHERE business_day IS NULL;

UPDATE public.cashier_sales
  SET business_day = (created_at AT TIME ZONE 'Africa/Lagos')::date
  WHERE business_day IS NULL;

-- Auto-set business_day on insert
CREATE OR REPLACE FUNCTION public.set_business_day()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.business_day IS NULL THEN
    NEW.business_day := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Africa/Lagos')::date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_set_business_day ON public.orders;
CREATE TRIGGER orders_set_business_day
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_business_day();

DROP TRIGGER IF EXISTS cashier_sales_set_business_day ON public.cashier_sales;
CREATE TRIGGER cashier_sales_set_business_day
  BEFORE INSERT ON public.cashier_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_business_day();

CREATE INDEX IF NOT EXISTS orders_business_day_idx ON public.orders (business_day DESC);
CREATE INDEX IF NOT EXISTS orders_archived_idx    ON public.orders (archived_at);
CREATE INDEX IF NOT EXISTS cashier_sales_business_day_idx ON public.cashier_sales (business_day DESC);
CREATE INDEX IF NOT EXISTS cashier_sales_archived_idx     ON public.cashier_sales (archived_at);

-- 2. Business Day closures table
CREATE TABLE IF NOT EXISTS public.business_day_closures (
  business_day date PRIMARY KEY,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id),
  note text
);

GRANT SELECT ON public.business_day_closures TO authenticated;
GRANT ALL ON public.business_day_closures TO service_role;

ALTER TABLE public.business_day_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads closures" ON public.business_day_closures;
DROP POLICY IF EXISTS "admin reads closures" ON public.business_day_closures;
CREATE POLICY "admin reads closures" ON public.business_day_closures
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Close / reopen RPCs
CREATE OR REPLACE FUNCTION public.close_business_day(_day date DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_day date;
  affected_orders int;
  affected_sales int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  target_day := COALESCE(_day, (now() AT TIME ZONE 'Africa/Lagos')::date);

  INSERT INTO public.business_day_closures (business_day, closed_by, note)
  VALUES (target_day, auth.uid(), NULLIF(btrim(COALESCE(_note,'')), ''))
  ON CONFLICT (business_day) DO UPDATE
    SET closed_at = now(), closed_by = auth.uid(), note = EXCLUDED.note;

  UPDATE public.orders
    SET archived_at = COALESCE(archived_at, now())
    WHERE business_day = target_day;
  GET DIAGNOSTICS affected_orders = ROW_COUNT;

  UPDATE public.cashier_sales
    SET archived_at = COALESCE(archived_at, now())
    WHERE business_day = target_day;
  GET DIAGNOSTICS affected_sales = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'business_day', target_day,
    'orders_archived', affected_orders,
    'cashier_sales_archived', affected_sales
  );
END $$;

REVOKE ALL ON FUNCTION public.close_business_day(date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_business_day(date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_business_day(_day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.business_day_closures WHERE business_day = _day;
  UPDATE public.orders SET archived_at = NULL WHERE business_day = _day;
  UPDATE public.cashier_sales SET archived_at = NULL WHERE business_day = _day;
  RETURN jsonb_build_object('ok', true, 'business_day', _day);
END $$;

REVOKE ALL ON FUNCTION public.reopen_business_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_business_day(date) TO authenticated;

-- 4. Current business day helper (single source of truth for clients)
CREATE OR REPLACE FUNCTION public.current_business_day()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Africa/Lagos')::date $$;

REVOKE ALL ON FUNCTION public.current_business_day() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_business_day() TO anon, authenticated;


-- ---------------------------------------------------------------------
-- Migration 16 of 37: 20260725141322_668e64fe-edc3-4375-acd6-35cc96068675.sql
-- ---------------------------------------------------------------------

-- 1) Category correction: Bread Roll + Bread Loaf → Food vendor
UPDATE public.menu_items SET vendor_type = 'food' WHERE id IN ('sp9','sp10');

-- 2) Split stock columns
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS stock_online INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_walkin INTEGER NOT NULL DEFAULT 0;

-- Backfill: put current stock into walk-in bucket (cashier-heavy), online starts at 0.
-- Vendors reallocate from the UI.
UPDATE public.menu_items
   SET stock_walkin = GREATEST(COALESCE(stock_qty,0), 0),
       stock_online = 0
 WHERE stock_walkin = 0 AND stock_online = 0;

-- Keep stock_qty always in sync with the two buckets
CREATE OR REPLACE FUNCTION public.sync_menu_stock_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.stock_online := GREATEST(COALESCE(NEW.stock_online,0), 0);
  NEW.stock_walkin := GREATEST(COALESCE(NEW.stock_walkin,0), 0);
  NEW.stock_qty := NEW.stock_online + NEW.stock_walkin;
  IF NEW.stock_qty <= 0 THEN
    NEW.available := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS menu_items_sync_stock ON public.menu_items;
CREATE TRIGGER menu_items_sync_stock
  BEFORE INSERT OR UPDATE OF stock_online, stock_walkin, stock_qty ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_menu_stock_total();

-- Refresh totals now
UPDATE public.menu_items SET stock_online = stock_online;

-- 3) Update decrement trigger: online orders → stock_online, walk-in → stock_walkin
CREATE OR REPLACE FUNCTION public.decrement_stock_from_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  next_online INTEGER; next_walkin INTEGER; next_total INTEGER;
  it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  src TEXT;
BEGIN
  IF TG_TABLE_NAME = 'order_items' THEN src := 'online_order';
  ELSE src := 'walk_in'; END IF;

  SELECT stock_online, stock_walkin, stock_qty, available, name, vendor_type
    INTO prev_online, prev_walkin, prev_total, cur_available, it_name, it_vendor
    FROM public.menu_items WHERE id = NEW.menu_item_id FOR UPDATE;

  IF prev_total IS NULL THEN RETURN NEW; END IF;

  IF src = 'online_order' THEN
    next_online := GREATEST(prev_online - NEW.qty, 0);
    next_walkin := prev_walkin;
  ELSE
    next_online := prev_online;
    next_walkin := GREATEST(prev_walkin - NEW.qty, 0);
  END IF;
  next_total := next_online + next_walkin;

  UPDATE public.menu_items
     SET stock_online = next_online,
         stock_walkin = next_walkin
   WHERE id = NEW.menu_item_id;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by, changed_by_label)
  VALUES
    (NEW.menu_item_id, it_name, it_vendor, prev_total, next_total, next_total - prev_total,
     CASE WHEN src='online_order' THEN 'Online order (online stock)' ELSE 'Walk-in sale (walk-in stock)' END,
     src, auth.uid(), NULL);
  RETURN NEW;
END $$;

-- 4) adjust_stock now interprets _new_qty as the TOTAL; we keep API-compat but re-route
--    to walk-in bucket by default (legacy admin/vendor manual adjust). New RPCs below are preferred.
CREATE OR REPLACE FUNCTION public.adjust_stock(_item_id text, _new_qty integer, _reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  diff INTEGER;
BEGIN
  IF _new_qty IS NULL OR _new_qty < 0 THEN RAISE EXCEPTION 'new qty must be >= 0'; END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type, available
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor, cur_available
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin AND (caller_vendor IS NULL OR caller_vendor <> it_vendor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;

  -- Distribute delta: apply to walk-in first (down or up), then online
  diff := _new_qty - prev_total;
  IF diff >= 0 THEN
    UPDATE public.menu_items SET stock_walkin = prev_walkin + diff WHERE id = _item_id;
  ELSE
    IF prev_walkin >= (-diff) THEN
      UPDATE public.menu_items SET stock_walkin = prev_walkin + diff WHERE id = _item_id;
    ELSE
      UPDATE public.menu_items
         SET stock_walkin = 0,
             stock_online = GREATEST(prev_online + (diff + prev_walkin), 0)
       WHERE id = _item_id;
    END IF;
  END IF;

  IF _new_qty > 0 AND cur_available = false THEN
    UPDATE public.menu_items SET available = true WHERE id = _item_id;
  END IF;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, _new_qty, _new_qty - prev_total,
          NULLIF(btrim(COALESCE(_reason,'')), ''), src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'previous', prev_total, 'new', _new_qty);
END $$;

-- 5) New: absolute set of both buckets
CREATE OR REPLACE FUNCTION public.adjust_stock_split(
  _item_id text, _online integer, _walkin integer, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  next_total INTEGER;
BEGIN
  IF _online IS NULL OR _walkin IS NULL OR _online < 0 OR _walkin < 0 THEN
    RAISE EXCEPTION 'quantities must be >= 0';
  END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type, available
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor, cur_available
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin AND (caller_vendor IS NULL OR caller_vendor <> it_vendor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;

  UPDATE public.menu_items SET stock_online = _online, stock_walkin = _walkin WHERE id = _item_id;
  next_total := _online + _walkin;
  IF next_total > 0 AND cur_available = false THEN
    UPDATE public.menu_items SET available = true WHERE id = _item_id;
  END IF;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, next_total, next_total - prev_total,
          COALESCE(NULLIF(btrim(COALESCE(_reason,'')), ''), 'Split adjust: online=' || _online || ', walkin=' || _walkin),
          src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'online', _online, 'walkin', _walkin, 'total', next_total);
END $$;

-- 6) Reallocate: move qty between buckets (delta > 0 means walk-in → online; < 0 means online → walk-in)
CREATE OR REPLACE FUNCTION public.reallocate_stock(
  _item_id text, _delta_to_online integer, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  next_online INTEGER; next_walkin INTEGER;
BEGIN
  IF _delta_to_online IS NULL OR _delta_to_online = 0 THEN
    RAISE EXCEPTION 'delta must be non-zero';
  END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin AND (caller_vendor IS NULL OR caller_vendor <> it_vendor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  next_online := prev_online + _delta_to_online;
  next_walkin := prev_walkin - _delta_to_online;
  IF next_online < 0 OR next_walkin < 0 THEN
    RAISE EXCEPTION 'insufficient stock in source bucket';
  END IF;

  UPDATE public.menu_items SET stock_online = next_online, stock_walkin = next_walkin WHERE id = _item_id;

  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;
  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, prev_total, 0,
          COALESCE(NULLIF(btrim(COALESCE(_reason,'')), ''),
                   'Reallocate: ' || CASE WHEN _delta_to_online > 0 THEN 'walk-in→online' ELSE 'online→walk-in' END
                   || ' ' || ABS(_delta_to_online)),
          src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'online', next_online, 'walkin', next_walkin, 'total', prev_total);
END $$;

REVOKE ALL ON FUNCTION public.adjust_stock_split(text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock_split(text, integer, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.reallocate_stock(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reallocate_stock(text, integer, text) TO authenticated;


-- ---------------------------------------------------------------------
-- Migration 17 of 37: 20260725141628_9f736f34-6af3-419e-8d0c-e646c81ff648.sql
-- ---------------------------------------------------------------------

-- 1) Product management columns
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2) Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_label TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_select" ON public.audit_log;
CREATE POLICY "audit_log_admin_select" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "audit_log_authenticated_insert" ON public.audit_log;
CREATE POLICY "audit_log_authenticated_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log (action);

CREATE OR REPLACE FUNCTION public.log_audit(
  _action TEXT, _entity_type TEXT DEFAULT NULL, _entity_id TEXT DEFAULT NULL, _details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID; lbl TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO lbl FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_log (user_id, user_label, action, entity_type, entity_id, details)
  VALUES (auth.uid(), lbl, _action, _entity_type, _entity_id, COALESCE(_details, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.log_audit(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb) TO authenticated;

-- 3) Admin product management RPCs
CREATE OR REPLACE FUNCTION public.upsert_menu_item(
  _id TEXT, _name TEXT, _category_id TEXT, _price INTEGER,
  _vendor_type TEXT, _description TEXT DEFAULT NULL, _image_url TEXT DEFAULT NULL,
  _available BOOLEAN DEFAULT TRUE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing public.menu_items%ROWTYPE; new_id TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _price IS NULL OR _price < 0 THEN RAISE EXCEPTION 'price must be >= 0'; END IF;
  IF _vendor_type NOT IN ('food','snacks','coffee','drinks') THEN RAISE EXCEPTION 'invalid vendor_type'; END IF;

  IF _id IS NULL OR length(btrim(_id)) = 0 THEN
    new_id := 'p_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  ELSE
    new_id := btrim(_id);
  END IF;

  SELECT * INTO existing FROM public.menu_items WHERE id = new_id;
  IF NOT FOUND THEN
    INSERT INTO public.menu_items (id, name, category_id, price, vendor_type, description, image_url, available, stock_qty, stock_online, stock_walkin, low_stock_threshold)
    VALUES (new_id, btrim(_name), _category_id, _price, _vendor_type, _description, _image_url, COALESCE(_available, true), 0, 0, 0, 10);
    PERFORM public.log_audit('product.create', 'menu_item', new_id,
      jsonb_build_object('name', _name, 'price', _price, 'vendor_type', _vendor_type));
  ELSE
    UPDATE public.menu_items SET
      name = btrim(_name),
      category_id = COALESCE(_category_id, category_id),
      price = _price,
      vendor_type = _vendor_type,
      description = _description,
      image_url = _image_url,
      available = COALESCE(_available, available)
    WHERE id = new_id;
    IF existing.price <> _price THEN
      PERFORM public.log_audit('product.price_change', 'menu_item', new_id,
        jsonb_build_object('from', existing.price, 'to', _price, 'name', _name));
    END IF;
    PERFORM public.log_audit('product.update', 'menu_item', new_id,
      jsonb_build_object('name', _name, 'price', _price));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;
REVOKE ALL ON FUNCTION public.upsert_menu_item(text, text, text, integer, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_menu_item(text, text, text, integer, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_menu_item(_id TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.menu_items SET archived_at = now(), available = false WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown product'; END IF;
  PERFORM public.log_audit('product.archive', 'menu_item', _id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.archive_menu_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_menu_item(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_menu_item(_id TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.menu_items SET archived_at = NULL WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown product'; END IF;
  PERFORM public.log_audit('product.restore', 'menu_item', _id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.restore_menu_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_menu_item(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_menu_item(_id TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_orders INTEGER; has_sales INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO has_orders FROM public.order_items WHERE menu_item_id = _id;
  SELECT COUNT(*) INTO has_sales FROM public.cashier_sale_items WHERE menu_item_id = _id;
  IF has_orders > 0 OR has_sales > 0 THEN
    RAISE EXCEPTION 'product has historical orders — archive instead of delete';
  END IF;
  DELETE FROM public.menu_items WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown product'; END IF;
  PERFORM public.log_audit('product.delete', 'menu_item', _id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.delete_menu_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_menu_item(text) TO authenticated;

-- 4) Block cashier sales after day is closed
CREATE OR REPLACE FUNCTION public.create_cashier_sale(_payment_method text, _customer_name text, _note text, _items jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID; item JSONB; item_id TEXT; item_qty INTEGER;
  gen_code TEXT; gen_receipt TEXT;
  is_admin BOOLEAN; is_cashier BOOLEAN;
  today_bd date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  is_admin := public.has_role(auth.uid(), 'admin');
  is_cashier := public.has_role(auth.uid(), 'cashier');
  IF NOT (is_admin OR is_cashier) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _payment_method NOT IN ('cash','pos','transfer','opay') THEN RAISE EXCEPTION 'invalid payment method'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'at least one item is required'; END IF;

  today_bd := (now() AT TIME ZONE 'Africa/Lagos')::date;
  IF EXISTS (SELECT 1 FROM public.business_day_closures WHERE business_day = today_bd) THEN
    RAISE EXCEPTION 'Sales for today are closed. Ask admin to reopen the day.';
  END IF;

  gen_code := 'WK-' || lpad(nextval('public.cashier_sale_code_seq')::text, 3, '0');
  gen_receipt := 'W' || right((extract(epoch FROM now())::bigint)::text, 8);

  INSERT INTO public.cashier_sales
    (code, receipt_no, cashier_id, cashier_label, customer_name, payment_method, note, total)
  VALUES
    (gen_code, gen_receipt, auth.uid(),
     COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'cashier'),
     NULLIF(btrim(COALESCE(_customer_name,'')), ''),
     _payment_method, NULLIF(btrim(COALESCE(_note,'')), ''), 0)
  RETURNING id INTO new_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    item_id := item->>'id';
    item_qty := COALESCE((item->>'qty')::INTEGER, 0);
    IF item_id IS NULL OR item_qty <= 0 THEN RAISE EXCEPTION 'invalid item entry'; END IF;
    INSERT INTO public.cashier_sale_items (sale_id, menu_item_id, name, price, qty)
    VALUES (new_id, item_id, '', 0, item_qty);
  END LOOP;

  RETURN (SELECT jsonb_build_object(
    'id', s.id, 'code', s.code, 'receipt_no', s.receipt_no,
    'payment_method', s.payment_method, 'customer_name', s.customer_name,
    'total', s.total, 'created_at', s.created_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('menu_item_id', i.menu_item_id, 'name', i.name, 'price', i.price, 'qty', i.qty, 'vendor_type', i.vendor_type) ORDER BY i.name)
      FROM public.cashier_sale_items i WHERE i.sale_id = new_id), '[]'::jsonb)
  ) FROM public.cashier_sales s WHERE s.id = new_id);
END $$;

-- Hook audits for close_business_day / reopen_business_day
CREATE OR REPLACE FUNCTION public.close_business_day(_day date DEFAULT NULL::date, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_day date; affected_orders int; affected_sales int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'cashier') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  target_day := COALESCE(_day, (now() AT TIME ZONE 'Africa/Lagos')::date);
  INSERT INTO public.business_day_closures (business_day, closed_by, note)
  VALUES (target_day, auth.uid(), NULLIF(btrim(COALESCE(_note,'')), ''))
  ON CONFLICT (business_day) DO UPDATE SET closed_at = now(), closed_by = auth.uid(), note = EXCLUDED.note;
  UPDATE public.orders SET archived_at = COALESCE(archived_at, now()) WHERE business_day = target_day;
  GET DIAGNOSTICS affected_orders = ROW_COUNT;
  UPDATE public.cashier_sales SET archived_at = COALESCE(archived_at, now()) WHERE business_day = target_day;
  GET DIAGNOSTICS affected_sales = ROW_COUNT;
  PERFORM public.log_audit('day.close', 'business_day', target_day::text,
    jsonb_build_object('orders_archived', affected_orders, 'sales_archived', affected_sales));
  RETURN jsonb_build_object('ok', true, 'business_day', target_day, 'orders_archived', affected_orders, 'cashier_sales_archived', affected_sales);
END $$;

CREATE OR REPLACE FUNCTION public.reopen_business_day(_day date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.business_day_closures WHERE business_day = _day;
  UPDATE public.orders SET archived_at = NULL WHERE business_day = _day;
  UPDATE public.cashier_sales SET archived_at = NULL WHERE business_day = _day;
  PERFORM public.log_audit('day.reopen', 'business_day', _day::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'business_day', _day);
END $$;

-- Helper for admin to check if today is closed
CREATE OR REPLACE FUNCTION public.is_business_day_closed(_day date DEFAULT NULL::date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_day_closures
    WHERE business_day = COALESCE(_day, (now() AT TIME ZONE 'Africa/Lagos')::date))
$$;
REVOKE ALL ON FUNCTION public.is_business_day_closed(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_day_closed(date) TO authenticated;


-- ---------------------------------------------------------------------
-- Migration 18 of 37: 20260725145711_65796063-e6c7-4cf4-89dc-34ecad4cc420.sql
-- ---------------------------------------------------------------------

-- 1. business_day_closures: admin write policies
DROP POLICY IF EXISTS "admin inserts closures" ON public.business_day_closures;
DROP POLICY IF EXISTS "admin inserts closures" ON public.business_day_closures;
CREATE POLICY "admin inserts closures" ON public.business_day_closures
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admin updates closures" ON public.business_day_closures;
DROP POLICY IF EXISTS "admin updates closures" ON public.business_day_closures;
CREATE POLICY "admin updates closures" ON public.business_day_closures
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admin deletes closures" ON public.business_day_closures;
DROP POLICY IF EXISTS "admin deletes closures" ON public.business_day_closures;
CREATE POLICY "admin deletes closures" ON public.business_day_closures
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Tighten customers INSERT policy (replace WITH CHECK true)
DROP POLICY IF EXISTS "public inserts customers" ON public.customers;
DROP POLICY IF EXISTS "guests insert customers" ON public.customers;
DROP POLICY IF EXISTS "guests insert customers" ON public.customers;
CREATE POLICY "guests insert customers" ON public.customers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(name)) BETWEEN 1 AND 100
    AND length(btrim(phone)) BETWEEN 6 AND 20
  );

-- 3. Revoke EXECUTE from anon on privileged SECURITY DEFINER functions.
--    Keep anon access on: create_customer_order (both overloads),
--    get_order_by_code, get_orders_by_phone, apply_payment_result
--    (all needed for guest checkout / receipt / payment return).
REVOKE EXECUTE ON FUNCTION public.adjust_stock(text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_business_day(date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_cashier_sale(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_inventory_history(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reopen_business_day(date) FROM anon;


-- ---------------------------------------------------------------------
-- Migration 19 of 37: 20260725154911_e40caece-4e81-4556-b074-67549eb8be35.sql
-- ---------------------------------------------------------------------

-- Recreate create_customer_order with per-item Online stock validation and row locking
CREATE OR REPLACE FUNCTION public.create_customer_order(
  _customer_name text, _phone text, _note text, _order_type text, _items jsonb, _pickup_time text DEFAULT NULL::text
)
 RETURNS TABLE(id uuid, code text, receipt_no text, total integer, created_at timestamp with time zone, pickup_time text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_order_id UUID;
  item JSONB;
  item_id TEXT;
  item_qty INTEGER;
  clean_pickup TEXT;
  agg_id TEXT;
  agg_qty INTEGER;
  avail_online INTEGER;
  it_name TEXT;
  it_available BOOLEAN;
BEGIN
  IF _customer_name IS NULL OR length(btrim(_customer_name)) = 0 THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  IF _phone IS NULL OR length(btrim(_phone)) = 0 THEN
    RAISE EXCEPTION 'phone is required';
  END IF;
  IF _order_type NOT IN ('dine-in', 'takeaway') THEN
    RAISE EXCEPTION 'invalid order_type';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'at least one item is required';
  END IF;

  clean_pickup := NULLIF(btrim(COALESCE(_pickup_time, '')), '');
  IF clean_pickup IS NULL THEN
    RAISE EXCEPTION 'pickup_time is required';
  END IF;
  IF length(clean_pickup) > 20 THEN
    RAISE EXCEPTION 'pickup_time too long';
  END IF;

  -- Aggregate quantities per menu item, lock each row, and validate online stock
  FOR agg_id, agg_qty IN
    SELECT (e->>'id')::text, SUM(COALESCE((e->>'qty')::INTEGER, 0))::INTEGER
    FROM jsonb_array_elements(_items) e
    GROUP BY (e->>'id')::text
    ORDER BY (e->>'id')::text
  LOOP
    IF agg_id IS NULL OR agg_qty IS NULL OR agg_qty <= 0 THEN
      RAISE EXCEPTION 'invalid item entry';
    END IF;
    SELECT stock_online, name, available
      INTO avail_online, it_name, it_available
      FROM public.menu_items WHERE id = agg_id FOR UPDATE;
    IF it_name IS NULL THEN
      RAISE EXCEPTION 'Unknown menu item';
    END IF;
    IF NOT it_available THEN
      RAISE EXCEPTION '% is not available for online ordering.', it_name;
    END IF;
    IF COALESCE(avail_online, 0) <= 0 THEN
      RAISE EXCEPTION '% is sold out online.', it_name;
    END IF;
    IF agg_qty > avail_online THEN
      RAISE EXCEPTION 'Only % % currently available for online ordering.', avail_online, it_name;
    END IF;
  END LOOP;

  INSERT INTO public.orders (customer_name, phone, note, order_type, pickup_time, total, code, receipt_no)
  VALUES (
    btrim(_customer_name),
    btrim(_phone),
    NULLIF(btrim(COALESCE(_note, '')), ''),
    _order_type,
    clean_pickup,
    0,
    '',
    ''
  )
  RETURNING orders.id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    item_id := item->>'id';
    item_qty := COALESCE((item->>'qty')::INTEGER, 0);
    IF item_id IS NULL OR item_qty <= 0 THEN
      RAISE EXCEPTION 'invalid item entry';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, qty)
    VALUES (new_order_id, item_id, '', 0, item_qty);
  END LOOP;

  RETURN QUERY
  SELECT o.id, o.code, o.receipt_no, o.total, o.created_at, o.pickup_time
  FROM public.orders o
  WHERE o.id = new_order_id;
END;
$function$;

-- Recreate create_cashier_sale with per-item Walk-in stock validation and row locking
CREATE OR REPLACE FUNCTION public.create_cashier_sale(_payment_method text, _customer_name text, _note text, _items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id UUID; item JSONB; item_id TEXT; item_qty INTEGER;
  gen_code TEXT; gen_receipt TEXT;
  is_admin BOOLEAN; is_cashier BOOLEAN;
  today_bd date;
  agg_id TEXT; agg_qty INTEGER;
  avail_walkin INTEGER; it_name TEXT; it_available BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  is_admin := public.has_role(auth.uid(), 'admin');
  is_cashier := public.has_role(auth.uid(), 'cashier');
  IF NOT (is_admin OR is_cashier) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _payment_method NOT IN ('cash','pos','transfer','opay') THEN RAISE EXCEPTION 'invalid payment method'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'at least one item is required'; END IF;

  today_bd := (now() AT TIME ZONE 'Africa/Lagos')::date;
  IF EXISTS (SELECT 1 FROM public.business_day_closures WHERE business_day = today_bd) THEN
    RAISE EXCEPTION 'Sales for today are closed. Ask admin to reopen the day.';
  END IF;

  -- Aggregate + validate walk-in stock with row lock
  FOR agg_id, agg_qty IN
    SELECT (e->>'id')::text, SUM(COALESCE((e->>'qty')::INTEGER, 0))::INTEGER
    FROM jsonb_array_elements(_items) e
    GROUP BY (e->>'id')::text
    ORDER BY (e->>'id')::text
  LOOP
    IF agg_id IS NULL OR agg_qty IS NULL OR agg_qty <= 0 THEN
      RAISE EXCEPTION 'invalid item entry';
    END IF;
    SELECT stock_walkin, name, available
      INTO avail_walkin, it_name, it_available
      FROM public.menu_items WHERE id = agg_id FOR UPDATE;
    IF it_name IS NULL THEN
      RAISE EXCEPTION 'Unknown menu item';
    END IF;
    IF NOT it_available THEN
      RAISE EXCEPTION '% is not available.', it_name;
    END IF;
    IF COALESCE(avail_walkin, 0) <= 0 THEN
      RAISE EXCEPTION '% is sold out for walk-in.', it_name;
    END IF;
    IF agg_qty > avail_walkin THEN
      RAISE EXCEPTION 'Only % % currently available for walk-in.', avail_walkin, it_name;
    END IF;
  END LOOP;

  gen_code := 'WK-' || lpad(nextval('public.cashier_sale_code_seq')::text, 3, '0');
  gen_receipt := 'W' || right((extract(epoch FROM now())::bigint)::text, 8);

  INSERT INTO public.cashier_sales
    (code, receipt_no, cashier_id, cashier_label, customer_name, payment_method, note, total)
  VALUES
    (gen_code, gen_receipt, auth.uid(),
     COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'cashier'),
     NULLIF(btrim(COALESCE(_customer_name,'')), ''),
     _payment_method, NULLIF(btrim(COALESCE(_note,'')), ''), 0)
  RETURNING id INTO new_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    item_id := item->>'id';
    item_qty := COALESCE((item->>'qty')::INTEGER, 0);
    IF item_id IS NULL OR item_qty <= 0 THEN RAISE EXCEPTION 'invalid item entry'; END IF;
    INSERT INTO public.cashier_sale_items (sale_id, menu_item_id, name, price, qty)
    VALUES (new_id, item_id, '', 0, item_qty);
  END LOOP;

  RETURN (SELECT jsonb_build_object(
    'id', s.id, 'code', s.code, 'receipt_no', s.receipt_no,
    'payment_method', s.payment_method, 'customer_name', s.customer_name,
    'total', s.total, 'created_at', s.created_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('menu_item_id', i.menu_item_id, 'name', i.name, 'price', i.price, 'qty', i.qty, 'vendor_type', i.vendor_type) ORDER BY i.name)
      FROM public.cashier_sale_items i WHERE i.sale_id = new_id), '[]'::jsonb)
  ) FROM public.cashier_sales s WHERE s.id = new_id);
END $function$;


-- ---------------------------------------------------------------------
-- Migration 20 of 37: 20260805135003_7861e806-6599-4ad8-bd78-401a02636195.sql
-- ---------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============ system_settings ============
CREATE TABLE IF NOT EXISTS public.system_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system settings readable" ON public.system_settings;
DROP POLICY IF EXISTS "system settings readable" ON public.system_settings;
CREATE POLICY "system settings readable" ON public.system_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin inserts system settings" ON public.system_settings;
DROP POLICY IF EXISTS "admin inserts system settings" ON public.system_settings;
CREATE POLICY "admin inserts system settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin updates system settings" ON public.system_settings;
DROP POLICY IF EXISTS "admin updates system settings" ON public.system_settings;
CREATE POLICY "admin updates system settings" ON public.system_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.system_settings (id, data) VALUES ('global', jsonb_build_object(
  'churchName','The Citadel Global Community Church',
  'cafeteriaName','CGCC Cafeteria Express',
  'churchLogoUrl','', 'cafeteriaLogoUrl','',
  'contactPhone','', 'officialEmail','', 'address','',
  'operatingDays', jsonb_build_array('Mon','Tue','Wed','Thu','Fri','Sat','Sun'),
  'openingTime','08:00','closingTime','16:00',
  'pickupIntervalMinutes',15,'maxPickupMinutes',480,
  'receiptFooterText','Thank you and God bless.',
  'welcomeMessage','🎉 Welcome to CGCC Cafeteria Express',
  'maintenanceMessage','','announcement','',
  'defaultVendorPayoutPercent', 85,
  'payoutPercents', jsonb_build_object('food',85,'snacks',85,'coffee',85,'drinks',85)
)) ON CONFLICT (id) DO NOTHING;

-- ============ bank_accounts ============
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_accounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "active bank accounts readable" ON public.bank_accounts;
DROP POLICY IF EXISTS "active bank accounts readable" ON public.bank_accounts;
CREATE POLICY "active bank accounts readable" ON public.bank_accounts FOR SELECT TO anon USING (enabled = true AND archived_at IS NULL);
DROP POLICY IF EXISTS "authenticated reads bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "authenticated reads bank accounts" ON public.bank_accounts;
CREATE POLICY "authenticated reads bank accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin inserts bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "admin inserts bank accounts" ON public.bank_accounts;
CREATE POLICY "admin inserts bank accounts" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin updates bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "admin updates bank accounts" ON public.bank_accounts;
CREATE POLICY "admin updates bank accounts" ON public.bank_accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin deletes bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "admin deletes bank accounts" ON public.bank_accounts;
CREATE POLICY "admin deletes bank accounts" ON public.bank_accounts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS bank_accounts_touch ON public.bank_accounts;
CREATE TRIGGER bank_accounts_touch BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.bank_accounts (bank_name, account_name, account_number, enabled, is_default)
SELECT 'OPay','Olunike Olajumoke Adewumi','6104885281', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE account_number = '6104885281');

-- ============ finance security ============
CREATE TABLE IF NOT EXISTS public.finance_security (
  id text PRIMARY KEY,
  pin_hash text,
  recovery_email text,
  otp_enabled boolean NOT NULL DEFAULT false,
  timeout_minutes integer NOT NULL DEFAULT 15,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  configured_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.finance_security TO service_role;
ALTER TABLE public.finance_security ENABLE ROW LEVEL SECURITY;
INSERT INTO public.finance_security (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.finance_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_label text,
  event text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_login_events TO authenticated;
GRANT ALL ON public.finance_login_events TO service_role;
ALTER TABLE public.finance_login_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin reads finance events" ON public.finance_login_events;
DROP POLICY IF EXISTS "admin reads finance events" ON public.finance_login_events;
CREATE POLICY "admin reads finance events" ON public.finance_login_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.finance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  otp_verified boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.finance_sessions TO authenticated;
GRANT ALL ON public.finance_sessions TO service_role;
ALTER TABLE public.finance_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin reads finance sessions" ON public.finance_sessions;
DROP POLICY IF EXISTS "admin reads finance sessions" ON public.finance_sessions;
CREATE POLICY "admin reads finance sessions" ON public.finance_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.finance_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.finance_sessions(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.finance_otps TO service_role;
ALTER TABLE public.finance_otps ENABLE ROW LEVEL SECURITY;

-- ============ finance RPCs ============
CREATE OR REPLACE FUNCTION public.finance_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.finance_security%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.finance_security WHERE id='global';
  RETURN jsonb_build_object(
    'configured', r.pin_hash IS NOT NULL,
    'otp_enabled', r.otp_enabled,
    'recovery_email', r.recovery_email,
    'timeout_minutes', r.timeout_minutes,
    'failed_attempts', r.failed_attempts,
    'locked_until', r.locked_until
  );
END $$;

CREATE OR REPLACE FUNCTION public.finance_setup(_pin text, _email text, _otp_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.finance_security%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.finance_security WHERE id='global';
  IF r.pin_hash IS NOT NULL THEN RAISE EXCEPTION 'finance security already configured'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{6,12}$' THEN RAISE EXCEPTION 'PIN must be 6-12 digits'; END IF;
  IF _email IS NULL OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'valid recovery email required'; END IF;
  UPDATE public.finance_security SET
    pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf')),
    recovery_email = lower(btrim(_email)),
    otp_enabled = COALESCE(_otp_enabled,false),
    configured_at = now(), updated_at = now(), failed_attempts = 0, locked_until = NULL
  WHERE id='global';
  PERFORM public.log_audit('finance.setup','finance','global','{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.finance_unlock(_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.finance_security%ROWTYPE; lbl text; sid uuid; code text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT email INTO lbl FROM auth.users WHERE id = auth.uid();
  SELECT * INTO r FROM public.finance_security WHERE id='global' FOR UPDATE;
  IF r.pin_hash IS NULL THEN RAISE EXCEPTION 'finance security not configured'; END IF;
  IF r.locked_until IS NOT NULL AND r.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'locked_until', r.locked_until);
  END IF;
  IF r.pin_hash <> extensions.crypt(COALESCE(_pin,''), r.pin_hash) THEN
    UPDATE public.finance_security SET
      failed_attempts = r.failed_attempts + 1,
      locked_until = CASE WHEN r.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
      updated_at = now()
    WHERE id='global';
    INSERT INTO public.finance_login_events (user_id,user_label,event,success,detail)
    VALUES (auth.uid(), lbl, 'pin', false, 'incorrect PIN');
    IF r.failed_attempts + 1 >= 5 THEN
      PERFORM public.log_audit('finance.locked','finance','global', jsonb_build_object('attempts', r.failed_attempts + 1));
      RETURN jsonb_build_object('ok', false, 'locked_until', now() + interval '15 minutes');
    END IF;
    RETURN jsonb_build_object('ok', false, 'attempts_left', 5 - (r.failed_attempts + 1));
  END IF;

  UPDATE public.finance_security SET failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE id='global';
  INSERT INTO public.finance_sessions (user_id, user_label, expires_at, otp_verified)
  VALUES (auth.uid(), lbl, now() + make_interval(mins => r.timeout_minutes), NOT r.otp_enabled)
  RETURNING id INTO sid;
  INSERT INTO public.finance_login_events (user_id,user_label,event,success,detail)
  VALUES (auth.uid(), lbl, 'pin', true, NULL);

  IF r.otp_enabled THEN
    code := lpad((floor(random()*1000000))::int::text, 6, '0');
    INSERT INTO public.finance_otps (session_id, code_hash, expires_at)
    VALUES (sid, extensions.crypt(code, extensions.gen_salt('bf')), now() + interval '10 minutes');
    RETURN jsonb_build_object('ok', true, 'session_id', sid, 'needs_otp', true,
                              'recovery_email', r.recovery_email, 'otp_code', code);
  END IF;
  RETURN jsonb_build_object('ok', true, 'session_id', sid, 'needs_otp', false);
END $$;

CREATE OR REPLACE FUNCTION public.finance_verify_otp(_session_id uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.finance_otps%ROWTYPE; lbl text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT email INTO lbl FROM auth.users WHERE id = auth.uid();
  SELECT * INTO o FROM public.finance_otps
   WHERE session_id = _session_id AND consumed_at IS NULL AND expires_at > now()
   ORDER BY created_at DESC LIMIT 1;
  IF o.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason','expired'); END IF;
  IF o.code_hash <> extensions.crypt(COALESCE(_code,''), o.code_hash) THEN
    INSERT INTO public.finance_login_events (user_id,user_label,event,success,detail)
    VALUES (auth.uid(), lbl, 'otp', false, 'incorrect code');
    RETURN jsonb_build_object('ok', false, 'reason','incorrect');
  END IF;
  UPDATE public.finance_otps SET consumed_at = now() WHERE id = o.id;
  UPDATE public.finance_sessions SET otp_verified = true WHERE id = _session_id;
  INSERT INTO public.finance_login_events (user_id,user_label,event,success)
  VALUES (auth.uid(), lbl, 'otp', true);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.finance_session_valid(_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.finance_sessions%ROWTYPE; mins integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN false; END IF;
  SELECT timeout_minutes INTO mins FROM public.finance_security WHERE id='global';
  SELECT * INTO s FROM public.finance_sessions WHERE id = _session_id AND user_id = auth.uid();
  IF s.id IS NULL OR s.revoked_at IS NOT NULL OR s.expires_at < now() OR NOT s.otp_verified THEN RETURN false; END IF;
  UPDATE public.finance_sessions
     SET last_seen_at = now(), expires_at = now() + make_interval(mins => COALESCE(mins,15))
   WHERE id = _session_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.finance_change_pin(_current text, _new text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.finance_security%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.finance_security WHERE id='global' FOR UPDATE;
  IF r.pin_hash IS NULL OR r.pin_hash <> extensions.crypt(COALESCE(_current,''), r.pin_hash) THEN
    RAISE EXCEPTION 'current PIN is incorrect';
  END IF;
  IF _new IS NULL OR _new !~ '^[0-9]{6,12}$' THEN RAISE EXCEPTION 'new PIN must be 6-12 digits'; END IF;
  UPDATE public.finance_security SET pin_hash = extensions.crypt(_new, extensions.gen_salt('bf')), updated_at = now() WHERE id='global';
  PERFORM public.log_audit('finance.pin_change','finance','global','{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.finance_update_settings(_recovery_email text, _otp_enabled boolean, _timeout_minutes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _recovery_email IS NOT NULL AND _recovery_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'valid recovery email required';
  END IF;
  UPDATE public.finance_security SET
    recovery_email = COALESCE(lower(btrim(_recovery_email)), recovery_email),
    otp_enabled = COALESCE(_otp_enabled, otp_enabled),
    timeout_minutes = GREATEST(LEAST(COALESCE(_timeout_minutes, timeout_minutes), 240), 1),
    updated_at = now()
  WHERE id='global';
  PERFORM public.log_audit('finance.settings_update','finance','global',
    jsonb_build_object('otp_enabled',_otp_enabled,'timeout_minutes',_timeout_minutes));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.finance_logout_all()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.finance_sessions SET revoked_at = now() WHERE revoked_at IS NULL AND expires_at > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.log_audit('finance.logout_all','finance','global', jsonb_build_object('sessions', n));
  RETURN jsonb_build_object('ok', true, 'revoked', n);
END $$;

REVOKE EXECUTE ON FUNCTION public.finance_status(), public.finance_setup(text,text,boolean),
  public.finance_unlock(text), public.finance_verify_otp(uuid,text), public.finance_session_valid(uuid),
  public.finance_change_pin(text,text), public.finance_update_settings(text,boolean,integer),
  public.finance_logout_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_status(), public.finance_setup(text,text,boolean),
  public.finance_unlock(text), public.finance_verify_otp(uuid,text), public.finance_session_valid(uuid),
  public.finance_change_pin(text,text), public.finance_update_settings(text,boolean,integer),
  public.finance_logout_all() TO authenticated;


-- ---------------------------------------------------------------------
-- Migration 21 of 37: 20260805140950_38f10d25-f828-4ed3-9e0d-59ede91dc0c4.sql
-- ---------------------------------------------------------------------

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS categories_touch_updated_at ON public.categories;
CREATE TRIGGER categories_touch_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- CATEGORY MANAGEMENT ----------
DROP FUNCTION IF EXISTS public.upsert_category(text, text, integer);
CREATE OR REPLACE FUNCTION public.upsert_category(_id text DEFAULT NULL, _name text DEFAULT NULL, _sort_order integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id TEXT; existing public.categories%ROWTYPE; next_sort INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  new_id := COALESCE(NULLIF(btrim(COALESCE(_id,'')),''), 'c_' || substr(md5(random()::text || clock_timestamp()::text),1,10));
  SELECT * INTO existing FROM public.categories WHERE id = new_id;
  IF NOT FOUND THEN
    SELECT COALESCE(MAX(sort_order),0)+1 INTO next_sort FROM public.categories;
    INSERT INTO public.categories (id, name, sort_order)
    VALUES (new_id, btrim(_name), COALESCE(_sort_order, next_sort));
    PERFORM public.log_audit('category.create','category',new_id, jsonb_build_object('name',_name));
  ELSE
    UPDATE public.categories
       SET name = btrim(_name), sort_order = COALESCE(_sort_order, sort_order)
     WHERE id = new_id;
    PERFORM public.log_audit('category.update','category',new_id,
      jsonb_build_object('from', existing.name, 'to', btrim(_name)));
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;

CREATE OR REPLACE FUNCTION public.archive_category(_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.categories SET archived_at = now() WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown category'; END IF;
  PERFORM public.log_audit('category.archive','category',_id,'{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.restore_category(_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.categories SET archived_at = NULL WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown category'; END IF;
  PERFORM public.log_audit('category.restore','category',_id,'{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.delete_category(_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO n FROM public.menu_items WHERE category_id = _id;
  IF n > 0 THEN RAISE EXCEPTION 'category still has % product(s) — move them first', n; END IF;
  DELETE FROM public.categories WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown category'; END IF;
  PERFORM public.log_audit('category.delete','category',_id,'{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.reorder_categories(_ids text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ids IS NULL THEN RAISE EXCEPTION 'ids required'; END IF;
  FOR i IN 1 .. array_length(_ids,1) LOOP
    UPDATE public.categories SET sort_order = i WHERE id = _ids[i];
  END LOOP;
  PERFORM public.log_audit('category.reorder','category',NULL, jsonb_build_object('order',_ids));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------- PRODUCT: DUPLICATE ----------
CREATE OR REPLACE FUNCTION public.duplicate_menu_item(_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE src public.menu_items%ROWTYPE; new_id TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO src FROM public.menu_items WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown product'; END IF;
  new_id := 'p_' || substr(md5(random()::text || clock_timestamp()::text),1,10);
  INSERT INTO public.menu_items
    (id, name, category_id, price, vendor_type, description, image_url, available,
     stock_qty, stock_online, stock_walkin, low_stock_threshold, sort_order)
  VALUES
    (new_id, src.name || ' (Copy)', src.category_id, src.price, src.vendor_type,
     src.description, src.image_url, false, 0, 0, 0, src.low_stock_threshold, src.sort_order);
  PERFORM public.log_audit('product.duplicate','menu_item',new_id, jsonb_build_object('from',_id,'name',src.name));
  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;

-- ---------- PRODUCT: BULK ACTIONS ----------
CREATE OR REPLACE FUNCTION public.bulk_update_products(_ids text[], _action text, _value numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n INTEGER := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ids IS NULL OR array_length(_ids,1) IS NULL THEN RAISE EXCEPTION 'no products selected'; END IF;

  IF _action = 'enable' THEN
    UPDATE public.menu_items SET available = true WHERE id = ANY(_ids) AND stock_qty > 0;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'disable' THEN
    UPDATE public.menu_items SET available = false WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'archive' THEN
    UPDATE public.menu_items SET archived_at = now(), available = false WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'restore' THEN
    UPDATE public.menu_items SET archived_at = NULL WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'price_set' THEN
    IF _value IS NULL OR _value < 0 THEN RAISE EXCEPTION 'valid price required'; END IF;
    UPDATE public.menu_items SET price = round(_value)::int WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'price_percent' THEN
    IF _value IS NULL THEN RAISE EXCEPTION 'percent required'; END IF;
    UPDATE public.menu_items
       SET price = GREATEST(round(price * (1 + _value/100.0))::int, 0)
     WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'vendor' THEN
    RAISE EXCEPTION 'use bulk_move_vendor';
  ELSE
    RAISE EXCEPTION 'unknown action: %', _action;
  END IF;

  PERFORM public.log_audit('product.bulk_' || _action, 'menu_item', NULL,
    jsonb_build_object('count', n, 'value', _value, 'ids', _ids));
  RETURN jsonb_build_object('ok', true, 'updated', n);
END $$;

CREATE OR REPLACE FUNCTION public.bulk_move_products(_ids text[], _vendor_type text DEFAULT NULL, _category_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n INTEGER := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ids IS NULL OR array_length(_ids,1) IS NULL THEN RAISE EXCEPTION 'no products selected'; END IF;
  IF _vendor_type IS NOT NULL AND _vendor_type NOT IN ('food','snacks','coffee','drinks') THEN
    RAISE EXCEPTION 'invalid vendor_type';
  END IF;
  UPDATE public.menu_items
     SET vendor_type = COALESCE(_vendor_type, vendor_type),
         category_id = COALESCE(_category_id, category_id)
   WHERE id = ANY(_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.log_audit('product.bulk_move','menu_item',NULL,
    jsonb_build_object('count',n,'vendor_type',_vendor_type,'category_id',_category_id,'ids',_ids));
  RETURN jsonb_build_object('ok', true, 'updated', n);
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_category(text,text,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_category(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_category(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_category(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reorder_categories(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_menu_item(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bulk_update_products(text[],text,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bulk_move_products(text[],text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.upsert_category(text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_categories(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_menu_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_products(text[],text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_move_products(text[],text,text) TO authenticated;


-- ---------------------------------------------------------------------
-- Migration 22 of 37: 20260805141032_6f3b516f-f886-4343-a4e1-19bb4106da13.sql
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "product images are readable" ON storage.objects;
DROP POLICY IF EXISTS "product images are readable" ON storage.objects;
CREATE POLICY "product images are readable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "admins upload product images" ON storage.objects;
DROP POLICY IF EXISTS "admins upload product images" ON storage.objects;
CREATE POLICY "admins upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins update product images" ON storage.objects;
DROP POLICY IF EXISTS "admins update product images" ON storage.objects;
CREATE POLICY "admins update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins delete product images" ON storage.objects;
DROP POLICY IF EXISTS "admins delete product images" ON storage.objects;
CREATE POLICY "admins delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));


-- ---------------------------------------------------------------------
-- Migration 23 of 37: 20260805171721_0bd63485-d85b-40f3-86bb-3b531dc19481.sql
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_system_settings(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'invalid settings payload'; END IF;

  INSERT INTO public.system_settings (id, data, updated_at)
  VALUES ('global', _data, now())
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();

  PERFORM public.log_audit('settings.update', 'system_settings', 'global', '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.save_system_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_system_settings(jsonb) TO authenticated;


-- ---------------------------------------------------------------------
-- Migration 24 of 37: 20260805172913_1fa217cd-4a13-4abb-9a51-fdfeaff69724.sql
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins manage brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage brand logos" ON storage.objects;
CREATE POLICY "Admins manage brand logos" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'brand-logos' AND public.has_role(auth.uid(),'admin')) WITH CHECK (bucket_id = 'brand-logos' AND public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Signed read brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Signed read brand logos" ON storage.objects;
CREATE POLICY "Signed read brand logos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'brand-logos');


-- ---------------------------------------------------------------------
-- Migration 25 of 37: 20260805180334_d08adbe5-93e5-49b7-a6b9-48800edf2e48.sql
-- ---------------------------------------------------------------------

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS narration text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.bank_accounts b SET sort_order = s.rn
FROM (SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.bank_accounts) s
WHERE b.id = s.id AND b.sort_order = 0;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS transfer_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS transfer_reference text,
  ADD COLUMN IF NOT EXISTS proof_url text;

CREATE OR REPLACE FUNCTION public.reorder_bank_accounts(_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE i INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ids IS NULL THEN RAISE EXCEPTION 'ids required'; END IF;
  FOR i IN 1 .. array_length(_ids,1) LOOP
    UPDATE public.bank_accounts SET sort_order = i WHERE id = _ids[i];
  END LOOP;
  PERFORM public.log_audit('bank.reorder','bank_accounts',NULL, jsonb_build_object('order',_ids));
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.reorder_bank_accounts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_bank_accounts(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_transfer_config(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'invalid payload'; END IF;
  INSERT INTO public.app_settings (id, transfer_config, updated_at)
  VALUES ('global', _data, now())
  ON CONFLICT (id) DO UPDATE SET transfer_config = EXCLUDED.transfer_config, updated_at = now();
  PERFORM public.log_audit('transfer.settings_update','app_settings','global','{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.save_transfer_config(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_transfer_config(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_transfer_proof(_code text, _reference text, _proof_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE code = btrim(COALESCE(_code,'')) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.payment_status = 'paid' THEN RAISE EXCEPTION 'order already paid'; END IF;
  UPDATE public.orders SET
    transfer_reference = COALESCE(NULLIF(btrim(COALESCE(_reference,'')),''), transfer_reference),
    proof_url = COALESCE(NULLIF(btrim(COALESCE(_proof_url,'')),''), proof_url),
    payment_provider = COALESCE(payment_provider, 'manual_transfer'),
    payment_updated_at = now()
  WHERE id = o.id;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.attach_transfer_proof(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_transfer_proof(text, text, text) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- Migration 26 of 37: 20260805180403_eefce329-d90e-49ba-bb1a-7716e8148d54.sql
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "anyone uploads payment proof" ON storage.objects;
CREATE POLICY "anyone uploads payment proof"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "staff read payment proofs" ON storage.objects;
CREATE POLICY "staff read payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier')));

DROP POLICY IF EXISTS "admin deletes payment proofs" ON storage.objects;
CREATE POLICY "admin deletes payment proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(),'admin'));


-- ---------------------------------------------------------------------
-- Migration 27 of 37: 20260810164432_ae5bfce0-140e-4802-befc-9f112546260f.sql
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_customer_order(text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_customer_order(_customer_name text, _phone text, _note text, _order_type text, _items jsonb, _pickup_time text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, code text, receipt_no text, total integer, created_at timestamp with time zone, pickup_time text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_order_id UUID;
  item JSONB;
  item_id TEXT;
  item_qty INTEGER;
  clean_pickup TEXT;
  agg_id TEXT;
  agg_qty INTEGER;
  avail_online INTEGER;
  it_name TEXT;
  it_available BOOLEAN;
BEGIN
  IF _customer_name IS NULL OR length(btrim(_customer_name)) = 0 THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  IF _phone IS NULL OR length(btrim(_phone)) = 0 THEN
    RAISE EXCEPTION 'phone is required';
  END IF;
  IF _order_type NOT IN ('dine-in', 'takeaway') THEN
    RAISE EXCEPTION 'invalid order_type';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'at least one item is required';
  END IF;

  clean_pickup := NULLIF(btrim(COALESCE(_pickup_time, '')), '');
  IF clean_pickup IS NULL THEN
    RAISE EXCEPTION 'pickup_time is required';
  END IF;
  IF length(clean_pickup) > 20 THEN
    RAISE EXCEPTION 'pickup_time too long';
  END IF;

  FOR agg_id, agg_qty IN
    SELECT (e->>'id')::text, SUM(COALESCE((e->>'qty')::INTEGER, 0))::INTEGER
    FROM jsonb_array_elements(_items) e
    GROUP BY (e->>'id')::text
    ORDER BY (e->>'id')::text
  LOOP
    IF agg_id IS NULL OR agg_qty IS NULL OR agg_qty <= 0 THEN
      RAISE EXCEPTION 'invalid item entry';
    END IF;
    SELECT mi.stock_online, mi.name, mi.available
      INTO avail_online, it_name, it_available
      FROM public.menu_items mi WHERE mi.id = agg_id FOR UPDATE;
    IF it_name IS NULL THEN
      RAISE EXCEPTION 'Unknown menu item';
    END IF;
    IF NOT it_available THEN
      RAISE EXCEPTION '% is not available for online ordering.', it_name;
    END IF;
    IF COALESCE(avail_online, 0) <= 0 THEN
      RAISE EXCEPTION '% is sold out online.', it_name;
    END IF;
    IF agg_qty > avail_online THEN
      RAISE EXCEPTION 'Only % % currently available for online ordering.', avail_online, it_name;
    END IF;
  END LOOP;

  INSERT INTO public.orders (customer_name, phone, note, order_type, pickup_time, total, code, receipt_no)
  VALUES (
    btrim(_customer_name),
    btrim(_phone),
    NULLIF(btrim(COALESCE(_note, '')), ''),
    _order_type,
    clean_pickup,
    0,
    '',
    ''
  )
  RETURNING orders.id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    item_id := item->>'id';
    item_qty := COALESCE((item->>'qty')::INTEGER, 0);
    IF item_id IS NULL OR item_qty <= 0 THEN
      RAISE EXCEPTION 'invalid item entry';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, qty)
    VALUES (new_order_id, item_id, '', 0, item_qty);
  END LOOP;

  RETURN QUERY
  SELECT o.id, o.code, o.receipt_no, o.total, o.created_at, o.pickup_time
  FROM public.orders o
  WHERE o.id = new_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_customer_order(text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(text, text, text, text, jsonb, text) TO anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- Migration 28 of 37: 20260810164603_e75202dc-ba9b-4d42-a924-3916cb1d74d8.sql
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.attach_transfer_proof(_code text, _reference text, _proof_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE code = btrim(COALESCE(_code,'')) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.payment_status = 'paid' THEN RAISE EXCEPTION 'order already paid'; END IF;
  UPDATE public.orders SET
    transfer_reference = COALESCE(NULLIF(btrim(COALESCE(_reference,'')),''), transfer_reference),
    proof_url = COALESCE(NULLIF(btrim(COALESCE(_proof_url,'')),''), proof_url),
    payment_provider = COALESCE(payment_provider, 'manual_transfer'),
    payment_status = CASE WHEN payment_status = 'unpaid' THEN 'pending' ELSE payment_status END,
    payment_updated_at = now()
  WHERE id = o.id;
  RETURN jsonb_build_object('ok', true);
END $function$;


-- ---------------------------------------------------------------------
-- Migration 29 of 37: 0000_stage1_security_fixes.sql
-- ---------------------------------------------------------------------

-- 1. Payment gateway secrets vault: locked table, service_role + admin-only definer RPCs only
CREATE TABLE IF NOT EXISTS public.payment_secrets (
  id text PRIMARY KEY,
  secrets jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_secrets TO service_role;
ALTER TABLE public.payment_secrets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_payment_secrets()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((SELECT secrets FROM public.payment_secrets WHERE id='global'), '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.save_payment_secrets(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'invalid payload'; END IF;
  INSERT INTO public.payment_secrets (id, secrets, updated_at) VALUES ('global', _data, now())
  ON CONFLICT (id) DO UPDATE SET secrets = EXCLUDED.secrets, updated_at = now();
  PERFORM public.log_audit('payment.secrets_update','payment_secrets','global','{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

-- Backfill: move credentials out of the publicly readable app_settings row
INSERT INTO public.payment_secrets (id, secrets)
SELECT 'global', jsonb_build_object(
  'credentials', COALESCE(payment_config->'credentials','{}'::jsonb),
  'legacy', jsonb_build_object(
    'merchantId', COALESCE(payment_config->>'merchantId',''),
    'publicKey', COALESCE(payment_config->>'publicKey',''),
    'secretKey', COALESCE(payment_config->>'secretKey',''),
    'webhookSecret', COALESCE(payment_config->>'webhookSecret','')))
FROM public.app_settings WHERE id='global'
ON CONFLICT (id) DO NOTHING;

UPDATE public.app_settings
SET payment_config = payment_config - 'credentials' - 'secretKey' - 'webhookSecret' - 'merchantId' - 'publicKey'
WHERE id='global';

-- 2. Vendors can no longer edit product rows directly; availability + threshold via RPC only
DROP POLICY IF EXISTS "vendor updates own menu items" ON public.menu_items;

CREATE OR REPLACE FUNCTION public.vendor_set_item_availability(_id text, _available boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it_vendor TEXT; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT vendor_type INTO it_vendor FROM public.menu_items WHERE id = _id;
  IF it_vendor IS NULL THEN RAISE EXCEPTION 'unknown product'; END IF;
  is_admin := public.has_role(auth.uid(),'admin');
  IF NOT is_admin AND it_vendor <> public.vendor_type_for_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.menu_items SET available = COALESCE(_available, false) WHERE id = _id;
  PERFORM public.log_audit('product.availability','menu_item',_id, jsonb_build_object('available', COALESCE(_available, false)));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.vendor_set_low_stock_threshold(_id text, _threshold integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it_vendor TEXT; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _threshold IS NULL OR _threshold < 0 THEN RAISE EXCEPTION 'threshold must be >= 0'; END IF;
  SELECT vendor_type INTO it_vendor FROM public.menu_items WHERE id = _id;
  IF it_vendor IS NULL THEN RAISE EXCEPTION 'unknown product'; END IF;
  is_admin := public.has_role(auth.uid(),'admin');
  IF NOT is_admin AND it_vendor <> public.vendor_type_for_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.menu_items SET low_stock_threshold = _threshold WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 3. Vendors can no longer edit order item rows directly; preparation status via RPC only
DROP POLICY IF EXISTS "vendor updates own prep status" ON public.order_items;

CREATE OR REPLACE FUNCTION public.vendor_set_preparation_status(_item_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it_vendor TEXT; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _status NOT IN ('pending','preparing','ready','collected') THEN RAISE EXCEPTION 'invalid status'; END IF;
  SELECT vendor_type INTO it_vendor FROM public.order_items WHERE id = _item_id;
  IF it_vendor IS NULL THEN RAISE EXCEPTION 'unknown order item'; END IF;
  is_admin := public.has_role(auth.uid(),'admin');
  IF NOT is_admin AND it_vendor <> public.vendor_type_for_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.order_items SET preparation_status = _status WHERE id = _item_id;
  RETURN jsonb_build_object('ok', true, 'status', _status);
END $$;

-- 4. Audit log entries only via protected (security definer) functions
DROP POLICY IF EXISTS "audit_log_authenticated_insert" ON public.audit_log;


-- ---------------------------------------------------------------------
-- Migration 30 of 37: 0001_enforce_price_insert_only.sql
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS order_items_enforce_price ON public.order_items;
DROP TRIGGER IF EXISTS order_items_enforce_price ON public.order_items;
CREATE TRIGGER order_items_enforce_price BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION enforce_order_item_price();


-- ---------------------------------------------------------------------
-- Migration 31 of 37: 0002_vendor_management_v2.sql
-- ---------------------------------------------------------------------

-- Staff accounts: display label + per-account stock management permission
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS display_label text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS can_manage_stock boolean NOT NULL DEFAULT true;

UPDATE public.vendors SET display_label = CASE vendor_type
  WHEN 'food' THEN 'Food Vendor'
  WHEN 'snacks' THEN 'Snacks Vendor'
  WHEN 'coffee' THEN 'Coffee Vendor'
  WHEN 'drinks' THEN 'Drinks Vendor'
  ELSE vendor_type END
WHERE display_label IS NULL;

-- Helper: does this user's staff account allow stock changes?
CREATE OR REPLACE FUNCTION public.vendor_can_manage_stock(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT can_manage_stock FROM public.vendors WHERE user_id = _user_id AND active = true LIMIT 1), false)
$$;

-- Enforce the permission inside the three stock functions (admins always allowed)
CREATE OR REPLACE FUNCTION public.adjust_stock(_item_id text, _new_qty integer, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  diff INTEGER;
BEGIN
  IF _new_qty IS NULL OR _new_qty < 0 THEN RAISE EXCEPTION 'new qty must be >= 0'; END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type, available
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor, cur_available
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin THEN
    IF caller_vendor IS NULL OR caller_vendor <> it_vendor THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT public.vendor_can_manage_stock(auth.uid()) THEN
      RAISE EXCEPTION 'stock management is disabled for your account';
    END IF;
  END IF;
  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;

  diff := _new_qty - prev_total;
  IF diff >= 0 THEN
    UPDATE public.menu_items SET stock_walkin = prev_walkin + diff WHERE id = _item_id;
  ELSE
    IF prev_walkin >= (-diff) THEN
      UPDATE public.menu_items SET stock_walkin = prev_walkin + diff WHERE id = _item_id;
    ELSE
      UPDATE public.menu_items
         SET stock_walkin = 0,
             stock_online = GREATEST(prev_online + (diff + prev_walkin), 0)
       WHERE id = _item_id;
    END IF;
  END IF;

  IF _new_qty > 0 AND cur_available = false THEN
    UPDATE public.menu_items SET available = true WHERE id = _item_id;
  END IF;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, _new_qty, _new_qty - prev_total,
          NULLIF(btrim(COALESCE(_reason,'')), ''), src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'previous', prev_total, 'new', _new_qty);
END $function$;

CREATE OR REPLACE FUNCTION public.adjust_stock_split(_item_id text, _online integer, _walkin integer, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  next_total INTEGER;
BEGIN
  IF _online IS NULL OR _walkin IS NULL OR _online < 0 OR _walkin < 0 THEN
    RAISE EXCEPTION 'quantities must be >= 0';
  END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type, available
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor, cur_available
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin THEN
    IF caller_vendor IS NULL OR caller_vendor <> it_vendor THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT public.vendor_can_manage_stock(auth.uid()) THEN
      RAISE EXCEPTION 'stock management is disabled for your account';
    END IF;
  END IF;
  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;

  UPDATE public.menu_items SET stock_online = _online, stock_walkin = _walkin WHERE id = _item_id;
  next_total := _online + _walkin;
  IF next_total > 0 AND cur_available = false THEN
    UPDATE public.menu_items SET available = true WHERE id = _item_id;
  END IF;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, next_total, next_total - prev_total,
          COALESCE(NULLIF(btrim(COALESCE(_reason,'')), ''), 'Split adjust: online=' || _online || ', walkin=' || _walkin),
          src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'online', _online, 'walkin', _walkin, 'total', next_total);
END $function$;

CREATE OR REPLACE FUNCTION public.reallocate_stock(_item_id text, _delta_to_online integer, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  next_online INTEGER; next_walkin INTEGER;
BEGIN
  IF _delta_to_online IS NULL OR _delta_to_online = 0 THEN
    RAISE EXCEPTION 'delta must be non-zero';
  END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin THEN
    IF caller_vendor IS NULL OR caller_vendor <> it_vendor THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT public.vendor_can_manage_stock(auth.uid()) THEN
      RAISE EXCEPTION 'stock management is disabled for your account';
    END IF;
  END IF;

  next_online := prev_online + _delta_to_online;
  next_walkin := prev_walkin - _delta_to_online;
  IF next_online < 0 OR next_walkin < 0 THEN
    RAISE EXCEPTION 'insufficient stock in source bucket';
  END IF;

  UPDATE public.menu_items SET stock_online = next_online, stock_walkin = next_walkin WHERE id = _item_id;

  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;
  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, prev_total, 0,
          COALESCE(NULLIF(btrim(COALESCE(_reason,'')), ''),
                   'Reallocate: ' || CASE WHEN _delta_to_online > 0 THEN 'walk-in→online' ELSE 'online→walk-in' END
                   || ' ' || ABS(_delta_to_online)),
          src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'online', next_online, 'walkin', next_walkin, 'total', prev_total);
END $function$;


-- ---------------------------------------------------------------------
-- Migration 32 of 37: 0003_granular_vendor_permissions.sql
-- ---------------------------------------------------------------------

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS can_increase_stock boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS can_reduce_stock boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS can_reallocate_stock boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS can_update_preparation boolean NOT NULL DEFAULT true;
UPDATE public.vendors SET can_increase_stock = can_manage_stock, can_reduce_stock = can_manage_stock, can_reallocate_stock = can_manage_stock;
COMMENT ON COLUMN public.vendors.can_manage_stock IS 'Legacy master stock switch; granular action permissions also apply.';
CREATE OR REPLACE FUNCTION public.vendor_has_permission(_user_id uuid, _permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM public.vendors v WHERE v.user_id = _user_id AND v.active AND CASE _permission WHEN 'increase_stock' THEN v.can_manage_stock AND v.can_increase_stock WHEN 'reduce_stock' THEN v.can_manage_stock AND v.can_reduce_stock WHEN 'reallocate_stock' THEN v.can_manage_stock AND v.can_reallocate_stock WHEN 'update_preparation' THEN v.can_update_preparation ELSE false END);
$$;
REVOKE ALL ON FUNCTION public.vendor_has_permission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_has_permission(uuid,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.enforce_vendor_stock_permissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE increasing boolean; reducing boolean; moving boolean;
BEGIN
 IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vendors WHERE user_id = auth.uid()) THEN RETURN NEW; END IF;
 IF OLD.vendor_type IS DISTINCT FROM public.vendor_type_for_user(auth.uid()) THEN RAISE EXCEPTION 'Forbidden: inactive account or unassigned product'; END IF;
 increasing := NEW.stock_online > OLD.stock_online OR NEW.stock_walkin > OLD.stock_walkin;
 reducing := NEW.stock_online < OLD.stock_online OR NEW.stock_walkin < OLD.stock_walkin;
 moving := (NEW.stock_online > OLD.stock_online AND NEW.stock_walkin < OLD.stock_walkin) OR (NEW.stock_online < OLD.stock_online AND NEW.stock_walkin > OLD.stock_walkin);
 IF moving AND NOT public.vendor_has_permission(auth.uid(), 'reallocate_stock') THEN RAISE EXCEPTION 'Stock reallocation is not permitted'; END IF;
 IF NEW.stock_online + NEW.stock_walkin > OLD.stock_online + OLD.stock_walkin AND NOT public.vendor_has_permission(auth.uid(), 'increase_stock') THEN RAISE EXCEPTION 'Increasing stock is not permitted'; END IF;
 IF NEW.stock_online + NEW.stock_walkin < OLD.stock_online + OLD.stock_walkin AND NOT public.vendor_has_permission(auth.uid(), 'reduce_stock') THEN RAISE EXCEPTION 'Reducing stock is not permitted'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vendor_stock_permissions ON public.menu_items;
CREATE TRIGGER vendor_stock_permissions BEFORE UPDATE OF stock_online, stock_walkin ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_stock_permissions();
CREATE OR REPLACE FUNCTION public.vendor_set_preparation_status(_item_id uuid, _status text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it_vendor text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _status IS NULL OR _status NOT IN ('pending','preparing','ready','collected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 SELECT vendor_type INTO it_vendor FROM public.order_items WHERE id = _item_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown order item'; END IF;
 IF NOT public.has_role(auth.uid(),'admin') AND (it_vendor IS DISTINCT FROM public.vendor_type_for_user(auth.uid()) OR NOT public.vendor_has_permission(auth.uid(),'update_preparation')) THEN RAISE EXCEPTION 'Preparation updates are not permitted'; END IF;
 UPDATE public.order_items SET preparation_status = _status WHERE id = _item_id;
 RETURN jsonb_build_object('ok',true,'status',_status);
END;
$$;
CREATE OR REPLACE FUNCTION public.vendor_set_item_availability(_id text, _available boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it_vendor text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT vendor_type INTO it_vendor FROM public.menu_items WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown product'; END IF;
 IF NOT public.has_role(auth.uid(),'admin') AND (it_vendor IS DISTINCT FROM public.vendor_type_for_user(auth.uid()) OR public.vendor_type_for_user(auth.uid()) IS NULL) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.menu_items SET available = COALESCE(_available,false) WHERE id = _id;
 PERFORM public.log_audit('product.availability','menu_item',_id,jsonb_build_object('available',COALESCE(_available,false)));
 RETURN jsonb_build_object('ok',true);
END;
$$;
CREATE OR REPLACE FUNCTION public.vendor_set_low_stock_threshold(_id text, _threshold integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it_vendor text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _threshold IS NULL OR _threshold < 0 THEN RAISE EXCEPTION 'Threshold must be >= 0'; END IF;
 SELECT vendor_type INTO it_vendor FROM public.menu_items WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown product'; END IF;
 IF NOT public.has_role(auth.uid(),'admin') AND (it_vendor IS DISTINCT FROM public.vendor_type_for_user(auth.uid()) OR public.vendor_type_for_user(auth.uid()) IS NULL) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.menu_items SET low_stock_threshold = _threshold WHERE id = _id;
 RETURN jsonb_build_object('ok',true);
END;
$$;


-- ---------------------------------------------------------------------
-- Migration 33 of 37: 0004_trusted_payment_finalization_only.sql
-- ---------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.apply_payment_result(text,text,text,text,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_result(text,text,text,text,integer,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.enforce_verified_payment_amount() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.payment_status = 'paid' AND NEW.payment_provider IS NOT NULL AND NEW.payment_provider <> 'manual_transfer' AND (NEW.payment_amount IS NULL OR NEW.payment_amount <> NEW.total) THEN RAISE EXCEPTION 'Verified payment amount must equal order total'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS verified_payment_amount ON public.orders;
CREATE TRIGGER verified_payment_amount BEFORE UPDATE OF payment_status, payment_amount ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_payment_amount();


-- ---------------------------------------------------------------------
-- Migration 34 of 37: 0005_cost_price_and_payouts.sql
-- ---------------------------------------------------------------------

-- 0005: cost prices for products, configurable vendor payout rates + payout snapshot history.

-- 1) Cost price column (supports decimals such as 212.50 / 552.50 / 382.50).
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS cost_price numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.menu_items ALTER COLUMN cost_price TYPE numeric(10,2) USING cost_price::numeric(10,2);
COMMENT ON COLUMN public.menu_items.cost_price IS 'Internal cost of goods / vendor payout share per unit (NGN); defaults to 85% of selling price.';

-- 2) Extend upsert_menu_item with numeric cost price.
DROP FUNCTION IF EXISTS public.upsert_menu_item(text, text, text, integer, text, text, text, boolean, integer);
DROP FUNCTION IF EXISTS public.upsert_menu_item(text, text, text, integer, text, text, text, boolean, numeric);
CREATE OR REPLACE FUNCTION public.upsert_menu_item(
  _id text DEFAULT NULL, _name text DEFAULT NULL, _category_id text DEFAULT NULL, _price integer DEFAULT NULL, _vendor_type text DEFAULT NULL,
  _description text DEFAULT NULL, _image_url text DEFAULT NULL, _available boolean DEFAULT true,
  _cost_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE existing public.menu_items%ROWTYPE; new_id TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _price IS NULL OR _price < 0 THEN RAISE EXCEPTION 'price must be >= 0'; END IF;
  IF _cost_price IS NOT NULL AND _cost_price < 0 THEN RAISE EXCEPTION 'cost price must be >= 0'; END IF;
  IF _vendor_type NOT IN ('food','snacks','coffee','drinks') THEN RAISE EXCEPTION 'invalid vendor_type'; END IF;

  IF _id IS NULL OR length(btrim(_id)) = 0 THEN
    new_id := 'p_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  ELSE
    new_id := btrim(_id);
  END IF;

  SELECT * INTO existing FROM public.menu_items WHERE id = new_id;
  IF NOT FOUND THEN
    INSERT INTO public.menu_items (id, name, category_id, price, vendor_type, description, image_url, available, stock_qty, stock_online, stock_walkin, low_stock_threshold, cost_price)
    VALUES (new_id, btrim(_name), _category_id, _price, _vendor_type, _description, _image_url, COALESCE(_available, true), 0, 0, 0, 10, COALESCE(_cost_price, ROUND(_price * 0.85, 2)));
    PERFORM public.log_audit('product.create', 'menu_item', new_id,
      jsonb_build_object('name', _name, 'price', _price, 'vendor_type', _vendor_type, 'cost_price', COALESCE(_cost_price, ROUND(_price * 0.85, 2))));
  ELSE
    UPDATE public.menu_items SET
      name = btrim(_name),
      category_id = COALESCE(_category_id, category_id),
      price = _price,
      vendor_type = _vendor_type,
      description = _description,
      image_url = _image_url,
      available = COALESCE(_available, available),
      cost_price = COALESCE(_cost_price, existing.cost_price)
    WHERE id = new_id;
    IF existing.price <> _price THEN
      PERFORM public.log_audit('product.price_change', 'menu_item', new_id,
        jsonb_build_object('from', existing.price, 'to', _price, 'name', _name));
    END IF;
    PERFORM public.log_audit('product.update', 'menu_item', new_id,
      jsonb_build_object('name', _name, 'price', _price, 'cost_price', COALESCE(_cost_price, existing.cost_price)));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END
$function$;

DROP FUNCTION IF EXISTS public.upsert_menu_item(text, text, text, integer, text, text, text, boolean);

-- 3) Admin RPC to set just the cost price of a product.
DROP FUNCTION IF EXISTS public.set_product_cost(text, integer);
DROP FUNCTION IF EXISTS public.set_product_cost(text, numeric);
CREATE OR REPLACE FUNCTION public.set_product_cost(_id text, _cost_price numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _cost_price IS NULL OR _cost_price < 0 THEN RAISE EXCEPTION 'cost price must be >= 0'; END IF;
  UPDATE public.menu_items SET cost_price = ROUND(_cost_price, 2) WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  PERFORM public.log_audit('product.cost_change', 'menu_item', _id, jsonb_build_object('cost_price', ROUND(_cost_price, 2)));
  RETURN jsonb_build_object('ok', true);
END
$function$;

-- 4) Payout snapshot history (one row per vendor per business day).
CREATE TABLE IF NOT EXISTS public.payout_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_type text NOT NULL,
  business_day date NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  gross_revenue integer NOT NULL DEFAULT 0,
  cost_total numeric(12,2) NOT NULL DEFAULT 0,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  payout_amount integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_type, business_day)
);
ALTER TABLE public.payout_snapshots ALTER COLUMN cost_total TYPE numeric(12,2) USING cost_total::numeric(12,2);
COMMENT ON TABLE public.payout_snapshots IS 'Historical payout/commission snapshots per vendor per business day.';

GRANT SELECT ON public.payout_snapshots TO authenticated;
GRANT ALL ON public.payout_snapshots TO service_role;

ALTER TABLE public.payout_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view payout snapshots" ON public.payout_snapshots;
CREATE POLICY "Admins can view payout snapshots"
  ON public.payout_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Admin RPC to record/update a snapshot for a vendor + day.
DROP FUNCTION IF EXISTS public.save_payout_snapshot(text, date, integer, integer, integer, integer, numeric, integer);
DROP FUNCTION IF EXISTS public.save_payout_snapshot(text, date, integer, integer, integer, numeric, numeric, integer);
CREATE OR REPLACE FUNCTION public.save_payout_snapshot(
  _vendor_type text, _business_day date, _orders_count integer, _items_count integer,
  _gross_revenue integer, _cost_total numeric, _commission_percent numeric, _payout_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _vendor_type NOT IN ('food','snacks','coffee','drinks') THEN RAISE EXCEPTION 'invalid vendor_type'; END IF;
  IF _business_day IS NULL THEN RAISE EXCEPTION 'business_day required'; END IF;
  IF _commission_percent IS NULL OR _commission_percent < 0 OR _commission_percent > 100 THEN RAISE EXCEPTION 'commission percent must be between 0 and 100'; END IF;

  INSERT INTO public.payout_snapshots (
    vendor_type, business_day, orders_count, items_count, gross_revenue, cost_total,
    commission_percent, payout_amount, created_by
  ) VALUES (
    _vendor_type, _business_day, COALESCE(_orders_count, 0), COALESCE(_items_count, 0),
    COALESCE(_gross_revenue, 0), COALESCE(_cost_total, 0), _commission_percent, COALESCE(_payout_amount, 0), auth.uid()
  )
  ON CONFLICT (vendor_type, business_day) DO UPDATE SET
    orders_count = EXCLUDED.orders_count,
    items_count = EXCLUDED.items_count,
    gross_revenue = EXCLUDED.gross_revenue,
    cost_total = EXCLUDED.cost_total,
    commission_percent = EXCLUDED.commission_percent,
    payout_amount = EXCLUDED.payout_amount,
    created_by = auth.uid(),
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END
$function$;


-- ---------------------------------------------------------------------
-- Migration 35 of 37: 0006_allow_multiple_vendor_accounts_per_section.sql
-- ---------------------------------------------------------------------

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_vendor_type_key;
COMMENT ON TABLE public.vendors IS 'One row per vendor staff login; several logins may share a vendor_type section.';


-- ---------------------------------------------------------------------
-- Migration 36 of 37: 0007_vendor_login_email.sql
-- ---------------------------------------------------------------------

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS login_email text;
UPDATE public.vendors SET login_email = username || '@vendor.cgcc.local' WHERE login_email IS NULL;
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_username_key;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_username_key UNIQUE (username);
COMMENT ON COLUMN public.vendors.login_email IS 'Auth login email used by /vendor/login to resolve a username';


-- ---------------------------------------------------------------------
-- Migration 37 of 37: 0008_allow_cancelled_pickup_status.sql
-- ---------------------------------------------------------------------

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_pickup_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_pickup_status_check CHECK (pickup_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'collected'::text, 'cancelled'::text]));


-- ---------------------------------------------------------------------
-- Ensure Storage Buckets Exist
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('product-images', 'product-images', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('brand-logos', 'brand-logos', false, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('payment-proofs', 'payment-proofs', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Seed Default 5 Categories (exact 1:1 match with Customer Menu)
-- ---------------------------------------------------------------------
INSERT INTO public.categories (id, name, sort_order)
VALUES
  ('cat_food', 'Food', 1),
  ('cat_snacks', 'Snacks', 2),
  ('cat_coffee', 'Coffee & Tea', 3),
  ('cat_drinks', 'Drinks', 4),
  ('cat_sweets', 'Sweets', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, archived_at = NULL;

-- Ensure existing 'Snacks & Pastries' ID doesn't collide if migrating from legacy 11 categories
UPDATE public.categories SET name = 'Snacks', sort_order = 2 WHERE id = 'cat_snacks';

-- ---------------------------------------------------------------------
-- Seed Default Menu Items & Inventory (cost_price = 85% of price)
-- ---------------------------------------------------------------------
INSERT INTO public.menu_items (
  id,
  category_id,
  name,
  price,
  cost_price,
  vendor_type,
  available,
  stock_qty,
  stock_online,
  stock_walkin,
  image_url,
  sort_order
) VALUES
  ('m1', 'cat_food', 'Jollof Rice', 600, 510, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/jollof%2Crice/all?lock=101', 1),
  ('m2', 'cat_food', 'Fried Rice', 600, 510, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/fried%2Crice/all?lock=102', 2),
  ('m3', 'cat_food', 'Ofada Rice', 600, 510, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/ofada%2Crice/all?lock=103', 3),
  ('m4', 'cat_food', 'Coconut Rice', 700, 595, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/coconut%2Crice/all?lock=104', 4),
  ('m5', 'cat_food', 'Amala', 600, 510, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/amala%2Cewedu/all?lock=105', 5),
  ('m6', 'cat_food', 'Pounded Yam', 600, 510, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/pounded%2Cyam/all?lock=106', 6),
  ('m7', 'cat_food', 'Ewa Agoyin', 600, 510, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/ewa%2Cagoyin%2Cbeans/all?lock=107', 7),
  ('m8', 'cat_food', 'Potato Porridge', 650, 552.5, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/potato%2Cporridge/all?lock=108', 8),
  ('p1', 'cat_food', 'Chicken (Big)', 2000, 1700, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/grilled%2Cchicken/all?lock=201', 9),
  ('p2', 'cat_food', 'Chicken (Small)', 1500, 1275, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/fried%2Cchicken/all?lock=202', 10),
  ('p3', 'cat_food', 'Beef', 1000, 850, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/beef%2Cstew/all?lock=203', 11),
  ('p4', 'cat_food', 'Hake Fish (Big)', 2000, 1700, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/fried%2Cfish/all?lock=204', 12),
  ('p5', 'cat_food', 'Hake Fish (Small)', 1500, 1275, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/hake%2Cfish/all?lock=205', 13),
  ('p6', 'cat_food', 'Pomo', 400, 340, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/pomo%2Ccowskin/all?lock=206', 14),
  ('s1', 'cat_food', 'Efo Riro', 650, 552.5, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/efo%2Criro%2Csoup/all?lock=301', 15),
  ('s2', 'cat_food', 'Bitter Leaf Soup', 650, 552.5, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/bitterleaf%2Csoup/all?lock=302', 16),
  ('s3', 'cat_food', 'Ofada Sauce', 1000, 850, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/ofada%2Csauce/all?lock=303', 17),
  ('s4', 'cat_food', 'Moi Moi', 800, 680, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/moimoi%2Cbeans/all?lock=304', 18),
  ('sp1', 'cat_snacks', 'Meat Pie', 1000, 850, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/meat%2Cpie/all?lock=401', 19),
  ('sp2', 'cat_snacks', 'Chicken Pie', 1000, 850, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/chicken%2Cpie/all?lock=402', 20),
  ('sp3', 'cat_snacks', 'Sausage Roll', 600, 510, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/sausage%2Croll/all?lock=403', 21),
  ('sp4', 'cat_snacks', 'Hotdog Roll', 800, 680, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/hotdog%2Cbun/all?lock=404', 22),
  ('sp5', 'cat_snacks', 'Egg Roll', 700, 595, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/egg%2Croll%2Cpastry/all?lock=405', 23),
  ('sp6', 'cat_snacks', 'Plain Doughnut', 500, 425, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/plain%2Cdoughnut/all?lock=406', 24),
  ('sp7', 'cat_snacks', 'Jam Doughnut', 500, 425, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/jam%2Cdoughnut/all?lock=407', 25),
  ('sp8', 'cat_snacks', 'Shawarma', 2500, 2125, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/shawarma%2Cwrap/all?lock=408', 26),
  ('sp9', 'cat_snacks', 'Bread Roll', 450, 382.5, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/bread%2Croll/all?lock=409', 27),
  ('sp10', 'cat_snacks', 'Bread Loaf', 2400, 2040, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/bread%2Cloaf/all?lock=410', 28),
  ('sw1', 'cat_snacks', 'Chicken Sandwich', 1500, 1275, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/chicken%2Csandwich/all?lock=501', 29),
  ('sw2', 'cat_snacks', 'Egg Sandwich', 1500, 1275, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/egg%2Csandwich/all?lock=502', 30),
  ('sc1', 'cat_snacks', 'Chicken Small Chops', 3000, 2550, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/chicken%2Cwings%2Cplatter/all?lock=601', 31),
  ('sc2', 'cat_snacks', 'Beef Small Chops', 2500, 2125, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/beef%2Cskewers%2Cplatter/all?lock=602', 32),
  ('d1', 'cat_snacks', 'Fruit Parfait', 4000, 3400, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/fruit%2Cparfait/all?lock=701', 33),
  ('d2', 'cat_snacks', 'Yogurt (35cl)', 1400, 1190, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/yogurt%2Ccup/all?lock=702', 34),
  ('d3', 'cat_snacks', 'Yogurt (50cl)', 2500, 2125, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/yogurt%2Cbottle/all?lock=703', 35),
  ('d4', 'cat_snacks', 'Yogurt (1L)', 3500, 2975, 'snacks', true, 50, 50, 0, 'https://loremflickr.com/600/450/yogurt%2Cdrink/all?lock=704', 36),
  ('ct1', 'cat_coffee', 'Cappuccino', 700, 595, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/cappuccino/all?lock=801', 37),
  ('ct2', 'cat_coffee', 'Caffè Latte', 700, 595, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/cafe%2Clatte/all?lock=802', 38),
  ('ct3', 'cat_coffee', 'Coffee with Cream', 650, 552.5, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/coffee%2Ccream/all?lock=803', 39),
  ('ct4', 'cat_coffee', 'Hot Chocolate', 650, 552.5, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/hot%2Cchocolate/all?lock=804', 40),
  ('ct5', 'cat_coffee', 'Hot Chocolate & Cream', 650, 552.5, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/hot%2Cchocolate%2Ccream/all?lock=805', 41),
  ('ct6', 'cat_coffee', 'Black Coffee', 500, 425, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/black%2Ccoffee/all?lock=806', 42),
  ('ct7', 'cat_coffee', 'Black Coffee & Cream', 650, 552.5, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/coffee%2Ccup/all?lock=807', 43),
  ('ct8', 'cat_coffee', 'Green Tea', 1000, 850, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/green%2Ctea/all?lock=808', 44),
  ('ct9', 'cat_coffee', 'Peppermint Tea', 1000, 850, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/peppermint%2Ctea/all?lock=809', 45),
  ('ct10', 'cat_coffee', 'Orange & Spice Tea', 1000, 850, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/orange%2Cspice%2Ctea/all?lock=810', 46),
  ('ct11', 'cat_coffee', 'Lemon Tea', 1000, 850, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/lemon%2Ctea/all?lock=811', 47),
  ('ct12', 'cat_coffee', 'Lemon Ginger Tea', 1000, 850, 'coffee', true, 50, 50, 0, 'https://loremflickr.com/600/450/lemon%2Cginger%2Ctea/all?lock=812', 48),
  ('dr1', 'cat_drinks', 'Coca-Cola (PET)', 500, 425, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/coca%2Ccola%2Cbottle/all?lock=901', 49),
  ('dr2', 'cat_drinks', 'Pepsi (PET)', 500, 425, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/pepsi%2Cbottle/all?lock=902', 50),
  ('dr3', 'cat_drinks', 'Coca-Cola (Glass/Solo)', 300, 255, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/coca%2Ccola%2Cglass/all?lock=903', 51),
  ('dr4', 'cat_drinks', 'Malta Guinness', 800, 680, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/malta%2Cguinness/all?lock=904', 52),
  ('dr5', 'cat_drinks', 'Maltina', 800, 680, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/maltina%2Cmalt/all?lock=905', 53),
  ('dr6', 'cat_drinks', 'Amstel Malt', 800, 680, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/amstel%2Cmalt/all?lock=906', 54),
  ('dr7', 'cat_drinks', 'Schweppes', 600, 510, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/schweppes%2Csoda/all?lock=907', 55),
  ('dr8', 'cat_food', 'Five Alive', 700, 595, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/juice%2Ccarton/all?lock=908', 56),
  ('dr9', 'cat_drinks', 'Viju Apple', 700, 595, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/apple%2Cmilk%2Cdrink/all?lock=909', 57),
  ('dr10', 'cat_drinks', 'Viju Chocolate', 1200, 1020, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/chocolate%2Cmilk/all?lock=910', 58),
  ('dr11', 'cat_food', 'Vita Zobo (30cl)', 600, 510, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/zobo%2Chibiscus%2Cdrink/all?lock=911', 59),
  ('dr12', 'cat_food', 'Vita Zobo (45cl)', 800, 680, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/hibiscus%2Cdrink%2Cbottle/all?lock=912', 60),
  ('dr13', 'cat_food', 'Zobo Cocktail', 700, 595, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/hibiscus%2Ccocktail/all?lock=913', 61),
  ('dr14', 'cat_food', 'Tigernut Milk', 1500, 1275, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/tigernut%2Cmilk%2Ckunu/all?lock=914', 62),
  ('w1', 'cat_drinks', 'Nestlé Water', 200, 170, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/bottled%2Cwater/all?lock=1001', 63),
  ('w2', 'cat_drinks', 'CWAY Water', 200, 170, 'drinks', true, 50, 50, 0, 'https://loremflickr.com/600/450/water%2Cbottle/all?lock=1002', 64),
  ('e1', 'cat_food', 'Takeaway Pack', 250, 212.5, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/takeaway%2Ccontainer/all?lock=1101', 65),
  ('e2', 'cat_food', 'Boiled Egg', 450, 382.5, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/boiled%2Cegg/all?lock=1102', 66),
  ('e3', 'cat_food', 'Salad', 650, 552.5, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/green%2Csalad/all?lock=1103', 67),
  ('e4', 'cat_food', 'Dodo', 400, 340, 'food', true, 50, 50, 0, 'https://loremflickr.com/600/450/fried%2Cplantain/all?lock=1104', 68)
ON CONFLICT (id) DO NOTHING;

-- Migrate existing installations cleanly from legacy 11 categories to the 5 categories
UPDATE public.menu_items SET category_id = 'cat_food' WHERE category_id IN ('cat_meals', 'cat_proteins', 'cat_soups', 'cat_extras');
UPDATE public.menu_items SET category_id = 'cat_snacks' WHERE category_id IN ('cat_sandwiches', 'cat_chops', 'cat_desserts');
UPDATE public.menu_items SET category_id = 'cat_drinks' WHERE category_id IN ('cat_water');
UPDATE public.menu_items SET category_id = 'cat_food', vendor_type = 'food' WHERE id IN ('dr8', 'dr11', 'dr12', 'dr13', 'dr14');
UPDATE public.menu_items SET category_id = 'cat_snacks', vendor_type = 'snacks' WHERE id IN ('d1', 'd2', 'd3', 'd4');
UPDATE public.menu_items SET cost_price = ROUND(price * 0.85, 2) WHERE cost_price = 0 OR cost_price = ROUND(price * 0.60, 0);
DELETE FROM public.categories WHERE id IN ('cat_meals', 'cat_proteins', 'cat_soups', 'cat_sandwiches', 'cat_chops', 'cat_desserts', 'cat_water', 'cat_extras')
  AND NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.category_id = categories.id);

-- Refresh PostgREST schema cache so new/updated RPCs are immediately callable
NOTIFY pgrst, 'reload schema';
