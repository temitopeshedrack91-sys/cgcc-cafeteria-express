-- 0005: cost prices for products, configurable vendor payout rates + payout snapshot history.

-- 1) Cost price column (used by itemised exports and payout snapshots).
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS cost_price integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.menu_items.cost_price IS 'Internal cost of goods per unit (NGN); used for itemised exports and payout reporting.';

-- 2) Extend upsert_menu_item with an optional cost price.
CREATE OR REPLACE FUNCTION public.upsert_menu_item(
  _id text, _name text, _category_id text, _price integer, _vendor_type text,
  _description text DEFAULT NULL, _image_url text DEFAULT NULL, _available boolean DEFAULT true,
  _cost_price integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE existing public.menu_items%ROWTYPE; new_id TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _price IS NULL OR _price < 0 THEN RAISE EXCEPTION 'price must be >= 0'; END IF;
  IF _cost_price IS NOT NULL AND _cost_price < 0 THEN RAISE EXCEPTION 'cost price must be >= 0'; END IF;
  IF _vendor_type NOT IN ('food','snacks','coffee','drinks') THEN RAISE EXCEPTION 'invalid vendor_type'; END IF;

  IF _id IS NULL OR length(btrim(_id)) = 0 THEN
    new_id := 'p_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  ELSE
    new_id := btrim(_id);
  END IF;

  SELECT * INTO existing FROM public.menu_items WHERE id = new_id;
  IF NOT FOUND THEN
    INSERT INTO public.menu_items (id, name, category_id, price, vendor_type, description, image_url, available, stock_qty, stock_online, stock_walkin, low_stock_threshold, cost_price)
    VALUES (new_id, btrim(_name), _category_id, _price, _vendor_type, _description, _image_url, COALESCE(_available, true), 0, 0, 0, 10, COALESCE(_cost_price, 0));
    PERFORM public.log_audit('product.create', 'menu_item', new_id,
      jsonb_build_object('name', _name, 'price', _price, 'vendor_type', _vendor_type, 'cost_price', COALESCE(_cost_price, 0)));
  ELSE
    UPDATE public.menu_items SET
      name = btrim(_name),
      category_id = COALESCE(_category_id, category_id),
      price = _price,
      vendor_type = _vendor_type,
      description = _description,
      image_url = _image_url,
      available = COALESCE(_available, available),
      cost_price = COALESCE(_cost_price, existing.cost_price)
    WHERE id = new_id;
    IF existing.price <> _price THEN
      PERFORM public.log_audit('product.price_change', 'menu_item', new_id,
        jsonb_build_object('from', existing.price, 'to', _price, 'name', _name));
    END IF;
    PERFORM public.log_audit('product.update', 'menu_item', new_id,
      jsonb_build_object('name', _name, 'price', _price, 'cost_price', COALESCE(_cost_price, existing.cost_price)));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END
$function$;

DROP FUNCTION IF EXISTS public.upsert_menu_item(text, text, text, integer, text, text, text, boolean);

-- 3) Admin RPC to set just the cost price of a product.
CREATE OR REPLACE FUNCTION public.set_product_cost(_id text, _cost_price integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _cost_price IS NULL OR _cost_price < 0 THEN RAISE EXCEPTION 'cost price must be >= 0'; END IF;
  UPDATE public.menu_items SET cost_price = _cost_price WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  PERFORM public.log_audit('product.cost_change', 'menu_item', _id, jsonb_build_object('cost_price', _cost_price));
  RETURN jsonb_build_object('ok', true);
END
$function$;

-- 4) Payout snapshot history (one row per vendor per business day).
CREATE TABLE public.payout_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_type text NOT NULL,
  business_day date NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  gross_revenue integer NOT NULL DEFAULT 0,
  cost_total integer NOT NULL DEFAULT 0,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  payout_amount integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_type, business_day)
);
COMMENT ON TABLE public.payout_snapshots IS 'Historical payout/commission snapshots per vendor per business day.';

GRANT SELECT ON public.payout_snapshots TO authenticated;
GRANT ALL ON public.payout_snapshots TO service_role;

ALTER TABLE public.payout_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payout snapshots"
  ON public.payout_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Admin RPC to record/update a snapshot for a vendor + day.
CREATE OR REPLACE FUNCTION public.save_payout_snapshot(
  _vendor_type text, _business_day date, _orders_count integer, _items_count integer,
  _gross_revenue integer, _cost_total integer, _commission_percent numeric, _payout_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _vendor_type NOT IN ('food','snacks','coffee','drinks') THEN RAISE EXCEPTION 'invalid vendor_type'; END IF;
  IF _business_day IS NULL THEN RAISE EXCEPTION 'business_day required'; END IF;
  IF _commission_percent IS NULL OR _commission_percent < 0 OR _commission_percent > 100 THEN RAISE EXCEPTION 'commission percent must be between 0 and 100'; END IF;

  INSERT INTO public.payout_snapshots (
    vendor_type, business_day, orders_count, items_count, gross_revenue, cost_total,
    commission_percent, payout_amount, created_by
  ) VALUES (
    _vendor_type, _business_day, COALESCE(_orders_count, 0), COALESCE(_items_count, 0),
    COALESCE(_gross_revenue, 0), COALESCE(_cost_total, 0), _commission_percent, COALESCE(_payout_amount, 0), auth.uid()
  )
  ON CONFLICT (vendor_type, business_day) DO UPDATE SET
    orders_count = EXCLUDED.orders_count,
    items_count = EXCLUDED.items_count,
    gross_revenue = EXCLUDED.gross_revenue,
    cost_total = EXCLUDED.cost_total,
    commission_percent = EXCLUDED.commission_percent,
    payout_amount = EXCLUDED.payout_amount,
    created_by = auth.uid(),
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END
$function$;