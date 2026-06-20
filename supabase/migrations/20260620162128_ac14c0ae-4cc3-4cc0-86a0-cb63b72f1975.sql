
-- =========================================================
-- REFERRAL CAMPAIGNS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.referral_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  referrer_reward_type text NOT NULL DEFAULT 'coins' CHECK (referrer_reward_type IN ('cash','coupon','coins','free_delivery','sub_discount')),
  referrer_reward_value numeric NOT NULL DEFAULT 200,
  referred_reward_type text NOT NULL DEFAULT 'coins' CHECK (referred_reward_type IN ('cash','coupon','coins','free_delivery','sub_discount')),
  referred_reward_value numeric NOT NULL DEFAULT 100,
  min_order_amount numeric NOT NULL DEFAULT 0,
  max_uses_per_referrer integer NOT NULL DEFAULT 50,
  reward_trigger text NOT NULL DEFAULT 'first_order' CHECK (reward_trigger IN ('first_order','payment','subscription')),
  expiry_days integer NOT NULL DEFAULT 30,
  fraud_device_check boolean NOT NULL DEFAULT true,
  fraud_duplicate_account boolean NOT NULL DEFAULT true,
  fraud_multi_referral boolean NOT NULL DEFAULT true,
  fraud_ip_validation boolean NOT NULL DEFAULT true,
  fraud_self_block boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_campaigns TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.referral_campaigns TO authenticated;
GRANT ALL ON public.referral_campaigns TO service_role;
ALTER TABLE public.referral_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns readable" ON public.referral_campaigns FOR SELECT USING (true);
CREATE POLICY "campaigns admin write" ON public.referral_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ref_campaigns_updated BEFORE UPDATE ON public.referral_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- MYSTERY WHEELS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.mystery_wheels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','seller','campaign')),
  seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  spins_per_day integer NOT NULL DEFAULT 1,
  spins_per_week integer NOT NULL DEFAULT 7,
  spins_per_month integer NOT NULL DEFAULT 30,
  require_login boolean NOT NULL DEFAULT true,
  require_order boolean NOT NULL DEFAULT false,
  require_subscription boolean NOT NULL DEFAULT false,
  require_referral boolean NOT NULL DEFAULT false,
  min_purchase_amount numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mystery_wheels TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.mystery_wheels TO authenticated;
GRANT ALL ON public.mystery_wheels TO service_role;
ALTER TABLE public.mystery_wheels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wheels readable" ON public.mystery_wheels FOR SELECT USING (true);
CREATE POLICY "wheels admin write" ON public.mystery_wheels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_wheels_updated BEFORE UPDATE ON public.mystery_wheels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- WHEEL SEGMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.mystery_wheel_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wheel_id uuid NOT NULL REFERENCES public.mystery_wheels(id) ON DELETE CASCADE,
  label text NOT NULL,
  reward_type text NOT NULL CHECK (reward_type IN ('cash_off','percent_off','free_delivery','coins','sub_discount','free_food','jackpot_coupon','better_luck')),
  reward_value numeric NOT NULL DEFAULT 0,
  coupon_min_order numeric NOT NULL DEFAULT 0,
  coupon_max_discount numeric,
  coupon_expires_days integer NOT NULL DEFAULT 14,
  coupon_stackable boolean NOT NULL DEFAULT false,
  applies_to text NOT NULL DEFAULT 'order' CHECK (applies_to IN ('order','subscription','any')),
  probability_weight numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#f59e0b',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mystery_wheel_segments TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.mystery_wheel_segments TO authenticated;
GRANT ALL ON public.mystery_wheel_segments TO service_role;
ALTER TABLE public.mystery_wheel_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "segments readable" ON public.mystery_wheel_segments FOR SELECT USING (true);
CREATE POLICY "segments admin write" ON public.mystery_wheel_segments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- AUDIT LOG
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rewards_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rewards_audit_log TO authenticated;
GRANT ALL ON public.rewards_audit_log TO service_role;
ALTER TABLE public.rewards_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.rewards_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit admin insert" ON public.rewards_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- REFERRAL FRAUD EVENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.referral_fraud_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL,
  ip text,
  device_fingerprint text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_fraud_events TO authenticated;
