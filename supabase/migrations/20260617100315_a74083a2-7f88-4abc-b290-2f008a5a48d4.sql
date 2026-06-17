-- Profiles: add dob, anniversary
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS anniversary date;

-- Loyalty accounts
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins_balance integer NOT NULL DEFAULT 0,
  lifetime_coins integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_order_date date,
  total_orders integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own loyalty" ON public.loyalty_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage loyalty" ON public.loyalty_accounts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_loyalty_accounts_updated
  BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Loyalty transactions ledger
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  kind text NOT NULL, -- earn_order, redeem_coupon, referral_bonus, streak_bonus, birthday_bonus, anniversary_bonus, admin_adjust
  description text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own loyalty txns" ON public.loyalty_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_loyalty_txns_user ON public.loyalty_transactions(user_id, created_at DESC);

-- Referral codes (one per user)
CREATE TABLE IF NOT EXISTS public.user_referral_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  uses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_referral_codes TO authenticated;
GRANT ALL ON public.user_referral_codes TO service_role;
ALTER TABLE public.user_referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referral code" ON public.user_referral_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone with code can lookup" ON public.user_referral_codes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own code" ON public.user_referral_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Referrals (who referred whom)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, rewarded
  reward_coins integer NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);
GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view related referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own referral" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = referred_id);

-- Helper: ensure loyalty account exists
CREATE OR REPLACE FUNCTION public.ensure_loyalty_account(_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loyalty_accounts (user_id) VALUES (_user)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- Award coins on delivered order
CREATE OR REPLACE FUNCTION public.award_coins_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coins integer;
  acct record;
  streak_inc integer := 0;
  bonus integer := 0;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    PERFORM public.ensure_loyalty_account(NEW.customer_id);
    coins := GREATEST(floor(COALESCE(NEW.total, 0) / 10)::integer, 0);

    SELECT * INTO acct FROM public.loyalty_accounts WHERE user_id = NEW.customer_id FOR UPDATE;
    -- streak
    IF acct.last_order_date IS NULL THEN
      streak_inc := 1;
    ELSIF acct.last_order_date = CURRENT_DATE THEN
      streak_inc := 0;
    ELSIF acct.last_order_date = CURRENT_DATE - 1 THEN
      streak_inc := 1;
    ELSE
      -- reset streak
      UPDATE public.loyalty_accounts SET current_streak = 0 WHERE user_id = NEW.customer_id;
      streak_inc := 1;
    END IF;

    -- streak milestone bonuses
    IF (acct.current_streak + streak_inc) IN (7, 30, 100) THEN
      bonus := CASE (acct.current_streak + streak_inc) WHEN 7 THEN 50 WHEN 30 THEN 250 WHEN 100 THEN 1000 END;
    END IF;

    UPDATE public.loyalty_accounts SET
      coins_balance = coins_balance + coins + bonus,
      lifetime_coins = lifetime_coins + coins + bonus,
      current_streak = current_streak + streak_inc,
      longest_streak = GREATEST(longest_streak, current_streak + streak_inc),
      last_order_date = CURRENT_DATE,
      total_orders = total_orders + 1
    WHERE user_id = NEW.customer_id;

    IF coins > 0 THEN
      INSERT INTO public.loyalty_transactions (user_id, delta, kind, description, order_id)
      VALUES (NEW.customer_id, coins, 'earn_order', format('Earned %s coins from order', coins), NEW.id);
    END IF;
    IF bonus > 0 THEN
      INSERT INTO public.loyalty_transactions (user_id, delta, kind, description, order_id)
      VALUES (NEW.customer_id, bonus, 'streak_bonus', format('%s-day streak bonus', acct.current_streak + streak_inc), NEW.id);
    END IF;

    -- Referral reward on first delivered order
    UPDATE public.referrals r
       SET status = 'rewarded', reward_coins = 200, rewarded_at = now()
     WHERE r.referred_id = NEW.customer_id AND r.status = 'pending';

    IF FOUND THEN
      PERFORM public.ensure_loyalty_account(r.referrer_id) FROM public.referrals r WHERE r.referred_id = NEW.customer_id;
      UPDATE public.loyalty_accounts la SET
        coins_balance = la.coins_balance + 200,
        lifetime_coins = la.lifetime_coins + 200
        FROM public.referrals r
       WHERE r.referred_id = NEW.customer_id AND la.user_id = r.referrer_id;
      INSERT INTO public.loyalty_transactions (user_id, delta, kind, description)
        SELECT r.referrer_id, 200, 'referral_bonus', 'Friend completed first order'
          FROM public.referrals r WHERE r.referred_id = NEW.customer_id;
      -- referred user also gets 100
      UPDATE public.loyalty_accounts SET
        coins_balance = coins_balance + 100,
        lifetime_coins = lifetime_coins + 100
      WHERE user_id = NEW.customer_id;
      INSERT INTO public.loyalty_transactions (user_id, delta, kind, description)
      VALUES (NEW.customer_id, 100, 'referral_bonus', 'Welcome referral bonus');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_award_coins ON public.orders;
CREATE TRIGGER trg_award_coins
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.award_coins_on_delivery();

-- Redeem coins -> creates a personal coupon for the user
CREATE OR REPLACE FUNCTION public.redeem_coins_for_coupon(_user uuid, _coins integer)
RETURNS TABLE(success boolean, code text, discount integer, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal integer;
  new_code text;
  discount_amt integer;
BEGIN
  IF _coins < 100 THEN
    RETURN QUERY SELECT false, NULL::text, 0, 'Minimum 100 coins to redeem'; RETURN;
  END IF;
  SELECT coins_balance INTO bal FROM public.loyalty_accounts WHERE user_id = _user FOR UPDATE;
  IF bal IS NULL OR bal < _coins THEN
    RETURN QUERY SELECT false, NULL::text, 0, 'Insufficient coins'; RETURN;
  END IF;
  -- 1 coin = ₹1
  discount_amt := _coins;
  new_code := 'COINS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  INSERT INTO public.coupons (code, scope, discount_type, discount_flat, min_order, usage_limit_total, usage_limit_per_user, active, applies_to)
  VALUES (new_code, 'platform', 'flat', discount_amt, discount_amt + 50, 1, 1, true, 'order');
  UPDATE public.loyalty_accounts SET coins_balance = coins_balance - _coins WHERE user_id = _user;
  INSERT INTO public.loyalty_transactions (user_id, delta, kind, description)
  VALUES (_user, -_coins, 'redeem_coupon', format('Redeemed %s coins for %s coupon', _coins, new_code));
  RETURN QUERY SELECT true, new_code, discount_amt, 'OK'::text;
END $$;

-- Apply referral code (called by referred user)
CREATE OR REPLACE FUNCTION public.apply_referral_code(_user uuid, _code text)
RETURNS TABLE(success boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = _user) THEN
    RETURN QUERY SELECT false, 'Referral already applied'; RETURN;
  END IF;
  SELECT * INTO ref FROM public.user_referral_codes WHERE upper(code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid referral code'; RETURN;
  END IF;
  IF ref.user_id = _user THEN
    RETURN QUERY SELECT false, 'Cannot use your own code'; RETURN;
  END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, code) VALUES (ref.user_id, _user, ref.code);
  UPDATE public.user_referral_codes SET uses_count = uses_count + 1 WHERE user_id = ref.user_id;
  RETURN QUERY SELECT true, 'OK'::text;
END $$;