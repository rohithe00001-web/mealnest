
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  online_payments_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings readable"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "platform_settings admin write"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_settings (id, online_payments_enabled)
  VALUES (true, false)
  ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_online_payments_enabled()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT online_payments_enabled FROM public.platform_settings WHERE id = true), false);
$$;

GRANT EXECUTE ON FUNCTION public.get_online_payments_enabled() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_online_payments_enabled(_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.platform_settings (id, online_payments_enabled, updated_at, updated_by)
    VALUES (true, _enabled, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET online_payments_enabled = EXCLUDED.online_payments_enabled,
        updated_at = now(),
        updated_by = auth.uid();
  RETURN _enabled;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_online_payments_enabled(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_online_payments_enabled(boolean) TO authenticated;
