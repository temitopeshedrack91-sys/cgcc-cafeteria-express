
-- Categories
CREATE TABLE public.categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable" ON public.categories FOR SELECT USING (true);

-- Menu items
CREATE TABLE public.menu_items (
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
CREATE POLICY "menu readable" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "menu updatable" ON public.menu_items FOR UPDATE USING (true) WITH CHECK (true);

-- App settings (single row)
CREATE TABLE public.app_settings (
  id text PRIMARY KEY,
  ordering_open boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings insertable" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "settings updatable" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);

-- Customers (kept for future use; orders currently store customer inline)
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_key UNIQUE (phone)
);
GRANT SELECT, INSERT, UPDATE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers readable" ON public.customers FOR SELECT USING (true);
CREATE POLICY "customers insertable" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "customers updatable" ON public.customers FOR UPDATE USING (true) WITH CHECK (true);

-- Orders
CREATE SEQUENCE IF NOT EXISTS public.order_code_seq;

CREATE TABLE public.orders (
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
CREATE POLICY "orders readable" ON public.orders FOR SELECT USING (true);
CREATE POLICY "orders insertable" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders updatable" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

-- Order items
CREATE TABLE public.order_items (
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
CREATE POLICY "order_items readable" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "order_items insertable" ON public.order_items FOR INSERT WITH CHECK (true);

CREATE INDEX orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);

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

CREATE TRIGGER set_order_code_trg
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_code();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
