
-- 1. Add business_day + archived_at columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS business_day date,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.cashier_sales
  ADD COLUMN IF NOT EXISTS business_day date,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Backfill from created_at in Africa/Lagos
UPDATE public.orders
  SET business_day = (created_at AT TIME ZONE 'Africa/Lagos')::date
  WHERE business_day IS NULL;

UPDATE public.cashier_sales
  SET business_day = (created_at AT TIME ZONE 'Africa/Lagos')::date
  WHERE business_day IS NULL;

-- Auto-set business_day on insert
CREATE OR REPLACE FUNCTION public.set_business_day()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.business_day IS NULL THEN
    NEW.business_day := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Africa/Lagos')::date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_set_business_day ON public.orders;
CREATE TRIGGER orders_set_business_day
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_business_day();

DROP TRIGGER IF EXISTS cashier_sales_set_business_day ON public.cashier_sales;
CREATE TRIGGER cashier_sales_set_business_day
  BEFORE INSERT ON public.cashier_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_business_day();

CREATE INDEX IF NOT EXISTS orders_business_day_idx ON public.orders (business_day DESC);
CREATE INDEX IF NOT EXISTS orders_archived_idx    ON public.orders (archived_at);
CREATE INDEX IF NOT EXISTS cashier_sales_business_day_idx ON public.cashier_sales (business_day DESC);
CREATE INDEX IF NOT EXISTS cashier_sales_archived_idx     ON public.cashier_sales (archived_at);

-- 2. Business Day closures table
CREATE TABLE IF NOT EXISTS public.business_day_closures (
  business_day date PRIMARY KEY,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id),
  note text
);

GRANT SELECT ON public.business_day_closures TO authenticated;
GRANT ALL ON public.business_day_closures TO service_role;

ALTER TABLE public.business_day_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads closures" ON public.business_day_closures;
CREATE POLICY "admin reads closures" ON public.business_day_closures
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Close / reopen RPCs
CREATE OR REPLACE FUNCTION public.close_business_day(_day date DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_day date;
  affected_orders int;
  affected_sales int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  target_day := COALESCE(_day, (now() AT TIME ZONE 'Africa/Lagos')::date);

  INSERT INTO public.business_day_closures (business_day, closed_by, note)
  VALUES (target_day, auth.uid(), NULLIF(btrim(COALESCE(_note,'')), ''))
  ON CONFLICT (business_day) DO UPDATE
    SET closed_at = now(), closed_by = auth.uid(), note = EXCLUDED.note;

  UPDATE public.orders
    SET archived_at = COALESCE(archived_at, now())
    WHERE business_day = target_day;
  GET DIAGNOSTICS affected_orders = ROW_COUNT;

  UPDATE public.cashier_sales
    SET archived_at = COALESCE(archived_at, now())
    WHERE business_day = target_day;
  GET DIAGNOSTICS affected_sales = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'business_day', target_day,
    'orders_archived', affected_orders,
    'cashier_sales_archived', affected_sales
  );
END $$;

REVOKE ALL ON FUNCTION public.close_business_day(date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_business_day(date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_business_day(_day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.business_day_closures WHERE business_day = _day;
  UPDATE public.orders SET archived_at = NULL WHERE business_day = _day;
  UPDATE public.cashier_sales SET archived_at = NULL WHERE business_day = _day;
  RETURN jsonb_build_object('ok', true, 'business_day', _day);
END $$;

REVOKE ALL ON FUNCTION public.reopen_business_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_business_day(date) TO authenticated;

-- 4. Current business day helper (single source of truth for clients)
CREATE OR REPLACE FUNCTION public.current_business_day()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Africa/Lagos')::date $$;

REVOKE ALL ON FUNCTION public.current_business_day() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_business_day() TO anon, authenticated;
