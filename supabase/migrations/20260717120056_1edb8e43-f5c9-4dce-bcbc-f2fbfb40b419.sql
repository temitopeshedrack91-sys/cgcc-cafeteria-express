
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

CREATE POLICY "admin manages vendors" ON public.vendors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

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

CREATE POLICY "vendor reads own order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (vendor_type IS NOT NULL AND vendor_type = public.vendor_type_for_user(auth.uid()));

CREATE POLICY "vendor reads relevant orders" ON public.orders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi
     WHERE oi.order_id = orders.id
       AND oi.vendor_type = public.vendor_type_for_user(auth.uid())
  ));

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
