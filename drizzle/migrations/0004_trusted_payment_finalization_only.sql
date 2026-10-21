REVOKE EXECUTE ON FUNCTION public.apply_payment_result(text,text,text,text,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_result(text,text,text,text,integer,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.enforce_verified_payment_amount() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.payment_status = 'paid' AND NEW.payment_provider IS NOT NULL AND NEW.payment_provider <> 'manual_transfer' AND (NEW.payment_amount IS NULL OR NEW.payment_amount <> NEW.total) THEN RAISE EXCEPTION 'Verified payment amount must equal order total'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER verified_payment_amount BEFORE UPDATE OF payment_status, payment_amount ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_payment_amount();