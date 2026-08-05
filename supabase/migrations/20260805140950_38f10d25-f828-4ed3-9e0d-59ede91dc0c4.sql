ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS categories_touch_updated_at ON public.categories;
CREATE TRIGGER categories_touch_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- CATEGORY MANAGEMENT ----------
CREATE OR REPLACE FUNCTION public.upsert_category(_id text, _name text, _sort_order integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id TEXT; existing public.categories%ROWTYPE; next_sort INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  new_id := COALESCE(NULLIF(btrim(COALESCE(_id,'')),''), 'c_' || substr(md5(random()::text || clock_timestamp()::text),1,10));
  SELECT * INTO existing FROM public.categories WHERE id = new_id;
  IF NOT FOUND THEN
    SELECT COALESCE(MAX(sort_order),0)+1 INTO next_sort FROM public.categories;
    INSERT INTO public.categories (id, name, sort_order)
    VALUES (new_id, btrim(_name), COALESCE(_sort_order, next_sort));
    PERFORM public.log_audit('category.create','category',new_id, jsonb_build_object('name',_name));
  ELSE
    UPDATE public.categories
       SET name = btrim(_name), sort_order = COALESCE(_sort_order, sort_order)
     WHERE id = new_id;
    PERFORM public.log_audit('category.update','category',new_id,
      jsonb_build_object('from', existing.name, 'to', btrim(_name)));
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;

CREATE OR REPLACE FUNCTION public.archive_category(_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.categories SET archived_at = now() WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown category'; END IF;
  PERFORM public.log_audit('category.archive','category',_id,'{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.restore_category(_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.categories SET archived_at = NULL WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown category'; END IF;
  PERFORM public.log_audit('category.restore','category',_id,'{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.delete_category(_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO n FROM public.menu_items WHERE category_id = _id;
  IF n > 0 THEN RAISE EXCEPTION 'category still has % product(s) — move them first', n; END IF;
  DELETE FROM public.categories WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown category'; END IF;
  PERFORM public.log_audit('category.delete','category',_id,'{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.reorder_categories(_ids text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ids IS NULL THEN RAISE EXCEPTION 'ids required'; END IF;
  FOR i IN 1 .. array_length(_ids,1) LOOP
    UPDATE public.categories SET sort_order = i WHERE id = _ids[i];
  END LOOP;
  PERFORM public.log_audit('category.reorder','category',NULL, jsonb_build_object('order',_ids));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------- PRODUCT: DUPLICATE ----------
CREATE OR REPLACE FUNCTION public.duplicate_menu_item(_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE src public.menu_items%ROWTYPE; new_id TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO src FROM public.menu_items WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown product'; END IF;
  new_id := 'p_' || substr(md5(random()::text || clock_timestamp()::text),1,10);
  INSERT INTO public.menu_items
    (id, name, category_id, price, vendor_type, description, image_url, available,
     stock_qty, stock_online, stock_walkin, low_stock_threshold, sort_order)
  VALUES
    (new_id, src.name || ' (Copy)', src.category_id, src.price, src.vendor_type,
     src.description, src.image_url, false, 0, 0, 0, src.low_stock_threshold, src.sort_order);
  PERFORM public.log_audit('product.duplicate','menu_item',new_id, jsonb_build_object('from',_id,'name',src.name));
  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;

-- ---------- PRODUCT: BULK ACTIONS ----------
CREATE OR REPLACE FUNCTION public.bulk_update_products(_ids text[], _action text, _value numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n INTEGER := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ids IS NULL OR array_length(_ids,1) IS NULL THEN RAISE EXCEPTION 'no products selected'; END IF;

  IF _action = 'enable' THEN
    UPDATE public.menu_items SET available = true WHERE id = ANY(_ids) AND stock_qty > 0;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'disable' THEN
    UPDATE public.menu_items SET available = false WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'archive' THEN
    UPDATE public.menu_items SET archived_at = now(), available = false WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'restore' THEN
    UPDATE public.menu_items SET archived_at = NULL WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'price_set' THEN
    IF _value IS NULL OR _value < 0 THEN RAISE EXCEPTION 'valid price required'; END IF;
    UPDATE public.menu_items SET price = round(_value)::int WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'price_percent' THEN
    IF _value IS NULL THEN RAISE EXCEPTION 'percent required'; END IF;
    UPDATE public.menu_items
       SET price = GREATEST(round(price * (1 + _value/100.0))::int, 0)
     WHERE id = ANY(_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF _action = 'vendor' THEN
    RAISE EXCEPTION 'use bulk_move_vendor';
  ELSE
    RAISE EXCEPTION 'unknown action: %', _action;
  END IF;

  PERFORM public.log_audit('product.bulk_' || _action, 'menu_item', NULL,
    jsonb_build_object('count', n, 'value', _value, 'ids', _ids));
  RETURN jsonb_build_object('ok', true, 'updated', n);
END $$;

CREATE OR REPLACE FUNCTION public.bulk_move_products(_ids text[], _vendor_type text DEFAULT NULL, _category_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n INTEGER := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ids IS NULL OR array_length(_ids,1) IS NULL THEN RAISE EXCEPTION 'no products selected'; END IF;
  IF _vendor_type IS NOT NULL AND _vendor_type NOT IN ('food','snacks','coffee','drinks') THEN
    RAISE EXCEPTION 'invalid vendor_type';
  END IF;
  UPDATE public.menu_items
     SET vendor_type = COALESCE(_vendor_type, vendor_type),
         category_id = COALESCE(_category_id, category_id)
   WHERE id = ANY(_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.log_audit('product.bulk_move','menu_item',NULL,
    jsonb_build_object('count',n,'vendor_type',_vendor_type,'category_id',_category_id,'ids',_ids));
  RETURN jsonb_build_object('ok', true, 'updated', n);
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_category(text,text,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_category(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_category(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_category(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reorder_categories(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_menu_item(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bulk_update_products(text[],text,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bulk_move_products(text[],text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.upsert_category(text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_categories(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_menu_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_products(text[],text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_move_products(text[],text,text) TO authenticated;