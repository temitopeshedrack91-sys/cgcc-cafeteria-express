ALTER TABLE public.vendors DROP CONSTRAINT vendors_vendor_type_key;
COMMENT ON TABLE public.vendors IS 'One row per vendor staff login; several logins may share a vendor_type section.';