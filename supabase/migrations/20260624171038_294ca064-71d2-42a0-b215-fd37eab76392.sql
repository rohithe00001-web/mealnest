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
    SELECT 1 FROM public.orders o WHERE o.customer_id = _user AND o.status IN ('delivered','paid','completed') AND o.total >= w.min_purchase_amount
  ) THEN
    RETURN QUERY SELECT 'ineligible'::text, 0::numeric, NULL::text, NULL::text, w.id, 'Order required'; RETURN;
  END IF;
  IF w.require_subscription AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions sub WHERE sub.user_id = _user AND sub.status = 'active'
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