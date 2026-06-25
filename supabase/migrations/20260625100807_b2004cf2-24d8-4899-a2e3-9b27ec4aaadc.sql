
-- 1) Lock down sellers column access
REVOKE ALL ON public.sellers FROM anon, authenticated;
GRANT SELECT (
  id, user_id, kitchen_name, description, cover_image_url,
  address_line, city, pincode, latitude, longitude, delivery_radius_km,
  business_hours, status, is_open, rating_avg, rating_count,
  created_at, updated_at, logo_url, banner_url, gallery, story,
  cuisines, specialties, slug, prep_time_min_avg
) ON public.sellers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;

-- 2) Lock down delivery_assignments OTP
REVOKE ALL ON public.delivery_assignments FROM anon, authenticated;
GRANT SELECT (
  id, seller_id, agent_id, order_id, subscription_delivery_id,
  customer_id, status, assigned_at, picked_up_at, delivered_at,
  failed_reason, customer_rating, customer_feedback,
  current_lat, current_lng, last_location_at, notes,
  created_at, updated_at
) ON public.delivery_assignments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_assignments TO authenticated;
GRANT ALL ON public.delivery_assignments TO service_role;

-- 2a) OTP helpers
CREATE OR REPLACE FUNCTION public.validate_assignment_otp(_assignment_id uuid, _otp text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE a record;
BEGIN
  SELECT da.otp, da.agent_id INTO a
  FROM public.delivery_assignments da
  WHERE da.id = _assignment_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_agents ag
    WHERE ag.id = a.agent_id AND ag.user_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;
  RETURN a.otp = _otp;
END $$;
REVOKE ALL ON FUNCTION public.validate_assignment_otp(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_assignment_otp(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_assignment_otp(_assignment_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT da.otp
  FROM public.delivery_assignments da
  WHERE da.id = _assignment_id
    AND da.customer_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_assignment_otp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_assignment_otp(uuid) TO authenticated;

-- 3) Orders update policy: remove customer self-update, allow assigned agent
DROP POLICY IF EXISTS "Sellers/admins update orders" ON public.orders;
CREATE POLICY "Sellers, admins, and assigned agent update orders"
ON public.orders FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = orders.seller_id AND s.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.delivery_assignments da
    JOIN public.delivery_agents ag ON ag.id = da.agent_id
    WHERE da.order_id = orders.id AND ag.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = orders.seller_id AND s.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.delivery_assignments da
    JOIN public.delivery_agents ag ON ag.id = da.agent_id
    WHERE da.order_id = orders.id AND ag.user_id = auth.uid()
  )
);

-- 4) Caller-binding guards on user-scoped SECURITY DEFINER reward RPCs
CREATE OR REPLACE FUNCTION public.spin_wheel_v2(_user uuid, _wheel uuid DEFAULT NULL::uuid)
 RETURNS TABLE(prize_kind text, prize_value numeric, coupon_code text, segment_label text, wheel_id uuid, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  w record; seg record; cum numeric := 0; pick numeric;
  today_spins int; week_spins int; month_spins int;
  code text := null;
BEGIN
  IF _user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _wheel IS NULL THEN
    SELECT * INTO w FROM public.mystery_wheels mw
      WHERE mw.active = true AND mw.scope = 'global'
        AND (mw.starts_at IS NULL OR mw.starts_at <= now())
        AND (mw.ends_at IS NULL OR mw.ends_at > now())
      ORDER BY mw.created_at DESC LIMIT 1;
  ELSE
    SELECT * INTO w FROM public.mystery_wheels mw WHERE mw.id = _wheel AND mw.active = true;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'unavailable'::text, 0::numeric, NULL::text, NULL::text, NULL::uuid, 'No active wheel'; RETURN;
  END IF;

  SELECT COUNT(*) INTO today_spins FROM public.spin_wheel_spins s
    WHERE s.user_id = _user AND s.wheel_id = w.id AND s.created_at > now() - interval '1 day';
  IF today_spins >= w.spins_per_day THEN
    RETURN QUERY SELECT 'cooldown'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Daily limit reached'; RETURN;
  END IF;
  SELECT COUNT(*) INTO week_spins FROM public.spin_wheel_spins s
    WHERE s.user_id = _user AND s.wheel_id = w.id AND s.created_at > now() - interval '7 days';
  IF week_spins >= w.spins_per_week THEN
    RETURN QUERY SELECT 'cooldown'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Weekly limit reached'; RETURN;
  END IF;
  SELECT COUNT(*) INTO month_spins FROM public.spin_wheel_spins s
    WHERE s.user_id = _user AND s.wheel_id = w.id AND s.created_at > now() - interval '30 days';
  IF month_spins >= w.spins_per_month THEN
    RETURN QUERY SELECT 'cooldown'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Monthly limit reached'; RETURN;
  END IF;

  IF w.require_order AND NOT EXISTS (
    SELECT 1 FROM public.orders o WHERE o.customer_id = _user AND o.status = 'delivered'::order_status AND o.total >= w.min_purchase_amount
  ) THEN
    RETURN QUERY SELECT 'ineligible'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Order required'; RETURN;
  END IF;
  IF w.require_subscription AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions sub WHERE sub.customer_id = _user AND sub.status = 'active'
  ) THEN
    RETURN QUERY SELECT 'ineligible'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Subscription required'; RETURN;
  END IF;
  IF w.require_referral AND NOT EXISTS (
    SELECT 1 FROM public.referrals r WHERE r.referrer_id = _user AND r.status = 'rewarded'
  ) THEN
    RETURN QUERY SELECT 'ineligible'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Referral required'; RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mystery_wheel_segments mws WHERE mws.wheel_id = w.id AND mws.active = true) THEN
    RETURN QUERY SELECT 'unavailable'::text, 0::numeric, NULL::text, NULL::text, w.id, 'No segments configured'; RETURN;
  END IF;

  pick := random() * (SELECT SUM(mws.probability_weight) FROM public.mystery_wheel_segments mws WHERE mws.wheel_id = w.id AND mws.active = true);
  FOR seg IN SELECT * FROM public.mystery_wheel_segments mws WHERE mws.wheel_id = w.id AND mws.active = true ORDER BY mws.sort_order, mws.id LOOP
    cum := cum + seg.probability_weight;
    IF pick <= cum THEN EXIT; END IF;
  END LOOP;

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
END $function$;

