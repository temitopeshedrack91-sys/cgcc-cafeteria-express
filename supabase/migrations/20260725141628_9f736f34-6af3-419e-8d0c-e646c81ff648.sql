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