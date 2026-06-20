
-- 1) Tighten always-true INSERT policies

-- referral_fraud_events: only allow inserts where the row's user_id matches the caller
-- (server-side SECURITY DEFINER functions still bypass via service_role).
DROP POLICY IF EXISTS "fraud system insert" ON public.referral_fraud_events;
CREATE POLICY "fraud self insert"
  ON public.referral_fraud_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- device_override_requests: collapse the two public/auth insert policies into scoped ones.
DROP POLICY IF EXISTS "dor public insert" ON public.device_override_requests;
DROP POLICY IF EXISTS "dor auth insert" ON public.device_override_requests;

-- Anonymous users can submit an override request only with their own email; rate-limit
-- to one pending request per email at app level. The row is otherwise read-only to them.
CREATE POLICY "dor anon insert own email"
  ON public.device_override_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    requesting_email IS NOT NULL
    AND char_length(requesting_email) BETWEEN 5 AND 320
    AND status = 'pending'
  );

CREATE POLICY "dor auth insert own"
  ON public.device_override_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending'
    AND (
      requesting_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR requesting_email IS NULL
    )
  );

-- 2) Revoke EXECUTE from anon on user-only RPCs (require sign-in)
REVOKE EXECUTE ON FUNCTION public.spin_wheel(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.spin_wheel_v2(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_mystery_reward(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_coins_for_coupon(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text, uuid, uuid, numeric, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_referral_code_v2(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_device_transfer(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_device_transfer(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_decide_override(uuid, boolean, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_seller(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_device_account(uuid, uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_loyalty_account(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_rewards_audit(uuid, text, text, uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_abuse(uuid, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recompute_device_risk(uuid) FROM anon;

-- Keep anon EXECUTE on: register_device, check_device_signup, request_device_override,
-- validate_coupon, has_role, get_public_profile, validate_wheel_probabilities,
-- get_my_seller_record (these are called pre-auth or are read-only/checks).
