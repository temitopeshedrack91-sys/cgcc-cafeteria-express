-- 1) Category correction: Bread Roll + Bread Loaf → Food vendor
UPDATE public.menu_items SET vendor_type = 'food' WHERE id IN ('sp9','sp10');

-- 2) Split stock columns
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS stock_online INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_walkin INTEGER NOT NULL DEFAULT 0;

-- Backfill: put current stock into walk-in bucket (cashier-heavy), online starts at 0.
-- Vendors reallocate from the UI.
UPDATE public.menu_items
   SET stock_walkin = GREATEST(COALESCE(stock_qty,0), 0),
       stock_online = 0
 WHERE stock_walkin = 0 AND stock_online = 0;

-- Keep stock_qty always in sync with the two buckets
CREATE OR REPLACE FUNCTION public.sync_menu_stock_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.stock_online := GREATEST(COALESCE(NEW.stock_online,0), 0);
  NEW.stock_walkin := GREATEST(COALESCE(NEW.stock_walkin,0), 0);
  NEW.stock_qty := NEW.stock_online + NEW.stock_walkin;
  IF NEW.stock_qty <= 0 THEN
    NEW.available := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS menu_items_sync_stock ON public.menu_items;
CREATE TRIGGER menu_items_sync_stock
  BEFORE INSERT OR UPDATE OF stock_online, stock_walkin, stock_qty ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_menu_stock_total();

-- Refresh totals now
UPDATE public.menu_items SET stock_online = stock_online;

-- 3) Update decrement trigger: online orders → stock_online, walk-in → stock_walkin
CREATE OR REPLACE FUNCTION public.decrement_stock_from_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  next_online INTEGER; next_walkin INTEGER; next_total INTEGER;
  it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  src TEXT;
BEGIN
  IF TG_TABLE_NAME = 'order_items' THEN src := 'online_order';
  ELSE src := 'walk_in'; END IF;

  SELECT stock_online, stock_walkin, stock_qty, available, name, vendor_type
    INTO prev_online, prev_walkin, prev_total, cur_available, it_name, it_vendor
    FROM public.menu_items WHERE id = NEW.menu_item_id FOR UPDATE;

  IF prev_total IS NULL THEN RETURN NEW; END IF;

  IF src = 'online_order' THEN
    next_online := GREATEST(prev_online - NEW.qty, 0);
    next_walkin := prev_walkin;
  ELSE
    next_online := prev_online;
    next_walkin := GREATEST(prev_walkin - NEW.qty, 0);
  END IF;
  next_total := next_online + next_walkin;

  UPDATE public.menu_items
     SET stock_online = next_online,
         stock_walkin = next_walkin
   WHERE id = NEW.menu_item_id;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by, changed_by_label)
  VALUES
    (NEW.menu_item_id, it_name, it_vendor, prev_total, next_total, next_total - prev_total,
     CASE WHEN src='online_order' THEN 'Online order (online stock)' ELSE 'Walk-in sale (walk-in stock)' END,
     src, auth.uid(), NULL);
  RETURN NEW;
END $$;

