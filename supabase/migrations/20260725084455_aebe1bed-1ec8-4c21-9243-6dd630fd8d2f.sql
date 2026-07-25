
CREATE OR REPLACE FUNCTION public.get_orders_by_phone(_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean text;
  result jsonb;
BEGIN
  clean := btrim(COALESCE(_phone, ''));
  IF length(clean) < 6 THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO result
  FROM (
    SELECT o.code, o.receipt_no, o.customer_name, o.pickup_time,
           o.total, o.payment_status, o.pickup_status, o.created_at
    FROM public.orders o
    WHERE o.phone = clean
    ORDER BY o.created_at DESC
    LIMIT 100
  ) t;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_orders_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orders_by_phone(text) TO anon, authenticated;
