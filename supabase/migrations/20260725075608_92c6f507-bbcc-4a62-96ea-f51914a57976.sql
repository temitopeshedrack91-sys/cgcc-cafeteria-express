
-- 1. Expand payment_status allowed values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid','pending','paid','failed','cancelled','refunded'));

-- 2. Add payment tracking columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_amount integer,
  ADD COLUMN IF NOT EXISTS payment_meta jsonb,
  ADD COLUMN IF NOT EXISTS payment_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_key
  ON public.orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 3. Add payment_config to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS payment_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Update get_order_by_code to expose new payment fields
CREATE OR REPLACE FUNCTION public.get_order_by_code(_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result JSONB;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'id', o.id, 'code', o.code, 'receipt_no', o.receipt_no,
    'customer_name', o.customer_name, 'phone', o.phone, 'note', o.note,
    'order_type', o.order_type, 'pickup_time', o.pickup_time,
    'total', o.total, 'payment_status', o.payment_status,
    'payment_provider', o.payment_provider,
    'payment_reference', o.payment_reference,
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

-- 5. Apply verified payment result (idempotent). Callable by anon so the
-- customer's browser can finalize a simulated (Test Mode) payment; on real
-- webhooks the server route should also call this after verifying the signature.
-- Amount verification prevents client from marking a cheaper order paid.
CREATE OR REPLACE FUNCTION public.apply_payment_result(
  _code text,
  _reference text,
  _status text,
  _provider text,
  _amount integer,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  existing public.orders%ROWTYPE;
  new_pickup text;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN RAISE EXCEPTION 'code required'; END IF;
  IF _reference IS NULL OR length(btrim(_reference)) = 0 THEN RAISE EXCEPTION 'reference required'; END IF;
  IF _status NOT IN ('pending','paid','failed','cancelled','refunded') THEN
    RAISE EXCEPTION 'invalid status: %', _status;
  END IF;

  SELECT * INTO existing FROM public.orders WHERE code = btrim(_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found: %', _code; END IF;

  -- Idempotency: same reference + status = no-op
  IF existing.payment_reference IS NOT NULL
     AND existing.payment_reference = _reference
     AND existing.payment_status = _status THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'code', existing.code, 'payment_status', existing.payment_status);
  END IF;

  -- Reject reference collision across different orders
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE payment_reference = _reference AND code <> existing.code
  ) THEN
    RAISE EXCEPTION 'payment reference already used by another order';
  END IF;

  -- Amount verification for paid state
  IF _status = 'paid' AND _amount IS NOT NULL AND _amount <> existing.total THEN
    RAISE EXCEPTION 'amount mismatch: expected %, got %', existing.total, _amount;
  END IF;

  -- Advance pickup status on success
  new_pickup := existing.pickup_status;
  IF _status = 'paid' AND existing.pickup_status = 'pending' THEN
    new_pickup := 'confirmed';
  END IF;

  UPDATE public.orders SET
    payment_status = _status,
    payment_provider = COALESCE(_provider, payment_provider),
    payment_reference = _reference,
    payment_amount = COALESCE(_amount, payment_amount),
    payment_meta = COALESCE(_meta, payment_meta),
    payment_updated_at = now(),
    pickup_status = new_pickup
  WHERE id = existing.id;

  RETURN jsonb_build_object('ok', true, 'code', existing.code, 'payment_status', _status);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payment_result(text, text, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payment_result(text, text, text, text, integer, jsonb) TO anon, authenticated, service_role;
