
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  name text,
  user_agent text,
  platform text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_ip text,
  status text NOT NULL DEFAULT 'active',
  risk_score int NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  blacklisted boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.device_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'auto',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, user_id, role)
);

CREATE TABLE public.device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip text,
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.device_override_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  requesting_email text NOT NULL,
  reason text NOT NULL,
  contact text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.device_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  to_device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.device_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  details jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.device_fraud_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid,
  kind text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_accounts TO authenticated;
GRANT ALL ON public.device_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.device_sessions TO authenticated;
GRANT ALL ON public.device_sessions TO service_role;
GRANT SELECT, INSERT ON public.device_override_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.device_override_requests TO authenticated;
GRANT ALL ON public.device_override_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.device_transfer_requests TO authenticated;
GRANT ALL ON public.device_transfer_requests TO service_role;
GRANT SELECT, INSERT ON public.device_audit_log TO authenticated;
GRANT ALL ON public.device_audit_log TO service_role;
GRANT SELECT, INSERT ON public.device_fraud_events TO authenticated;
GRANT ALL ON public.device_fraud_events TO service_role;

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_override_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fraud_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices admin all" ON public.devices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "devices read own linked" ON public.devices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.device_accounts da WHERE da.device_id = devices.id AND da.user_id = auth.uid()));