GRANT ALL ON public.referral_fraud_events TO service_role;
ALTER TABLE public.referral_fraud_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraud admin read" ON public.referral_fraud_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "fraud system insert" ON public.referral_fraud_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- =========================================================
-- EXTEND EXISTING TABLES
-- =========================================================
ALTER TABLE public.user_referral_codes
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS signup_ip text;
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.referral_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS signup_ip text;
ALTER TABLE public.spin_wheel_spins
  ADD COLUMN IF NOT EXISTS wheel_id uuid REFERENCES public.mystery_wheels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS segment_id uuid REFERENCES public.mystery_wheel_segments(id) ON DELETE SET NULL;

-- =========================================================
-- DB FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_rewards_audit(
  _admin uuid, _action text, _entity_type text, _entity_id uuid,
  _previous jsonb, _new jsonb
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.rewards_audit_log(admin_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (_admin, _action, _entity_type, _entity_id, _previous, _new);
$$;

CREATE OR REPLACE FUNCTION public.validate_wheel_probabilities(_wheel uuid)
RETURNS TABLE(valid boolean, total numeric, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s numeric;
BEGIN
  SELECT COALESCE(SUM(probability_weight),0) INTO s
    FROM public.mystery_wheel_segments WHERE wheel_id = _wheel AND active = true;
  IF s > 99.5 AND s < 100.5 THEN
    RETURN QUERY SELECT true, s, 'OK'::text;
  ELSE
    RETURN QUERY SELECT false, s, format('Active segment probabilities sum to %s, must equal 100', s);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.spin_wheel_v2(_user uuid, _wheel uuid DEFAULT NULL)
RETURNS TABLE(prize_kind text, prize_value numeric, coupon_code text, segment_label text, wheel_id uuid, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w record; seg record; cum numeric := 0; pick numeric;
  today_spins int; week_spins int; month_spins int;
  code text := null; rule record;
BEGIN
  -- resolve wheel: provided OR default active global wheel
  IF _wheel IS NULL THEN
    SELECT * INTO w FROM public.mystery_wheels
      WHERE active = true AND scope = 'global'
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at > now())
      ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT * INTO w FROM public.mystery_wheels WHERE id = _wheel AND active = true;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'unavailable'::text, 0::numeric, NULL::text, NULL::text, NULL::uuid, 'No active wheel'; RETURN;
  END IF;

  -- eligibility limits
  SELECT COUNT(*) INTO today_spins FROM public.spin_wheel_spins
    WHERE user_id = _user AND wheel_id = w.id AND created_at > now() - interval '1 day';
  IF today_spins >= w.spins_per_day THEN
    RETURN QUERY SELECT 'cooldown'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Daily limit reached'; RETURN;
  END IF;
  SELECT COUNT(*) INTO week_spins FROM public.spin_wheel_spins
    WHERE user_id = _user AND wheel_id = w.id AND created_at > now() - interval '7 days';
  IF week_spins >= w.spins_per_week THEN
    RETURN QUERY SELECT 'cooldown'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Weekly limit reached'; RETURN;
  END IF;
  SELECT COUNT(*) INTO month_spins FROM public.spin_wheel_spins
    WHERE user_id = _user AND wheel_id = w.id AND created_at > now() - interval '30 days';
  IF month_spins >= w.spins_per_month THEN
    RETURN QUERY SELECT 'cooldown'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Monthly limit reached'; RETURN;
  END IF;

  -- order requirement
  IF w.require_order AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE customer_id = _user AND status IN ('delivered','paid','completed') AND total >= w.min_purchase_amount
  ) THEN
    RETURN QUERY SELECT 'ineligible'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Order required'; RETURN;
  END IF;
  IF w.require_subscription AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions WHERE user_id = _user AND status = 'active'
  ) THEN
    RETURN QUERY SELECT 'ineligible'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Subscription required'; RETURN;
  END IF;
  IF w.require_referral AND NOT EXISTS (
    SELECT 1 FROM public.referrals WHERE referrer_id = _user AND status = 'rewarded'
  ) THEN
    RETURN QUERY SELECT 'ineligible'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Referral required'; RETURN;
  END IF;

  -- validate probabilities
  IF NOT EXISTS (SELECT 1 FROM public.mystery_wheel_segments WHERE wheel_id = w.id AND active = true) THEN
    RETURN QUERY SELECT 'unavailable'::text, 0::numeric, NULL::text, NULL::text, w.id, 'No segments configured'; RETURN;
  END IF;

  -- weighted pick
  pick := random() * (SELECT SUM(probability_weight) FROM public.mystery_wheel_segments WHERE wheel_id = w.id AND active = true);
  FOR seg IN SELECT * FROM public.mystery_wheel_segments WHERE wheel_id = w.id AND active = true ORDER BY sort_order, id LOOP
    cum := cum + seg.probability_weight;
    IF pick <= cum THEN EXIT; END IF;
  END LOOP;

  -- materialize reward
  IF seg.reward_type = 'coins' THEN
    PERFORM public.ensure_loyalty_account(_user);
    UPDATE public.loyalty_accounts SET coins_balance = coins_balance + seg.reward_value::int, lifetime_coins = lifetime_coins + seg.reward_value::int WHERE user_id = _user;
    INSERT INTO public.loyalty_transactions(user_id, delta, kind, description)
      VALUES (_user, seg.reward_value::int, 'spin_win', format('Won %s coins from %s', seg.reward_value, w.name));
  ELSIF seg.reward_type = 'cash_off' THEN
    code := 'SPIN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    INSERT INTO public.coupons(code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code,'platform','flat',seg.reward_value,COALESCE(NULLIF(seg.coupon_min_order,0), seg.reward_value+50),1,1,true,seg.applies_to,now() + (seg.coupon_expires_days||' days')::interval);
  ELSIF seg.reward_type = 'percent_off' THEN
    code := 'SPIN%-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    INSERT INTO public.coupons(code, scope, discount_type, discount_percent, max_discount, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code,'platform','percent',seg.reward_value,seg.coupon_max_discount,seg.coupon_min_order,1,1,true,seg.applies_to,now() + (seg.coupon_expires_days||' days')::interval);
  ELSIF seg.reward_type = 'free_delivery' THEN
    code := 'FREEDEL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    INSERT INTO public.coupons(code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code,'platform','free_delivery',0,seg.coupon_min_order,1,1,true,seg.applies_to,now() + (seg.coupon_expires_days||' days')::interval);
  ELSIF seg.reward_type = 'sub_discount' THEN
    code := 'SUBSPIN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    INSERT INTO public.coupons(code, scope, discount_type, discount_percent, max_discount, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code,'platform','percent',seg.reward_value,seg.coupon_max_discount,seg.coupon_min_order,1,1,true,'subscription',now() + (seg.coupon_expires_days||' days')::interval);
  ELSIF seg.reward_type IN ('free_food','jackpot_coupon') THEN
    code := upper(substr(seg.reward_type,1,6)) || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    INSERT INTO public.coupons(code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code,'platform','flat',seg.reward_value,seg.coupon_min_order,1,1,true,seg.applies_to,now() + (seg.coupon_expires_days||' days')::interval);
  END IF;

  INSERT INTO public.spin_wheel_spins(user_id, prize_kind, prize_value, coupon_code, wheel_id, segment_id)
    VALUES (_user, seg.reward_type, seg.reward_value::int, code, w.id, seg.id);

  RETURN QUERY SELECT seg.reward_type, seg.reward_value, code, seg.label, w.id, 'OK'::text;
END $$;

CREATE OR REPLACE FUNCTION public.apply_referral_code_v2(
  _user uuid, _code text, _ip text DEFAULT NULL, _device text DEFAULT NULL
) RETURNS TABLE(success boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref record; camp record; uses int;
BEGIN
  SELECT * INTO camp FROM public.referral_campaigns
    WHERE active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No active referral campaign'; RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = _user) THEN
    RETURN QUERY SELECT false, 'Referral already applied'; RETURN;
  END IF;

  SELECT * INTO ref FROM public.user_referral_codes WHERE upper(code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid referral code'; RETURN;
  END IF;

  IF camp.fraud_self_block AND ref.user_id = _user THEN
    INSERT INTO public.referral_fraud_events(user_id, kind, ip, device_fingerprint, details)
      VALUES (_user,'self_referral',_ip,_device,jsonb_build_object('code',_code));
    RETURN QUERY SELECT false, 'Cannot use your own code'; RETURN;
  END IF;

  IF camp.fraud_device_check AND _device IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_referral_codes WHERE user_id = ref.user_id AND device_fingerprint = _device
  ) THEN
    INSERT INTO public.referral_fraud_events(user_id, kind, ip, device_fingerprint, details)
      VALUES (_user,'duplicate_device',_ip,_device,jsonb_build_object('referrer',ref.user_id));
    RETURN QUERY SELECT false, 'Device check failed'; RETURN;
  END IF;

  IF camp.fraud_ip_validation AND _ip IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_referral_codes WHERE user_id = ref.user_id AND signup_ip = _ip
  ) THEN
    INSERT INTO public.referral_fraud_events(user_id, kind, ip, device_fingerprint, details)
      VALUES (_user,'duplicate_ip',_ip,_device,jsonb_build_object('referrer',ref.user_id));
    RETURN QUERY SELECT false, 'IP check failed'; RETURN;
  END IF;

  IF camp.fraud_multi_referral THEN
    SELECT COUNT(*) INTO uses FROM public.referrals WHERE referrer_id = ref.user_id;
    IF uses >= camp.max_uses_per_referrer THEN
      RETURN QUERY SELECT false, 'Referrer max uses reached'; RETURN;
    END IF;
  END IF;

  INSERT INTO public.referrals(referrer_id, referred_id, code, campaign_id, device_fingerprint, signup_ip)
    VALUES (ref.user_id, _user, ref.code, camp.id, _device, _ip);
  UPDATE public.user_referral_codes
    SET uses_count = uses_count + 1,
        device_fingerprint = COALESCE(device_fingerprint,_device),
        signup_ip = COALESCE(signup_ip,_ip)
    WHERE user_id = ref.user_id;
  RETURN QUERY SELECT true, 'OK'::text;
END $$;

-- =========================================================
-- SEED DEFAULTS so the system works out of the box
-- =========================================================
INSERT INTO public.referral_campaigns(name, description, referrer_reward_type, referrer_reward_value, referred_reward_type, referred_reward_value, min_order_amount, max_uses_per_referrer, reward_trigger)
SELECT 'Default Referral', 'Default campaign — 200 coins for referrer, 100 for new user on first delivered order', 'coins', 200, 'coins', 100, 0, 50, 'first_order'
WHERE NOT EXISTS (SELECT 1 FROM public.referral_campaigns);

INSERT INTO public.mystery_wheels(name, description, scope, active, spins_per_day, spins_per_week, spins_per_month)
SELECT 'Default Wheel','Default daily wheel','global', true, 1, 7, 30
WHERE NOT EXISTS (SELECT 1 FROM public.mystery_wheels WHERE scope='global');

DO $$
DECLARE wid uuid;
BEGIN
  SELECT id INTO wid FROM public.mystery_wheels WHERE scope='global' ORDER BY created_at LIMIT 1;
  IF wid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.mystery_wheel_segments WHERE wheel_id = wid) THEN
    INSERT INTO public.mystery_wheel_segments(wheel_id, label, reward_type, reward_value, coupon_min_order, probability_weight, sort_order, color) VALUES
      (wid, '50 coins',   'coins',         50,   0,  35, 1, '#fb923c'),
      (wid, '100 coins',  'coins',         100,  0,  25, 2, '#f59e0b'),
      (wid, '₹50 off',    'cash_off',      50,   100,15, 3, '#10b981'),
      (wid, '₹100 off',   'cash_off',      100,  200,10, 4, '#06b6d4'),
      (wid, 'Free delivery','free_delivery',0,   0,   8, 5, '#8b5cf6'),
      (wid, '₹500 jackpot','jackpot_coupon',500, 800, 2, 6, '#ec4899'),
      (wid, 'Try again',  'better_luck',    0,   0,   5, 7, '#94a3b8');
  END IF;
END $$;
