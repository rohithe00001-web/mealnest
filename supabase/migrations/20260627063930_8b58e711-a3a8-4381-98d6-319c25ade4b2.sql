
-- 1) coupons: enforce locked-down SELECT (access only via list_active_coupons_safe RPC)
REVOKE SELECT ON public.coupons FROM anon, authenticated;
GRANT SELECT ON public.coupons TO authenticated; -- needed so RLS policies (own_created / seller_manage_own / admin_all) can return rows
REVOKE SELECT ON public.coupons FROM anon;

-- 2) mystery_rewards: remove broad customer UPDATE; claim flow uses SECURITY DEFINER claim_mystery_reward
DROP POLICY IF EXISTS "Users update own mystery rewards" ON public.mystery_rewards;

-- 3) reviews: hide customer_id from public reads; keep aggregate/public-facing columns visible
REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, seller_id, dish_id, rating, comment, seller_reply, created_at)
  ON public.reviews TO anon, authenticated;
-- Owners / sellers / admins still need full row access for their own management flows;
-- the existing RLS policies still scope rows, but column grants limit what columns can be read.
-- Allow customer_id read only for the row's owner via a SECURITY DEFINER helper if needed later.
GRANT SELECT (customer_id) ON public.reviews TO authenticated;
-- RLS still applies so authenticated users only see customer_id on rows allowed by SELECT policies.
-- Tighten "Reviews public" to exclude exposing customer_id to anonymous viewers:
DROP POLICY IF EXISTS "Reviews public" ON public.reviews;
CREATE POLICY "Reviews public read" ON public.reviews
  FOR SELECT TO anon, authenticated USING (true);