-- 4) adjust_stock now interprets _new_qty as the TOTAL; we keep API-compat but re-route
--    to walk-in bucket by default (legacy admin/vendor manual adjust). New RPCs below are preferred.
CREATE OR REPLACE FUNCTION public.adjust_stock(_item_id text, _new_qty integer, _reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  diff INTEGER;
BEGIN
  IF _new_qty IS NULL OR _new_qty < 0 THEN RAISE EXCEPTION 'new qty must be >= 0'; END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type, available
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor, cur_available
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin AND (caller_vendor IS NULL OR caller_vendor <> it_vendor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;

  -- Distribute delta: apply to walk-in first (down or up), then online
  diff := _new_qty - prev_total;
  IF diff >= 0 THEN
    UPDATE public.menu_items SET stock_walkin = prev_walkin + diff WHERE id = _item_id;
  ELSE
    IF prev_walkin >= (-diff) THEN
      UPDATE public.menu_items SET stock_walkin = prev_walkin + diff WHERE id = _item_id;
    ELSE
      UPDATE public.menu_items
         SET stock_walkin = 0,
             stock_online = GREATEST(prev_online + (diff + prev_walkin), 0)
       WHERE id = _item_id;
    END IF;
  END IF;

  IF _new_qty > 0 AND cur_available = false THEN
    UPDATE public.menu_items SET available = true WHERE id = _item_id;
  END IF;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, _new_qty, _new_qty - prev_total,
          NULLIF(btrim(COALESCE(_reason,'')), ''), src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'previous', prev_total, 'new', _new_qty);
END $$;

-- 5) New: absolute set of both buckets
CREATE OR REPLACE FUNCTION public.adjust_stock_split(
  _item_id text, _online integer, _walkin integer, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT; cur_available BOOLEAN;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  next_total INTEGER;
BEGIN
  IF _online IS NULL OR _walkin IS NULL OR _online < 0 OR _walkin < 0 THEN
    RAISE EXCEPTION 'quantities must be >= 0';
  END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type, available
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor, cur_available
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin AND (caller_vendor IS NULL OR caller_vendor <> it_vendor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;

  UPDATE public.menu_items SET stock_online = _online, stock_walkin = _walkin WHERE id = _item_id;
  next_total := _online + _walkin;
  IF next_total > 0 AND cur_available = false THEN
    UPDATE public.menu_items SET available = true WHERE id = _item_id;
  END IF;

  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, next_total, next_total - prev_total,
          COALESCE(NULLIF(btrim(COALESCE(_reason,'')), ''), 'Split adjust: online=' || _online || ', walkin=' || _walkin),
          src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'online', _online, 'walkin', _walkin, 'total', next_total);
END $$;

-- 6) Reallocate: move qty between buckets (delta > 0 means walk-in → online; < 0 means online → walk-in)
CREATE OR REPLACE FUNCTION public.reallocate_stock(
  _item_id text, _delta_to_online integer, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_online INTEGER; prev_walkin INTEGER; prev_total INTEGER;
  it_name TEXT; it_vendor TEXT;
  is_admin BOOLEAN; caller_vendor TEXT; src TEXT;
  next_online INTEGER; next_walkin INTEGER;
BEGIN
  IF _delta_to_online IS NULL OR _delta_to_online = 0 THEN
    RAISE EXCEPTION 'delta must be non-zero';
  END IF;
  SELECT stock_online, stock_walkin, stock_qty, name, vendor_type
    INTO prev_online, prev_walkin, prev_total, it_name, it_vendor
    FROM public.menu_items WHERE id = _item_id FOR UPDATE;
  IF prev_total IS NULL THEN RAISE EXCEPTION 'Unknown menu item'; END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  caller_vendor := public.vendor_type_for_user(auth.uid());
  IF NOT is_admin AND (caller_vendor IS NULL OR caller_vendor <> it_vendor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  next_online := prev_online + _delta_to_online;
  next_walkin := prev_walkin - _delta_to_online;
  IF next_online < 0 OR next_walkin < 0 THEN
    RAISE EXCEPTION 'insufficient stock in source bucket';
  END IF;

  UPDATE public.menu_items SET stock_online = next_online, stock_walkin = next_walkin WHERE id = _item_id;

  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;
  INSERT INTO public.inventory_history
    (menu_item_id, item_name, vendor_type, previous_qty, new_qty, delta, reason, source, changed_by)
  VALUES (_item_id, it_name, it_vendor, prev_total, prev_total, 0,
          COALESCE(NULLIF(btrim(COALESCE(_reason,'')), ''),
                   'Reallocate: ' || CASE WHEN _delta_to_online > 0 THEN 'walk-in→online' ELSE 'online→walk-in' END
                   || ' ' || ABS(_delta_to_online)),
          src, auth.uid());

  RETURN jsonb_build_object('ok', true, 'online', next_online, 'walkin', next_walkin, 'total', prev_total);
END $$;

REVOKE ALL ON FUNCTION public.adjust_stock_split(text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock_split(text, integer, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.reallocate_stock(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reallocate_stock(text, integer, text) TO authenticated;