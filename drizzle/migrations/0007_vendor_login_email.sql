ALTER TABLE public.vendors ADD COLUMN login_email text;
UPDATE public.vendors SET login_email = username || '@vendor.cgcc.local' WHERE login_email IS NULL;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_username_key UNIQUE (username);
COMMENT ON COLUMN public.vendors.login_email IS 'Auth login email used by /vendor/login to resolve a username';