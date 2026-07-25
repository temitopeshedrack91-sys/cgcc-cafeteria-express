DROP POLICY IF EXISTS "public inserts orders" ON public.orders;
DROP POLICY IF EXISTS "public inserts order_items" ON public.order_items;
REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;