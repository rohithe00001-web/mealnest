-- Achievements catalog
CREATE TABLE IF NOT EXISTS public.achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text,
  reward_coins integer NOT NULL DEFAULT 0,
  threshold integer NOT NULL DEFAULT 1,
  metric text NOT NULL DEFAULT 'orders',
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT USING (active);

INSERT INTO public.achievements (id, name, description, icon, reward_coins, threshold, metric) VALUES
  ('first_bite', 'First Bite', 'Place your very first order', 'utensils', 50, 1, 'orders'),
  ('regular', 'Regular', 'Place 10 orders', 'flame', 200, 10, 'orders'),
  ('foodie', 'Foodie', 'Place 25 orders', 'chef-hat', 500, 25, 'orders'),
  ('legend', 'MealNest Legend', 'Place 100 orders', 'crown', 2000, 100, 'orders'),
  ('streak_7', '7-Day Streak', 'Order 7 days in a row', 'flame', 100, 7, 'streak'),
  ('streak_30', '30-Day Streak', 'Order 30 days in a row', 'flame', 500, 30, 'streak'),
  ('referrer', 'Spread the Love', 'Refer 5 friends', 'gift', 500, 5, 'referrals')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own achievements" ON public.user_achievements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Spin wheel
CREATE TABLE IF NOT EXISTS public.spin_wheel_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spin_date date NOT NULL DEFAULT CURRENT_DATE,
  prize_kind text NOT NULL, -- coins | coupon | free_delivery | better_luck
  prize_value integer NOT NULL DEFAULT 0,
  coupon_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spin_date)
);
GRANT SELECT, INSERT ON public.spin_wheel_spins TO authenticated;
GRANT ALL ON public.spin_wheel_spins TO service_role;
ALTER TABLE public.spin_wheel_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own spins" ON public.spin_wheel_spins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Mystery rewards (every 10 delivered orders)
CREATE TABLE IF NOT EXISTS public.mystery_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone integer NOT NULL,
  prize_kind text NOT NULL, -- coins | coupon | free_delivery | free_dessert
  prize_value integer NOT NULL DEFAULT 0,
  coupon_code text,
  claimed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone)
);
GRANT SELECT, UPDATE ON public.mystery_rewards TO authenticated;
GRANT ALL ON public.mystery_rewards TO service_role;
ALTER TABLE public.mystery_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own mystery rewards" ON public.mystery_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own mystery rewards" ON public.mystery_rewards
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: every 10th delivered order, mint a mystery reward
CREATE OR REPLACE FUNCTION public.create_mystery_reward_on_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
  ms integer;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    SELECT total_orders INTO total FROM public.loyalty_accounts WHERE user_id = NEW.customer_id;
    IF total IS NOT NULL AND total > 0 AND total % 10 = 0 THEN
      ms := total;
      INSERT INTO public.mystery_rewards (user_id, milestone, prize_kind, prize_value)
      VALUES (NEW.customer_id, ms,
        (ARRAY['coins','coupon','free_delivery','free_dessert'])[1 + floor(random() * 4)::int],
        (ARRAY[100, 150, 200, 250])[1 + floor(random() * 4)::int])
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mystery_reward ON public.orders;
CREATE TRIGGER trg_mystery_reward
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_mystery_reward_on_milestone();

-- Spin function (one per day, server-side prize selection)
CREATE OR REPLACE FUNCTION public.spin_wheel(_user uuid)
RETURNS TABLE(prize_kind text, prize_value integer, coupon_code text, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing record;
  r integer;
  kind text;
  val integer;
  code text := null;
BEGIN
  SELECT * INTO existing FROM public.spin_wheel_spins WHERE user_id = _user AND spin_date = CURRENT_DATE;
  IF FOUND THEN
    RETURN QUERY SELECT existing.prize_kind, existing.prize_value, existing.coupon_code, 'Already spun today'; RETURN;
  END IF;

  r := floor(random() * 100)::int;
  IF r < 35 THEN kind := 'coins'; val := 50;
  ELSIF r < 60 THEN kind := 'coins'; val := 100;
  ELSIF r < 75 THEN kind := 'coupon'; val := 50;
  ELSIF r < 90 THEN kind := 'coupon'; val := 100;
  ELSIF r < 97 THEN kind := 'free_delivery'; val := 0;
  ELSE kind := 'better_luck'; val := 0;
  END IF;

  -- Award
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

  RETURN QUERY SELECT kind, val, code, 'OK'::text;
END $$;

-- Claim mystery reward
CREATE OR REPLACE FUNCTION public.claim_mystery_reward(_user uuid, _id uuid)
RETURNS TABLE(success boolean, coupon_code text, prize_kind text, prize_value integer, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  code text := null;
BEGIN
  SELECT * INTO m FROM public.mystery_rewards WHERE id = _id AND user_id = _user FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, NULL::text, NULL::text, 0, 'Not found'; RETURN; END IF;
  IF m.claimed THEN RETURN QUERY SELECT false, m.coupon_code, m.prize_kind, m.prize_value, 'Already claimed'; RETURN; END IF;

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

  UPDATE public.mystery_rewards SET claimed = true, claimed_at = now(), coupon_code = code WHERE id = _id;
  RETURN QUERY SELECT true, code, m.prize_kind, m.prize_value, 'OK'::text;
END $$;

-- Seller sponsorships
CREATE TABLE IF NOT EXISTS public.seller_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  kind text NOT NULL, -- new_boost | featured | top_rated
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_sponsorships TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seller_sponsorships TO authenticated;
GRANT ALL ON public.seller_sponsorships TO service_role;
ALTER TABLE public.seller_sponsorships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view active sponsorships" ON public.seller_sponsorships
  FOR SELECT USING (active AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "Admins manage sponsorships" ON public.seller_sponsorships
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_sponsorships_seller ON public.seller_sponsorships(seller_id, active);