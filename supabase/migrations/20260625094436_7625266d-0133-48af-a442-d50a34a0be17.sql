
-- 1. SELLERS: revoke sensitive PII from public/authenticated reads
REVOKE SELECT (phone, email) ON public.sellers FROM anon, authenticated;

-- Helper for agents needing their seller's contact info
CREATE OR REPLACE FUNCTION public.get_agent_seller_contact(_agent_id uuid)
RETURNS TABLE(seller_id uuid, kitchen_name text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.kitchen_name, s.phone
  FROM public.delivery_agents a
  JOIN public.sellers s ON s.id = a.seller_id
  WHERE a.id = _agent_id
    AND (a.user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
$$;
GRANT EXECUTE ON FUNCTION public.get_agent_seller_contact(uuid) TO authenticated;

-- 2. DELIVERY_AGENTS: revoke highly sensitive PII columns from authenticated
REVOKE SELECT (aadhaar_number, license_number, id_doc_url, license_doc_url, vehicle_doc_url)
  ON public.delivery_agents FROM authenticated, anon;

-- Owner (seller of agent) / admin / the agent themselves can fetch full record
CREATE OR REPLACE FUNCTION public.get_agent_sensitive(_agent_id uuid)
RETURNS TABLE(
  id uuid, aadhaar_number text, license_number text,
  id_doc_url text, license_doc_url text, vehicle_doc_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.aadhaar_number, a.license_number,
         a.id_doc_url, a.license_doc_url, a.vehicle_doc_url
  FROM public.delivery_agents a
  WHERE a.id = _agent_id
    AND (
      a.user_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR a.seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_agent_sensitive(uuid) TO authenticated;

-- 3. COUPONS: replace broad SELECT policy; expose safe public listing via RPC
DROP POLICY IF EXISTS coupons_select_active ON public.coupons;

-- Allow authenticated users to see only their own platform-issued single-use coupons
-- (e.g. spin/mystery rewards keyed to them) — needed for redemption flow display.
-- All other browsing must go through list_active_coupons_safe.
CREATE POLICY coupons_select_own_created ON public.coupons
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.list_active_coupons_safe(_seller_id uuid)
RETURNS TABLE(
  id uuid, code text, description text, scope text, seller_id uuid,
  discount_type text, discount_flat numeric, discount_percent numeric,
  max_discount numeric, min_order numeric, applies_to text,
  expires_at timestamptz, starts_at timestamptz, festival_tag text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.code, c.description, c.scope, c.seller_id,
         c.discount_type, c.discount_flat, c.discount_percent,
         c.max_discount, c.min_order, c.applies_to,
         c.expires_at, c.starts_at, c.festival_tag
  FROM public.coupons c
  WHERE c.active = true
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (
      c.scope = 'platform'
      OR (_seller_id IS NOT NULL AND c.scope = 'seller' AND c.seller_id = _seller_id)
    )
  LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.list_active_coupons_safe(uuid) TO authenticated;

-- 4. REFERRALS: revoke anti-fraud columns from end users
REVOKE SELECT (signup_ip, device_fingerprint) ON public.referrals FROM authenticated, anon;

-- 5. USER_REFERRAL_CODES: revoke anti-fraud columns from owner
REVOKE SELECT (device_fingerprint, signup_ip) ON public.user_referral_codes FROM authenticated, anon;
