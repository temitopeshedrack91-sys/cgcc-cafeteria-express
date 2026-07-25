
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