CREATE POLICY "da admin all" ON public.device_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "da own select" ON public.device_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "da own delete" ON public.device_accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "ds admin all" ON public.device_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ds own" ON public.device_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ds own update" ON public.device_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "dor admin all" ON public.device_override_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "dor public insert" ON public.device_override_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "dor auth insert" ON public.device_override_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "dtr admin all" ON public.device_transfer_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "dtr own" ON public.device_transfer_requests FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "dal admin all" ON public.device_audit_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "dfe admin all" ON public.device_fraud_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.register_device(_fingerprint text, _ua text, _platform text, _ip text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d_id uuid;
BEGIN
  INSERT INTO public.devices (fingerprint, user_agent, platform, last_ip)
  VALUES (_fingerprint, _ua, _platform, _ip)
  ON CONFLICT (fingerprint) DO UPDATE
    SET last_seen_at = now(), last_ip = COALESCE(EXCLUDED.last_ip, public.devices.last_ip),
        user_agent = COALESCE(EXCLUDED.user_agent, public.devices.user_agent),
        platform = COALESCE(EXCLUDED.platform, public.devices.platform),
        updated_at = now()
  RETURNING id INTO d_id;
  RETURN d_id;
END $$;

CREATE OR REPLACE FUNCTION public.check_device_signup(_fingerprint text, _role text)
RETURNS TABLE(allowed boolean, reason text, device_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; existing int;
BEGIN
  SELECT * INTO d FROM public.devices WHERE fingerprint = _fingerprint;
  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 'OK'::text, NULL::uuid; RETURN;
  END IF;
  IF d.blacklisted THEN
    INSERT INTO public.device_fraud_events(device_id, kind, details)
      VALUES (d.id, 'signup_blocked', jsonb_build_object('reason','blacklisted','role',_role));
    RETURN QUERY SELECT false, 'This device is blocked. Contact support.'::text, d.id; RETURN;
  END IF;
  SELECT COUNT(*) INTO existing FROM public.device_accounts
    WHERE device_id = d.id AND approval_status IN ('auto','approved');
  IF existing > 0 THEN
    INSERT INTO public.device_fraud_events(device_id, kind, details)
      VALUES (d.id, CASE WHEN _role IN ('seller','delivery_agent') THEN 'role_blocked' ELSE 'signup_blocked' END,
        jsonb_build_object('existing_accounts', existing, 'role', _role));
    RETURN QUERY SELECT false,
      'An account is already registered on this device. Please log in using the existing account or contact support.'::text,
      d.id; RETURN;
  END IF;
  RETURN QUERY SELECT true, 'OK'::text, d.id;
END $$;

CREATE OR REPLACE FUNCTION public.link_device_account(_device uuid, _user uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing int;
BEGIN
  SELECT COUNT(*) INTO existing FROM public.device_accounts WHERE device_id = _device;
  INSERT INTO public.device_accounts (device_id, user_id, role, is_primary, approval_status)
    VALUES (_device, _user, _role, existing = 0, 'auto')
    ON CONFLICT (device_id, user_id, role) DO NOTHING;
  INSERT INTO public.device_audit_log(device_id, user_id, action, success, details)
    VALUES (_device, _user, 'link_account', true, jsonb_build_object('role', _role));
END $$;

CREATE OR REPLACE FUNCTION public.recompute_device_risk(_device uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fraud_n int; acct_n int; score int; lvl text;
BEGIN
  SELECT COUNT(*) INTO fraud_n FROM public.device_fraud_events WHERE device_id = _device;
  SELECT COUNT(DISTINCT user_id) INTO acct_n FROM public.device_accounts WHERE device_id = _device;
  score := LEAST(100, fraud_n*10 + GREATEST(0, acct_n-1)*15);
  lvl := CASE WHEN score >= 75 THEN 'critical' WHEN score >= 50 THEN 'high' WHEN score >= 25 THEN 'medium' ELSE 'low' END;
  UPDATE public.devices SET risk_score = score, risk_level = lvl, updated_at = now() WHERE id = _device;
END $$;

CREATE OR REPLACE FUNCTION public.request_device_override(_fingerprint text, _email text, _reason text, _contact text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d_id uuid; req_id uuid;
BEGIN
  SELECT id INTO d_id FROM public.devices WHERE fingerprint = _fingerprint;
  INSERT INTO public.device_override_requests(device_id, fingerprint, requesting_email, reason, contact)
    VALUES (d_id, _fingerprint, _email, _reason, _contact) RETURNING id INTO req_id;
  RETURN req_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_decide_override(_id uuid, _approve boolean, _admin uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.device_override_requests
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        decided_by = _admin, decided_at = now()
    WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.start_device_transfer(_user uuid, _to_device uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE otp text; otp_h text; from_d uuid;
BEGIN
  otp := lpad(floor(random()*1000000)::text, 6, '0');
  otp_h := encode(digest(otp, 'sha256'), 'hex');
  SELECT device_id INTO from_d FROM public.device_accounts WHERE user_id = _user AND is_primary = true LIMIT 1;
  INSERT INTO public.device_transfer_requests(user_id, from_device_id, to_device_id, otp_hash, expires_at)
    VALUES (_user, from_d, _to_device, otp_h, now() + interval '15 minutes');
  RETURN otp;
END $$;

CREATE OR REPLACE FUNCTION public.complete_device_transfer(_user uuid, _to_device uuid, _otp text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req record; otp_h text;
BEGIN
  otp_h := encode(digest(_otp, 'sha256'), 'hex');
  SELECT * INTO req FROM public.device_transfer_requests
    WHERE user_id = _user AND to_device_id = _to_device AND status = 'pending' AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND OR req.otp_hash <> otp_h THEN RETURN false; END IF;
  UPDATE public.device_transfer_requests SET status = 'completed' WHERE id = req.id;
  IF req.from_device_id IS NOT NULL THEN
    DELETE FROM public.device_accounts WHERE device_id = req.from_device_id AND user_id = _user;
  END IF;
  INSERT INTO public.device_accounts (device_id, user_id, role, is_primary)
    SELECT _to_device, _user, role, true FROM public.user_roles WHERE user_id = _user
    ON CONFLICT (device_id, user_id, role) DO UPDATE SET is_primary = true;
  INSERT INTO public.device_audit_log(device_id, user_id, action, success) VALUES (_to_device, _user, 'transfer_complete', true);
  RETURN true;
END $$;
