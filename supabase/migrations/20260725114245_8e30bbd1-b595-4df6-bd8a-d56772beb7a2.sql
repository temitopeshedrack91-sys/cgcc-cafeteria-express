
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
CREATE POLICY "admin reads inventory history" ON public.inventory_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
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

CREATE POLICY "cashier reads own sales" ON public.cashier_sales
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages sales" ON public.cashier_sales
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cashier reads own sale items" ON public.cashier_sale_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cashier_sales s WHERE s.id = sale_id AND (s.cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "admin manages sale items" ON public.cashier_sale_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Vendors read items in their category (for realtime + reporting)
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cashier_sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cashier_sale_items;
