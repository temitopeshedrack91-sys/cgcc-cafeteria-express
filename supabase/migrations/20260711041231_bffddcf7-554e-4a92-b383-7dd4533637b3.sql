
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
