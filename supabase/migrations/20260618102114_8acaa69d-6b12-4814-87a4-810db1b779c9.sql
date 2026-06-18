
-- 1. PROFILES: restrict broad read
DROP POLICY IF EXISTS "Profiles are viewable by everyone authed" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Safe public-ish lookup helper for cross-user displays (orders, reviews)
CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, avatar_url FROM public.profiles WHERE id = _user_id
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;

-- 2. SELLERS: drop sensitive columns from anon/authenticated SELECT
REVOKE SELECT (bank_details, email, phone) ON public.sellers FROM anon, authenticated;
-- Sellers can still read their own full row (RLS policy "Approved sellers public" allows self),
-- expose a server-side helper for the seller dashboard via the existing seller server functions.
-- Add a row-owner / admin SELECT policy on all columns (RLS + column grants combine):
-- Column grants are checked first, so even with RLS allowing the row, sensitive columns
-- won't return. Provide a SECURITY DEFINER fn for the seller to fetch own full record.
CREATE OR REPLACE FUNCTION public.get_my_seller_record()
RETURNS SETOF public.sellers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.sellers WHERE user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_record() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_seller_record() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_seller(_seller_id uuid)
RETURNS SETOF public.sellers
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.sellers WHERE id = _seller_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_seller(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_seller(uuid) TO authenticated;

-- 3. USER_REFERRAL_CODES: remove broad read
DROP POLICY IF EXISTS "Anyone with code can lookup" ON public.user_referral_codes;
-- apply_referral_code (SECURITY DEFINER) already handles code-based lookup.

-- 4. SECURITY DEFINER function lockdown: remove anon execute
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_mystery_reward(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_mystery_reward(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.ensure_loyalty_account(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_loyalty_account(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_abuse(uuid, text, text, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_abuse(uuid, text, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.redeem_coins_for_coupon(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_coins_for_coupon(uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text, uuid, uuid, numeric, uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid, uuid, numeric, uuid, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.spin_wheel(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.spin_wheel(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, uuid, uuid, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, uuid, numeric, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 5. OTP tables: deny-all (scheduled for removal)
CREATE POLICY "Deny all otp_codes" ON public.otp_codes
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all otp_send_log" ON public.otp_send_log
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
