ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS narration text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.bank_accounts b SET sort_order = s.rn
FROM (SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.bank_accounts) s
WHERE b.id = s.id AND b.sort_order = 0;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS transfer_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS transfer_reference text,
  ADD COLUMN IF NOT EXISTS proof_url text;

CREATE OR REPLACE FUNCTION public.reorder_bank_accounts(_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE i INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ids IS NULL THEN RAISE EXCEPTION 'ids required'; END IF;
  FOR i IN 1 .. array_length(_ids,1) LOOP
    UPDATE public.bank_accounts SET sort_order = i WHERE id = _ids[i];
  END LOOP;
  PERFORM public.log_audit('bank.reorder','bank_accounts',NULL, jsonb_build_object('order',_ids));
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.reorder_bank_accounts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_bank_accounts(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_transfer_config(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'invalid payload'; END IF;
  INSERT INTO public.app_settings (id, transfer_config, updated_at)
  VALUES ('global', _data, now())
  ON CONFLICT (id) DO UPDATE SET transfer_config = EXCLUDED.transfer_config, updated_at = now();
  PERFORM public.log_audit('transfer.settings_update','app_settings','global','{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.save_transfer_config(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_transfer_config(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_transfer_proof(_code text, _reference text, _proof_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE code = btrim(COALESCE(_code,'')) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.payment_status = 'paid' THEN RAISE EXCEPTION 'order already paid'; END IF;
  UPDATE public.orders SET
    transfer_reference = COALESCE(NULLIF(btrim(COALESCE(_reference,'')),''), transfer_reference),
    proof_url = COALESCE(NULLIF(btrim(COALESCE(_proof_url,'')),''), proof_url),
    payment_provider = COALESCE(payment_provider, 'manual_transfer'),
    payment_updated_at = now()
  WHERE id = o.id;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.attach_transfer_proof(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_transfer_proof(text, text, text) TO anon, authenticated;