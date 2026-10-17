-- 1. Payment gateway secrets vault: locked table, service_role + admin-only definer RPCs only
CREATE TABLE public.payment_secrets (
  id text PRIMARY KEY,
  secrets jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_secrets TO service_role;
ALTER TABLE public.payment_secrets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_payment_secrets()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((SELECT secrets FROM public.payment_secrets WHERE id='global'), '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.save_payment_secrets(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'invalid payload'; END IF;
  INSERT INTO public.payment_secrets (id, secrets, updated_at) VALUES ('global', _data, now())
  ON CONFLICT (id) DO UPDATE SET secrets = EXCLUDED.secrets, updated_at = now();
  PERFORM public.log_audit('payment.secrets_update','payment_secrets','global','{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

-- Backfill: move credentials out of the publicly readable app_settings row
INSERT INTO public.payment_secrets (id, secrets)
SELECT 'global', jsonb_build_object(
  'credentials', COALESCE(payment_config->'credentials','{}'::jsonb),
  'legacy', jsonb_build_object(
    'merchantId', COALESCE(payment_config->>'merchantId',''),
    'publicKey', COALESCE(payment_config->>'publicKey',''),
    'secretKey', COALESCE(payment_config->>'secretKey',''),
    'webhookSecret', COALESCE(payment_config->>'webhookSecret','')))
FROM public.app_settings WHERE id='global'
ON CONFLICT (id) DO NOTHING;

UPDATE public.app_settings
SET payment_config = payment_config - 'credentials' - 'secretKey' - 'webhookSecret' - 'merchantId' - 'publicKey'
WHERE id='global';

-- 2. Vendors can no longer edit product rows directly; availability + threshold via RPC only
DROP POLICY "vendor updates own menu items" ON public.menu_items;

CREATE OR REPLACE FUNCTION public.vendor_set_item_availability(_id text, _available boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it_vendor TEXT; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT vendor_type INTO it_vendor FROM public.menu_items WHERE id = _id;
  IF it_vendor IS NULL THEN RAISE EXCEPTION 'unknown product'; END IF;
  is_admin := public.has_role(auth.uid(),'admin');
  IF NOT is_admin AND it_vendor <> public.vendor_type_for_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.menu_items SET available = COALESCE(_available, false) WHERE id = _id;
  PERFORM public.log_audit('product.availability','menu_item',_id, jsonb_build_object('available', COALESCE(_available, false)));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.vendor_set_low_stock_threshold(_id text, _threshold integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it_vendor TEXT; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _threshold IS NULL OR _threshold < 0 THEN RAISE EXCEPTION 'threshold must be >= 0'; END IF;
  SELECT vendor_type INTO it_vendor FROM public.menu_items WHERE id = _id;
  IF it_vendor IS NULL THEN RAISE EXCEPTION 'unknown product'; END IF;
  is_admin := public.has_role(auth.uid(),'admin');
  IF NOT is_admin AND it_vendor <> public.vendor_type_for_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.menu_items SET low_stock_threshold = _threshold WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 3. Vendors can no longer edit order item rows directly; preparation status via RPC only
DROP POLICY "vendor updates own prep status" ON public.order_items;

CREATE OR REPLACE FUNCTION public.vendor_set_preparation_status(_item_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it_vendor TEXT; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _status NOT IN ('pending','preparing','ready','collected') THEN RAISE EXCEPTION 'invalid status'; END IF;
  SELECT vendor_type INTO it_vendor FROM public.order_items WHERE id = _item_id;
  IF it_vendor IS NULL THEN RAISE EXCEPTION 'unknown order item'; END IF;
  is_admin := public.has_role(auth.uid(),'admin');
  IF NOT is_admin AND it_vendor <> public.vendor_type_for_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.order_items SET preparation_status = _status WHERE id = _item_id;
  RETURN jsonb_build_object('ok', true, 'status', _status);
END $$;

-- 4. Audit log entries only via protected (security definer) functions
DROP POLICY "audit_log_authenticated_insert" ON public.audit_log;