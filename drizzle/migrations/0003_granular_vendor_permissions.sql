ALTER TABLE public.vendors ADD COLUMN can_increase_stock boolean NOT NULL DEFAULT true, ADD COLUMN can_reduce_stock boolean NOT NULL DEFAULT true, ADD COLUMN can_reallocate_stock boolean NOT NULL DEFAULT true, ADD COLUMN can_update_preparation boolean NOT NULL DEFAULT true;
UPDATE public.vendors SET can_increase_stock = can_manage_stock, can_reduce_stock = can_manage_stock, can_reallocate_stock = can_manage_stock;
COMMENT ON COLUMN public.vendors.can_manage_stock IS 'Legacy master stock switch; granular action permissions also apply.';
CREATE OR REPLACE FUNCTION public.vendor_has_permission(_user_id uuid, _permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM public.vendors v WHERE v.user_id = _user_id AND v.active AND CASE _permission WHEN 'increase_stock' THEN v.can_manage_stock AND v.can_increase_stock WHEN 'reduce_stock' THEN v.can_manage_stock AND v.can_reduce_stock WHEN 'reallocate_stock' THEN v.can_manage_stock AND v.can_reallocate_stock WHEN 'update_preparation' THEN v.can_update_preparation ELSE false END);
$$;
REVOKE ALL ON FUNCTION public.vendor_has_permission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_has_permission(uuid,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.enforce_vendor_stock_permissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE increasing boolean; reducing boolean; moving boolean;
BEGIN
 IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vendors WHERE user_id = auth.uid()) THEN RETURN NEW; END IF;
 IF OLD.vendor_type IS DISTINCT FROM public.vendor_type_for_user(auth.uid()) THEN RAISE EXCEPTION 'Forbidden: inactive account or unassigned product'; END IF;
 increasing := NEW.stock_online > OLD.stock_online OR NEW.stock_walkin > OLD.stock_walkin;
 reducing := NEW.stock_online < OLD.stock_online OR NEW.stock_walkin < OLD.stock_walkin;
 moving := (NEW.stock_online > OLD.stock_online AND NEW.stock_walkin < OLD.stock_walkin) OR (NEW.stock_online < OLD.stock_online AND NEW.stock_walkin > OLD.stock_walkin);
 IF moving AND NOT public.vendor_has_permission(auth.uid(), 'reallocate_stock') THEN RAISE EXCEPTION 'Stock reallocation is not permitted'; END IF;
 IF NEW.stock_online + NEW.stock_walkin > OLD.stock_online + OLD.stock_walkin AND NOT public.vendor_has_permission(auth.uid(), 'increase_stock') THEN RAISE EXCEPTION 'Increasing stock is not permitted'; END IF;
 IF NEW.stock_online + NEW.stock_walkin < OLD.stock_online + OLD.stock_walkin AND NOT public.vendor_has_permission(auth.uid(), 'reduce_stock') THEN RAISE EXCEPTION 'Reducing stock is not permitted'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER vendor_stock_permissions BEFORE UPDATE OF stock_online, stock_walkin ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_stock_permissions();
CREATE OR REPLACE FUNCTION public.vendor_set_preparation_status(_item_id uuid, _status text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it_vendor text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _status IS NULL OR _status NOT IN ('pending','preparing','ready','collected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 SELECT vendor_type INTO it_vendor FROM public.order_items WHERE id = _item_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown order item'; END IF;
 IF NOT public.has_role(auth.uid(),'admin') AND (it_vendor IS DISTINCT FROM public.vendor_type_for_user(auth.uid()) OR NOT public.vendor_has_permission(auth.uid(),'update_preparation')) THEN RAISE EXCEPTION 'Preparation updates are not permitted'; END IF;
 UPDATE public.order_items SET preparation_status = _status WHERE id = _item_id;
 RETURN jsonb_build_object('ok',true,'status',_status);
END;
$$;
CREATE OR REPLACE FUNCTION public.vendor_set_item_availability(_id text, _available boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it_vendor text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT vendor_type INTO it_vendor FROM public.menu_items WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown product'; END IF;
 IF NOT public.has_role(auth.uid(),'admin') AND (it_vendor IS DISTINCT FROM public.vendor_type_for_user(auth.uid()) OR public.vendor_type_for_user(auth.uid()) IS NULL) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.menu_items SET available = COALESCE(_available,false) WHERE id = _id;
 PERFORM public.log_audit('product.availability','menu_item',_id,jsonb_build_object('available',COALESCE(_available,false)));
 RETURN jsonb_build_object('ok',true);
END;
$$;
CREATE OR REPLACE FUNCTION public.vendor_set_low_stock_threshold(_id text, _threshold integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it_vendor text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _threshold IS NULL OR _threshold < 0 THEN RAISE EXCEPTION 'Threshold must be >= 0'; END IF;
 SELECT vendor_type INTO it_vendor FROM public.menu_items WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown product'; END IF;
 IF NOT public.has_role(auth.uid(),'admin') AND (it_vendor IS DISTINCT FROM public.vendor_type_for_user(auth.uid()) OR public.vendor_type_for_user(auth.uid()) IS NULL) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.menu_items SET low_stock_threshold = _threshold WHERE id = _id;
 RETURN jsonb_build_object('ok',true);
END;
$$;