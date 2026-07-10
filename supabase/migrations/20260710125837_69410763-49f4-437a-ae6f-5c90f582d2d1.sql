
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
