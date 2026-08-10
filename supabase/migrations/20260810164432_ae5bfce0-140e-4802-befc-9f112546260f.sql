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