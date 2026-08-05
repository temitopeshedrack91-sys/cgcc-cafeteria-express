
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============ system_settings ============
CREATE TABLE public.system_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system settings readable" ON public.system_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin inserts system settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates system settings" ON public.system_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.system_settings (id, data) VALUES ('global', jsonb_build_object(
  'churchName','The Citadel Global Community Church',
  'cafeteriaName','CGCC Cafeteria Express',
  'churchLogoUrl','', 'cafeteriaLogoUrl','',
  'contactPhone','', 'officialEmail','', 'address','',
  'operatingDays', jsonb_build_array('Mon','Tue','Wed','Thu','Fri','Sat','Sun'),
  'openingTime','08:00','closingTime','16:00',
  'pickupIntervalMinutes',15,'maxPickupMinutes',480,
  'receiptFooterText','Thank you and God bless.',
  'welcomeMessage','🎉 Welcome to CGCC Cafeteria Express',
  'maintenanceMessage','','announcement',''
));

-- ============ bank_accounts ============
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_accounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active bank accounts readable" ON public.bank_accounts FOR SELECT TO anon USING (enabled = true AND archived_at IS NULL);
CREATE POLICY "authenticated reads bank accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin inserts bank accounts" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates bank accounts" ON public.bank_accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin deletes bank accounts" ON public.bank_accounts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER bank_accounts_touch BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.bank_accounts (bank_name, account_name, account_number, enabled, is_default)
VALUES ('OPay','Olunike Olajumoke Adewumi','6104885281', true, true);

