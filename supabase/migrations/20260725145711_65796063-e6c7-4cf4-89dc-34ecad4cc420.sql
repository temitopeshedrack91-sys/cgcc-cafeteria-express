
-- 1. business_day_closures: admin write policies
CREATE POLICY "admin inserts closures" ON public.business_day_closures
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin updates closures" ON public.business_day_closures
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin deletes closures" ON public.business_day_closures
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Tighten customers INSERT policy (replace WITH CHECK true)
DROP POLICY IF EXISTS "public inserts customers" ON public.customers;
CREATE POLICY "guests insert customers" ON public.customers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(name)) BETWEEN 1 AND 100
    AND length(btrim(phone)) BETWEEN 6 AND 20
  );

-- 3. Revoke EXECUTE from anon on privileged SECURITY DEFINER functions.
--    Keep anon access on: create_customer_order (both overloads),
--    get_order_by_code, get_orders_by_phone, apply_payment_result
--    (all needed for guest checkout / receipt / payment return).
REVOKE EXECUTE ON FUNCTION public.adjust_stock(text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_business_day(date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_cashier_sale(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_inventory_history(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reopen_business_day(date) FROM anon;
