
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