-- ============ finance security ============
CREATE TABLE public.finance_security (
  id text PRIMARY KEY,
  pin_hash text,
  recovery_email text,
  otp_enabled boolean NOT NULL DEFAULT false,
  timeout_minutes integer NOT NULL DEFAULT 15,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  configured_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.finance_security TO service_role;
ALTER TABLE public.finance_security ENABLE ROW LEVEL SECURITY;
INSERT INTO public.finance_security (id) VALUES ('global');

CREATE TABLE public.finance_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_label text,
  event text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_login_events TO authenticated;
GRANT ALL ON public.finance_login_events TO service_role;
ALTER TABLE public.finance_login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads finance events" ON public.finance_login_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.finance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  otp_verified boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.finance_sessions TO authenticated;
GRANT ALL ON public.finance_sessions TO service_role;
ALTER TABLE public.finance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads finance sessions" ON public.finance_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.finance_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.finance_sessions(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.finance_otps TO service_role;
ALTER TABLE public.finance_otps ENABLE ROW LEVEL SECURITY;

-- ============ finance RPCs ============
CREATE OR REPLACE FUNCTION public.finance_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.finance_security%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.finance_security WHERE id='global';
  RETURN jsonb_build_object(
    'configured', r.pin_hash IS NOT NULL,
    'otp_enabled', r.otp_enabled,
    'recovery_email', r.recovery_email,
    'timeout_minutes', r.timeout_minutes,
    'failed_attempts', r.failed_attempts,
    'locked_until', r.locked_until
  );
END $$;

CREATE OR REPLACE FUNCTION public.finance_setup(_pin text, _email text, _otp_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.finance_security%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.finance_security WHERE id='global';
  IF r.pin_hash IS NOT NULL THEN RAISE EXCEPTION 'finance security already configured'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{6,12}$' THEN RAISE EXCEPTION 'PIN must be 6-12 digits'; END IF;
  IF _email IS NULL OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'valid recovery email required'; END IF;
  UPDATE public.finance_security SET
    pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf')),
    recovery_email = lower(btrim(_email)),
    otp_enabled = COALESCE(_otp_enabled,false),
    configured_at = now(), updated_at = now(), failed_attempts = 0, locked_until = NULL
  WHERE id='global';
  PERFORM public.log_audit('finance.setup','finance','global','{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.finance_unlock(_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.finance_security%ROWTYPE; lbl text; sid uuid; code text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT email INTO lbl FROM auth.users WHERE id = auth.uid();
  SELECT * INTO r FROM public.finance_security WHERE id='global' FOR UPDATE;
  IF r.pin_hash IS NULL THEN RAISE EXCEPTION 'finance security not configured'; END IF;
  IF r.locked_until IS NOT NULL AND r.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'locked_until', r.locked_until);
  END IF;
  IF r.pin_hash <> extensions.crypt(COALESCE(_pin,''), r.pin_hash) THEN
    UPDATE public.finance_security SET
      failed_attempts = r.failed_attempts + 1,
      locked_until = CASE WHEN r.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
      updated_at = now()
    WHERE id='global';
    INSERT INTO public.finance_login_events (user_id,user_label,event,success,detail)
    VALUES (auth.uid(), lbl, 'pin', false, 'incorrect PIN');
    IF r.failed_attempts + 1 >= 5 THEN
      PERFORM public.log_audit('finance.locked','finance','global', jsonb_build_object('attempts', r.failed_attempts + 1));
      RETURN jsonb_build_object('ok', false, 'locked_until', now() + interval '15 minutes');
    END IF;
    RETURN jsonb_build_object('ok', false, 'attempts_left', 5 - (r.failed_attempts + 1));
  END IF;

  UPDATE public.finance_security SET failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE id='global';
  INSERT INTO public.finance_sessions (user_id, user_label, expires_at, otp_verified)
  VALUES (auth.uid(), lbl, now() + make_interval(mins => r.timeout_minutes), NOT r.otp_enabled)
  RETURNING id INTO sid;
  INSERT INTO public.finance_login_events (user_id,user_label,event,success,detail)
  VALUES (auth.uid(), lbl, 'pin', true, NULL);

  IF r.otp_enabled THEN
    code := lpad((floor(random()*1000000))::int::text, 6, '0');
    INSERT INTO public.finance_otps (session_id, code_hash, expires_at)
    VALUES (sid, extensions.crypt(code, extensions.gen_salt('bf')), now() + interval '10 minutes');
    RETURN jsonb_build_object('ok', true, 'session_id', sid, 'needs_otp', true,
                              'recovery_email', r.recovery_email, 'otp_code', code);
  END IF;
  RETURN jsonb_build_object('ok', true, 'session_id', sid, 'needs_otp', false);
END $$;

CREATE OR REPLACE FUNCTION public.finance_verify_otp(_session_id uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.finance_otps%ROWTYPE; lbl text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT email INTO lbl FROM auth.users WHERE id = auth.uid();
  SELECT * INTO o FROM public.finance_otps
   WHERE session_id = _session_id AND consumed_at IS NULL AND expires_at > now()
   ORDER BY created_at DESC LIMIT 1;
  IF o.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason','expired'); END IF;
  IF o.code_hash <> extensions.crypt(COALESCE(_code,''), o.code_hash) THEN
    INSERT INTO public.finance_login_events (user_id,user_label,event,success,detail)
    VALUES (auth.uid(), lbl, 'otp', false, 'incorrect code');
    RETURN jsonb_build_object('ok', false, 'reason','incorrect');
  END IF;
  UPDATE public.finance_otps SET consumed_at = now() WHERE id = o.id;
  UPDATE public.finance_sessions SET otp_verified = true WHERE id = _session_id;
  INSERT INTO public.finance_login_events (user_id,user_label,event,success)
  VALUES (auth.uid(), lbl, 'otp', true);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.finance_session_valid(_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.finance_sessions%ROWTYPE; mins integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN false; END IF;
  SELECT timeout_minutes INTO mins FROM public.finance_security WHERE id='global';
  SELECT * INTO s FROM public.finance_sessions WHERE id = _session_id AND user_id = auth.uid();
  IF s.id IS NULL OR s.revoked_at IS NOT NULL OR s.expires_at < now() OR NOT s.otp_verified THEN RETURN false; END IF;
  UPDATE public.finance_sessions
     SET last_seen_at = now(), expires_at = now() + make_interval(mins => COALESCE(mins,15))
   WHERE id = _session_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.finance_change_pin(_current text, _new text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.finance_security%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.finance_security WHERE id='global' FOR UPDATE;
  IF r.pin_hash IS NULL OR r.pin_hash <> extensions.crypt(COALESCE(_current,''), r.pin_hash) THEN
    RAISE EXCEPTION 'current PIN is incorrect';
  END IF;
  IF _new IS NULL OR _new !~ '^[0-9]{6,12}$' THEN RAISE EXCEPTION 'new PIN must be 6-12 digits'; END IF;
  UPDATE public.finance_security SET pin_hash = extensions.crypt(_new, extensions.gen_salt('bf')), updated_at = now() WHERE id='global';
  PERFORM public.log_audit('finance.pin_change','finance','global','{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.finance_update_settings(_recovery_email text, _otp_enabled boolean, _timeout_minutes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _recovery_email IS NOT NULL AND _recovery_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'valid recovery email required';
  END IF;
  UPDATE public.finance_security SET
    recovery_email = COALESCE(lower(btrim(_recovery_email)), recovery_email),
    otp_enabled = COALESCE(_otp_enabled, otp_enabled),
    timeout_minutes = GREATEST(LEAST(COALESCE(_timeout_minutes, timeout_minutes), 240), 1),
    updated_at = now()
  WHERE id='global';
  PERFORM public.log_audit('finance.settings_update','finance','global',
    jsonb_build_object('otp_enabled',_otp_enabled,'timeout_minutes',_timeout_minutes));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.finance_logout_all()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.finance_sessions SET revoked_at = now() WHERE revoked_at IS NULL AND expires_at > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.log_audit('finance.logout_all','finance','global', jsonb_build_object('sessions', n));
  RETURN jsonb_build_object('ok', true, 'revoked', n);
END $$;

REVOKE EXECUTE ON FUNCTION public.finance_status(), public.finance_setup(text,text,boolean),
  public.finance_unlock(text), public.finance_verify_otp(uuid,text), public.finance_session_valid(uuid),
  public.finance_change_pin(text,text), public.finance_update_settings(text,boolean,integer),
  public.finance_logout_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_status(), public.finance_setup(text,text,boolean),
  public.finance_unlock(text), public.finance_verify_otp(uuid,text), public.finance_session_valid(uuid),
  public.finance_change_pin(text,text), public.finance_update_settings(text,boolean,integer),
  public.finance_logout_all() TO authenticated;
