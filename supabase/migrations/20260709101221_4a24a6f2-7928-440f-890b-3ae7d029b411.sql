
-- 1. Role enum + user_roles table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
CREATE POLICY "categories readable" ON public.categories
  FOR SELECT TO anon, authenticated USING (true);

-- menu_items: public read; admin update
DROP POLICY IF EXISTS "menu readable" ON public.menu_items;
DROP POLICY IF EXISTS "menu updatable" ON public.menu_items;
CREATE POLICY "menu readable" ON public.menu_items
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin updates menu" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- app_settings: public read; admin insert/update
DROP POLICY IF EXISTS "settings readable" ON public.app_settings;
DROP POLICY IF EXISTS "settings insertable" ON public.app_settings;
DROP POLICY IF EXISTS "settings updatable" ON public.app_settings;
CREATE POLICY "settings readable" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin inserts settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- customers: anyone can insert or update-by-phone during checkout; only admins can read the list
DROP POLICY IF EXISTS "customers insertable" ON public.customers;
DROP POLICY IF EXISTS "customers readable" ON public.customers;
DROP POLICY IF EXISTS "customers updatable" ON public.customers;
CREATE POLICY "public inserts customers" ON public.customers
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public updates customers" ON public.customers
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin reads customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- orders: anyone can create; only admins can view or update
DROP POLICY IF EXISTS "orders insertable" ON public.orders;
DROP POLICY IF EXISTS "orders readable" ON public.orders;
DROP POLICY IF EXISTS "orders updatable" ON public.orders;
CREATE POLICY "public inserts orders" ON public.orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin reads orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- order_items: anyone can insert (during checkout); only admins can view
DROP POLICY IF EXISTS "order_items insertable" ON public.order_items;
DROP POLICY IF EXISTS "order_items readable" ON public.order_items;
CREATE POLICY "public inserts order_items" ON public.order_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);
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
