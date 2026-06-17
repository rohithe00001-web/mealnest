
-- 1. Abuse reports table
CREATE TABLE public.abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_abuse_reports_user ON public.abuse_reports(user_id);
CREATE INDEX idx_abuse_reports_unreviewed ON public.abuse_reports(reviewed, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.abuse_reports TO authenticated;
GRANT ALL ON public.abuse_reports TO service_role;
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view abuse reports" ON public.abuse_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update abuse reports" ON public.abuse_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Claim attempts table (rate-limit + audit trail)
CREATE TABLE public.reward_claim_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_id uuid,
  success boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rca_user_action_time ON public.reward_claim_attempts(user_id, action, created_at DESC);
GRANT SELECT, INSERT ON public.reward_claim_attempts TO authenticated;
GRANT ALL ON public.reward_claim_attempts TO service_role;
ALTER TABLE public.reward_claim_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all claim attempts" ON public.reward_claim_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own claim attempts" ON public.reward_claim_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Helper: record abuse
CREATE OR REPLACE FUNCTION public.record_abuse(_user uuid, _kind text, _severity text, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.abuse_reports (user_id, kind, severity, details)
  VALUES (_user, _kind, _severity, COALESCE(_details, '{}'::jsonb));
END $$;

-- 4. Harden spin_wheel: 20h cooldown + rapid-attempt detection
CREATE OR REPLACE FUNCTION public.spin_wheel(_user uuid)
RETURNS TABLE(prize_kind text, prize_value integer, coupon_code text, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  last_spin timestamptz;
  recent_attempts int;
  existing record;
  r integer; kind text; val integer; code text := null;
BEGIN
  -- Burst detection: >5 attempts in last hour
  SELECT COUNT(*) INTO recent_attempts FROM public.reward_claim_attempts
    WHERE user_id = _user AND action = 'spin_wheel' AND created_at > now() - interval '1 hour';
  IF recent_attempts > 5 THEN
    PERFORM public.record_abuse(_user, 'spin_burst', 'medium',
      jsonb_build_object('attempts_last_hour', recent_attempts));
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'spin_wheel', false, 'rate_limited');
    RETURN QUERY SELECT 'rate_limited'::text, 0, NULL::text, 'Too many attempts, try later'; RETURN;
  END IF;

  -- 20h cooldown using last spin timestamp
  SELECT created_at INTO last_spin FROM public.spin_wheel_spins
    WHERE user_id = _user ORDER BY created_at DESC LIMIT 1;
  IF last_spin IS NOT NULL AND last_spin > now() - interval '20 hours' THEN
    SELECT * INTO existing FROM public.spin_wheel_spins
      WHERE user_id = _user ORDER BY created_at DESC LIMIT 1;
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'spin_wheel', false, 'cooldown');
    RETURN QUERY SELECT existing.prize_kind, existing.prize_value, existing.coupon_code,
      'Next spin available in 20 hours'; RETURN;
  END IF;

  r := floor(random() * 100)::int;
  IF r < 35 THEN kind := 'coins'; val := 50;
  ELSIF r < 60 THEN kind := 'coins'; val := 100;
  ELSIF r < 75 THEN kind := 'coupon'; val := 50;
  ELSIF r < 90 THEN kind := 'coupon'; val := 100;
  ELSIF r < 97 THEN kind := 'free_delivery'; val := 0;
  ELSE kind := 'better_luck'; val := 0;
  END IF;

  IF kind = 'coins' THEN
    PERFORM public.ensure_loyalty_account(_user);
    UPDATE public.loyalty_accounts SET coins_balance = coins_balance + val, lifetime_coins = lifetime_coins + val
      WHERE user_id = _user;
    INSERT INTO public.loyalty_transactions (user_id, delta, kind, description)
      VALUES (_user, val, 'spin_win', format('Won %s coins from spin', val));
  ELSIF kind = 'coupon' THEN
    code := 'SPIN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    INSERT INTO public.coupons (code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code, 'platform', 'flat', val, val + 50, 1, 1, true, 'order', now() + interval '7 days');
  ELSIF kind = 'free_delivery' THEN
    code := 'FREEDEL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    INSERT INTO public.coupons (code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code, 'platform', 'free_delivery', 0, 0, 1, 1, true, 'order', now() + interval '7 days');
  END IF;

  INSERT INTO public.spin_wheel_spins (user_id, prize_kind, prize_value, coupon_code)
    VALUES (_user, kind, val, code);
  INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
    VALUES (_user, 'spin_wheel', true, kind);

  RETURN QUERY SELECT kind, val, code, 'OK'::text;
END $$;

-- 5. Harden claim_mystery_reward (atomic guard via UPDATE-then-check)
CREATE OR REPLACE FUNCTION public.claim_mystery_reward(_user uuid, _id uuid)
RETURNS TABLE(success boolean, coupon_code text, prize_kind text, prize_value integer, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
  code text := null;
  locked_row record;
  recent_failures int;
BEGIN
  -- Burst detection
  SELECT COUNT(*) INTO recent_failures FROM public.reward_claim_attempts
    WHERE user_id = _user AND action = 'mystery_claim' AND success = false
      AND created_at > now() - interval '10 minutes';
  IF recent_failures > 5 THEN
    PERFORM public.record_abuse(_user, 'mystery_claim_burst', 'high',
      jsonb_build_object('failed_attempts_10m', recent_failures, 'target', _id));
    INSERT INTO public.reward_claim_attempts(user_id, action, target_id, success, reason)
      VALUES (_user, 'mystery_claim', _id, false, 'rate_limited');
    RETURN QUERY SELECT false, NULL::text, NULL::text, 0, 'Too many attempts'; RETURN;
  END IF;

  -- Atomic claim: only proceed if we successfully flip claimed false->true
  UPDATE public.mystery_rewards SET claimed = true, claimed_at = now()
    WHERE id = _id AND user_id = _user AND claimed = false
    RETURNING * INTO locked_row;

  IF NOT FOUND THEN
    -- Either doesn't exist, wrong user, or already claimed
    SELECT * INTO m FROM public.mystery_rewards WHERE id = _id;
    IF NOT FOUND THEN
      INSERT INTO public.reward_claim_attempts(user_id, action, target_id, success, reason)
        VALUES (_user, 'mystery_claim', _id, false, 'not_found');
      RETURN QUERY SELECT false, NULL::text, NULL::text, 0, 'Not found'; RETURN;
    END IF;
    IF m.user_id <> _user THEN
      PERFORM public.record_abuse(_user, 'mystery_claim_wrong_user', 'high',
        jsonb_build_object('target', _id, 'owner', m.user_id));
      INSERT INTO public.reward_claim_attempts(user_id, action, target_id, success, reason)
        VALUES (_user, 'mystery_claim', _id, false, 'forbidden');
      RETURN QUERY SELECT false, NULL::text, NULL::text, 0, 'Not found'; RETURN;
    END IF;
    -- Already claimed
    PERFORM public.record_abuse(_user, 'mystery_double_claim', 'medium',
      jsonb_build_object('target', _id));
    INSERT INTO public.reward_claim_attempts(user_id, action, target_id, success, reason)
      VALUES (_user, 'mystery_claim', _id, false, 'already_claimed');
    RETURN QUERY SELECT false, m.coupon_code, m.prize_kind, m.prize_value, 'Already claimed'; RETURN;
  END IF;

  m := locked_row;
  IF m.prize_kind = 'coins' THEN
    PERFORM public.ensure_loyalty_account(_user);
    UPDATE public.loyalty_accounts SET coins_balance = coins_balance + m.prize_value, lifetime_coins = lifetime_coins + m.prize_value
      WHERE user_id = _user;
    INSERT INTO public.loyalty_transactions (user_id, delta, kind, description)
      VALUES (_user, m.prize_value, 'mystery_reward', format('Mystery reward: %s coins', m.prize_value));
  ELSIF m.prize_kind = 'coupon' THEN
    code := 'MYSTERY-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    INSERT INTO public.coupons (code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code, 'platform', 'flat', m.prize_value, m.prize_value + 50, 1, 1, true, 'order', now() + interval '14 days');
  ELSIF m.prize_kind = 'free_delivery' THEN
    code := 'MYSTERYDEL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    INSERT INTO public.coupons (code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code, 'platform', 'free_delivery', 0, 0, 1, 1, true, 'order', now() + interval '14 days');
  ELSIF m.prize_kind = 'free_dessert' THEN
    code := 'DESSERT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    INSERT INTO public.coupons (code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to, expires_at)
      VALUES (code, 'platform', 'flat', 100, 200, 1, 1, true, 'order', now() + interval '14 days');
  END IF;

  UPDATE public.mystery_rewards SET coupon_code = code WHERE id = _id;
  INSERT INTO public.reward_claim_attempts(user_id, action, target_id, success, reason)
    VALUES (_user, 'mystery_claim', _id, true, m.prize_kind);
  RETURN QUERY SELECT true, code, m.prize_kind, m.prize_value, 'OK'::text;
END $$;

-- 6. Harden redeem_coins_for_coupon (rate-limit)
CREATE OR REPLACE FUNCTION public.redeem_coins_for_coupon(_user uuid, _coins integer)
RETURNS TABLE(success boolean, code text, discount integer, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bal integer;
  new_code text;
  discount_amt integer;
  recent_redeems int;
BEGIN
  SELECT COUNT(*) INTO recent_redeems FROM public.reward_claim_attempts
    WHERE user_id = _user AND action = 'redeem_coins' AND success = true
      AND created_at > now() - interval '1 hour';
  IF recent_redeems >= 3 THEN
    PERFORM public.record_abuse(_user, 'redeem_burst', 'medium',
      jsonb_build_object('redeems_last_hour', recent_redeems));
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'redeem_coins', false, 'rate_limited');
    RETURN QUERY SELECT false, NULL::text, 0, 'Too many redemptions this hour'; RETURN;
  END IF;

  IF _coins < 100 THEN
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'redeem_coins', false, 'below_min');
    RETURN QUERY SELECT false, NULL::text, 0, 'Minimum 100 coins to redeem'; RETURN;
  END IF;
  SELECT coins_balance INTO bal FROM public.loyalty_accounts WHERE user_id = _user FOR UPDATE;
  IF bal IS NULL OR bal < _coins THEN
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'redeem_coins', false, 'insufficient');
    RETURN QUERY SELECT false, NULL::text, 0, 'Insufficient coins'; RETURN;
  END IF;
  discount_amt := _coins;
  new_code := 'COINS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  INSERT INTO public.coupons (code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to)
  VALUES (new_code, 'platform', 'flat', discount_amt, discount_amt + 50, 1, 1, true, 'order');
  UPDATE public.loyalty_accounts SET coins_balance = coins_balance - _coins WHERE user_id = _user;
  INSERT INTO public.loyalty_transactions (user_id, delta, kind, description)
  VALUES (_user, -_coins, 'redeem_coupon', format('Redeemed %s coins for %s coupon', _coins, new_code));
  INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
    VALUES (_user, 'redeem_coins', true, new_code);
  RETURN QUERY SELECT true, new_code, discount_amt, 'OK'::text;
