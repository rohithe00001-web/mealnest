
-- ============================================================
-- 1. SELLERS: column-level revoke for sensitive fields
-- ============================================================
REVOKE SELECT (bank_details, email, phone, food_license_url, id_proof_url)
  ON public.sellers FROM anon, authenticated;

-- ============================================================
-- 2. DELIVERY AGENTS: hide KYC + lock approval fields from self-update
-- ============================================================
REVOKE SELECT (aadhaar_number, license_number, license_doc_url, id_doc_url, vehicle_doc_url)
  ON public.delivery_agents FROM anon, authenticated;

REVOKE UPDATE (status, background_check_passed, admin_approved_at, seller_approved_at,
               rejected_reason, seller_id, user_id, aadhaar_number, license_number)
  ON public.delivery_agents FROM anon, authenticated;

-- ============================================================
-- 3. USER ROLES: explicit admin-manages policy (default-deny stays for everyone else)
-- ============================================================
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. COUPONS: restrict public SELECT to signed-in users; hide internal config columns
-- ============================================================
DROP POLICY IF EXISTS coupons_select_active ON public.coupons;
CREATE POLICY coupons_select_active ON public.coupons
  FOR SELECT TO authenticated
  USING (active = true);

REVOKE SELECT (usage_count, usage_limit_total, usage_limit_per_user,
               created_by, metadata, geo_pincodes, new_customers_only)
  ON public.coupons FROM anon, authenticated;

-- ============================================================
-- 5. DELIVERY ASSIGNMENTS: hide OTP
-- ============================================================
REVOKE SELECT (otp) ON public.delivery_assignments FROM anon, authenticated;

-- ============================================================
-- 6. DELIVERY AUDIT LOG: remove client-side insert; only server (service_role) writes
-- ============================================================
DROP POLICY IF EXISTS "authenticated insert audit" ON public.delivery_audit_log;

-- ============================================================
-- 7. REVIEWS: hide reviewer customer_id from anonymous visitors
-- ============================================================
REVOKE SELECT (customer_id) ON public.reviews FROM anon;

-- ============================================================
-- 8. Trigger-only SECURITY DEFINER functions: drop EXECUTE from PUBLIC/anon/authenticated
--    These are invoked only by triggers, never by API clients.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.award_coins_on_delivery()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_mystery_reward_on_milestone() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.extend_subscription_on_skip()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_subscription_deliveries()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_dish_rating()                FROM PUBLIC, anon, authenticated;
