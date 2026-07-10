
-- 1. Remove permissive public UPDATE on customers (PII tampering risk)
DROP POLICY IF EXISTS "public updates customers" ON public.customers;

CREATE POLICY "admin updates customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Lock down SECURITY DEFINER functions from direct API execution.
-- has_role is only needed inside RLS policies (evaluated with definer rights),
-- and set_order_code is a trigger function.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_code() FROM PUBLIC, anon, authenticated;
