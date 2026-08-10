CREATE OR REPLACE FUNCTION public.attach_transfer_proof(_code text, _reference text, _proof_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE code = btrim(COALESCE(_code,'')) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.payment_status = 'paid' THEN RAISE EXCEPTION 'order already paid'; END IF;
  UPDATE public.orders SET
    transfer_reference = COALESCE(NULLIF(btrim(COALESCE(_reference,'')),''), transfer_reference),
    proof_url = COALESCE(NULLIF(btrim(COALESCE(_proof_url,'')),''), proof_url),
    payment_provider = COALESCE(payment_provider, 'manual_transfer'),
    payment_status = CASE WHEN payment_status = 'unpaid' THEN 'pending' ELSE payment_status END,
    payment_updated_at = now()
  WHERE id = o.id;
  RETURN jsonb_build_object('ok', true);
END $function$;