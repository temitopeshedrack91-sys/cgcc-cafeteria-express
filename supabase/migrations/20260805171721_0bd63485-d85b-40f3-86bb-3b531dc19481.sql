CREATE OR REPLACE FUNCTION public.save_system_settings(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'invalid settings payload'; END IF;

  INSERT INTO public.system_settings (id, data, updated_at)
  VALUES ('global', _data, now())
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();

  PERFORM public.log_audit('settings.update', 'system_settings', 'global', '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.save_system_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_system_settings(jsonb) TO authenticated;