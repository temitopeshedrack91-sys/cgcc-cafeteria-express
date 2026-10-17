DROP TRIGGER order_items_enforce_price ON public.order_items;
CREATE TRIGGER order_items_enforce_price BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION enforce_order_item_price();