-- Staff accounts: display label + per-account stock management permission
ALTER TABLE public.vendors ADD COLUMN display_label text;
ALTER TABLE public.vendors ADD COLUMN can_manage_stock boolean NOT NULL DEFAULT true;

UPDATE public.vendors SET display_label = CASE vendor_type
  WHEN 'food' THEN 'Food Vendor'
  WHEN 'snacks' THEN 'Snacks Vendor'
  WHEN 'coffee' THEN 'Coffee Vendor'
  WHEN 'drinks' THEN 'Drinks Vendor'
  ELSE vendor_type END
WHERE display_label IS NULL;

-- Helper: does this user's staff account allow stock changes?
CREATE OR REPLACE FUNCTION public.vendor_can_manage_stock(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT can_manage_stock FROM public.vendors WHERE user_id = _user_id AND active = true LIMIT 1), false)
$$;

-- Enforce the permission inside the three stock functions (admins always allowed)
CREATE OR REPLACE FUNCTION public.adjust_stock(_item_id text, _new_qty integer, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  IF NOT is_admin THEN
    IF caller_vendor IS NULL OR caller_vendor <> it_vendor THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT public.vendor_can_manage_stock(auth.uid()) THEN
      RAISE EXCEPTION 'stock management is disabled for your account';
    END IF;
  END IF;
  src := CASE WHEN is_admin THEN 'admin_override' ELSE 'manual' END;

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
END $function$;

CREATE OR REPLACE FUNCTION public.adjust_stock_split(_item_id text, _online integer, _walkin integer, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  IF NOT is_admin THEN
    IF caller_vendor IS NULL OR caller_vendor <> it_vendor THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT public.vendor_can_manage_stock(auth.uid()) THEN
      RAISE EXCEPTION 'stock management is disabled for your account';
    END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.reallocate_stock(_item_id text, _delta_to_online integer, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  IF NOT is_admin THEN
    IF caller_vendor IS NULL OR caller_vendor <> it_vendor THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT public.vendor_can_manage_stock(auth.uid()) THEN
      RAISE EXCEPTION 'stock management is disabled for your account';
    END IF;
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
END $function$;