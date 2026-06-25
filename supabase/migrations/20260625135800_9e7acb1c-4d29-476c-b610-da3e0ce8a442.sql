
-- 1. campaign_redemptions: drop direct INSERT policy
DROP POLICY IF EXISTS "Users insert own campaign redemptions" ON public.campaign_redemptions;

-- 2. coupon_redemptions: drop direct INSERT policy
DROP POLICY IF EXISTS "redemptions_owner_insert" ON public.coupon_redemptions;

-- 3. referrals: drop direct INSERT policy
DROP POLICY IF EXISTS "Users insert own referral" ON public.referrals;

-- 4. delivery_assignments: revoke SELECT on otp column from authenticated/anon
REVOKE SELECT (otp) ON public.delivery_assignments FROM authenticated;
REVOKE SELECT (otp) ON public.delivery_assignments FROM anon;

-- 5. delivery_agents: revoke SELECT on sensitive columns from authenticated/anon
REVOKE SELECT (aadhaar_number, license_number, id_doc_url, license_doc_url, vehicle_doc_url)
  ON public.delivery_agents FROM authenticated;
REVOKE SELECT (aadhaar_number, license_number, id_doc_url, license_doc_url, vehicle_doc_url)
  ON public.delivery_agents FROM anon;
-- (Existing get_agent_sensitive SECURITY DEFINER function exposes these to the
-- owner agent, the owning seller, and admins.)

-- 6. mystery_wheel_segments: restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "segments readable" ON public.mystery_wheel_segments;
CREATE POLICY "segments readable to authenticated"
  ON public.mystery_wheel_segments FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.mystery_wheel_segments FROM anon;

-- 7. subscription_deliveries: remove broad customer UPDATE, expose a focused
--    skip RPC for the only customer-allowed mutation.
DROP POLICY IF EXISTS "Customers update own deliveries" ON public.subscription_deliveries;

CREATE OR REPLACE FUNCTION public.skip_my_subscription_delivery(_delivery_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owns boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM public.subscription_deliveries d
      JOIN public.subscriptions s ON s.id = d.subscription_id
     WHERE d.id = _delivery_id
       AND s.customer_id = auth.uid()
       AND d.status = 'scheduled'
  ) INTO owns;
  IF NOT owns THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.subscription_deliveries
     SET status = 'skipped'
   WHERE id = _delivery_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.skip_my_subscription_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_my_subscription_delivery(uuid) TO authenticated;
