
-- Enforce authoritative pricing server-side.

-- 1. Overwrite submitted price with the real menu price; reject invalid items.
CREATE OR REPLACE FUNCTION public.enforce_order_item_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_price INTEGER;
  real_name TEXT;
  is_available BOOLEAN;
BEGIN
  IF NEW.menu_item_id IS NULL THEN
    RAISE EXCEPTION 'menu_item_id is required';
  END IF;

  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN
    RAISE EXCEPTION 'qty must be positive';
  END IF;

  SELECT price, name, available
    INTO real_price, real_name, is_available
  FROM public.menu_items
  WHERE id = NEW.menu_item_id;

  IF real_price IS NULL THEN
    RAISE EXCEPTION 'Unknown menu item: %', NEW.menu_item_id;
  END IF;

  IF NOT is_available THEN
    RAISE EXCEPTION 'Menu item is not available: %', NEW.menu_item_id;
  END IF;

  NEW.price := real_price;
  NEW.name := real_name;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_order_item_price() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_enforce_price ON public.order_items;
CREATE TRIGGER order_items_enforce_price
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_price();

-- 2. Recompute the parent order's total from its items after any change.
CREATE OR REPLACE FUNCTION public.recompute_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_order_id UUID;
BEGIN
  target_order_id := COALESCE(NEW.order_id, OLD.order_id);
  UPDATE public.orders
     SET total = COALESCE((
       SELECT SUM(price * qty)::INTEGER
       FROM public.order_items
       WHERE order_id = target_order_id
     ), 0)
   WHERE id = target_order_id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_order_total() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_recompute_total ON public.order_items;
CREATE TRIGGER order_items_recompute_total
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_order_total();

-- 3. Zero out orders.total on insert; it will be recomputed from real item prices.
CREATE OR REPLACE FUNCTION public.reset_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total := 0;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_order_total() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_reset_total ON public.orders;
CREATE TRIGGER orders_reset_total
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.reset_order_total();