CREATE OR REPLACE FUNCTION public.spin_wheel(_user uuid)
 RETURNS TABLE(prize_kind text, prize_value integer, coupon_code text, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  last_spin timestamptz;
  recent_attempts int;
  existing record;
  r integer; kind text; val integer; code text := null;
BEGIN
  IF _user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO recent_attempts FROM public.reward_claim_attempts
    WHERE user_id = _user AND action = 'spin_wheel' AND created_at > now() - interval '1 hour';
  IF recent_attempts > 5 THEN
    PERFORM public.record_abuse(_user, 'spin_burst', 'medium',
      jsonb_build_object('attempts_last_hour', recent_attempts));
    INSERT INTO public.reward_claim_attempts(user_id, action, success, reason)
      VALUES (_user, 'spin_wheel', false, 'rate_limited');
    RETURN QUERY SELECT 'rate_limited'::text, 0, NULL::text, 'Too many attempts, try later'; RETURN;
  END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.claim_mystery_reward(_user uuid, _id uuid)
 RETURNS TABLE(success boolean, coupon_code text, prize_kind text, prize_value integer, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  code text := null;
  locked_row record;
  recent_failures int;
BEGIN
  IF _user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
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
  UPDATE public.mystery_rewards SET claimed = true, claimed_at = now()
    WHERE id = _id AND user_id = _user AND claimed = false
    RETURNING * INTO locked_row;
  IF NOT FOUND THEN
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
END $function$;

CREATE OR REPLACE FUNCTION public.redeem_coins_for_coupon(_user uuid, _coins integer)
 RETURNS TABLE(success boolean, code text, discount integer, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bal integer;
  new_code text;
  discount_amt integer;
  recent_redeems int;
BEGIN
  IF _user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.apply_referral_code(_user uuid, _code text)
 RETURNS TABLE(success boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref record;
  recent_attempts int;
BEGIN
  IF _user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.apply_referral_code_v2(_user uuid, _code text, _ip text DEFAULT NULL::text, _device text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref record; camp record; uses int;
BEGIN
  IF _user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
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
END $function$;