END $$;

-- 7. Harden apply_referral_code (self-referral and burst)
CREATE OR REPLACE FUNCTION public.apply_referral_code(_user uuid, _code text)
RETURNS TABLE(success boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref record;
  recent_attempts int;
BEGIN
  SELECT COUNT(*) INTO recent_attempts FROM public.reward_claim_attempts
    WHERE user_id = _user AND action = 'apply_referral' AND created_at > now() - interval '1 hour';
  IF recent_attempts > 5 THEN
    PERFORM public.record_abuse(_user, 'referral_burst', 'medium',
      jsonb_build_object('attempts_last_hour', recent_attempts));
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'apply_referral', false, 'rate_limited');
    RETURN QUERY SELECT false, 'Too many attempts, try later'; RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = _user) THEN
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'apply_referral', false, 'already_applied');
    RETURN QUERY SELECT false, 'Referral already applied'; RETURN;
  END IF;
  SELECT * INTO ref FROM public.user_referral_codes WHERE upper(code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'apply_referral', false, 'invalid_code');
    RETURN QUERY SELECT false, 'Invalid referral code'; RETURN;
  END IF;
  IF ref.user_id = _user THEN
    PERFORM public.record_abuse(_user, 'self_referral', 'high',
      jsonb_build_object('code', _code));
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'apply_referral', false, 'self_referral');
    RETURN QUERY SELECT false, 'Cannot use your own code'; RETURN;
  END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, code) VALUES (ref.user_id, _user, ref.code);
  UPDATE public.user_referral_codes SET uses_count = uses_count + 1 WHERE user_id = ref.user_id;
  INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
    VALUES (_user, 'apply_referral', true, 'ok');
  RETURN QUERY SELECT true, 'OK'::text;
END $$;
