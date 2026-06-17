
-- Phase 1: Coupon engine foundation

-- Extend coupons table
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform','seller','category')),
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat','percent','free_delivery','partial_delivery')),
  ADD COLUMN IF NOT EXISTS usage_limit_total integer,
  ADD COLUMN IF NOT EXISTS usage_limit_per_user integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'order' CHECK (applies_to IN ('order','subscription','both')),
  ADD COLUMN IF NOT EXISTS subscription_plan_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cuisine_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS geo_pincodes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS festival_tag text,
  ADD COLUMN IF NOT EXISTS new_customers_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_coupons_seller ON public.coupons(seller_id);
CREATE INDEX IF NOT EXISTS idx_coupons_scope_active ON public.coupons(scope, active);
CREATE INDEX IF NOT EXISTS idx_coupons_festival ON public.coupons(festival_tag) WHERE festival_tag IS NOT NULL;

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drop old broad SELECT policy and replace with scoped policies
DROP POLICY IF EXISTS "Active coupons public" ON public.coupons;
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;

CREATE POLICY "coupons_select_active" ON public.coupons FOR SELECT
  USING (active = true);

CREATE POLICY "coupons_admin_all" ON public.coupons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "coupons_seller_manage_own" ON public.coupons FOR ALL
  USING (
    scope = 'seller' AND EXISTS (
      SELECT 1 FROM public.sellers s WHERE s.id = coupons.seller_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    scope = 'seller' AND EXISTS (
      SELECT 1 FROM public.sellers s WHERE s.id = coupons.seller_id AND s.user_id = auth.uid()
    )
  );

-- Redemptions table
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  order_total numeric NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redemptions_coupon ON public.coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON public.coupon_redemptions(user_id);

GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redemptions_owner_select" ON public.coupon_redemptions FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.coupons c
      JOIN public.sellers s ON s.id = c.seller_id
      WHERE c.id = coupon_redemptions.coupon_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY "redemptions_owner_insert" ON public.coupon_redemptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Add coupon link to orders for audit (non-breaking)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text;

-- Validation function: returns (valid, discount, reason)
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _user uuid,
  _seller uuid,
  _order_total numeric,
  _kind text DEFAULT 'order'  -- 'order' or 'subscription'
) RETURNS TABLE (valid boolean, discount numeric, reason text, coupon_id uuid, discount_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
  user_uses integer;
  computed numeric := 0;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE upper(code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 'Coupon not found', NULL::uuid, NULL::text; RETURN;
  END IF;
  IF NOT c.active THEN
    RETURN QUERY SELECT false, 0::numeric, 'Coupon inactive', c.id, c.discount_type; RETURN;
  END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY SELECT false, 0::numeric, 'Coupon not yet active', c.id, c.discount_type; RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT false, 0::numeric, 'Coupon expired', c.id, c.discount_type; RETURN;
  END IF;
  IF _order_total < COALESCE(c.min_order, 0) THEN
    RETURN QUERY SELECT false, 0::numeric, format('Minimum order ₹%s required', c.min_order), c.id, c.discount_type; RETURN;
  END IF;
  IF c.scope = 'seller' AND c.seller_id IS DISTINCT FROM _seller THEN
    RETURN QUERY SELECT false, 0::numeric, 'Not valid for this kitchen', c.id, c.discount_type; RETURN;
  END IF;
  IF c.applies_to = 'order' AND _kind = 'subscription' THEN
    RETURN QUERY SELECT false, 0::numeric, 'Not valid for subscriptions', c.id, c.discount_type; RETURN;
  END IF;
  IF c.applies_to = 'subscription' AND _kind = 'order' THEN
    RETURN QUERY SELECT false, 0::numeric, 'Only valid for subscription plans', c.id, c.discount_type; RETURN;
  END IF;
  IF c.usage_limit_total IS NOT NULL AND c.usage_count >= c.usage_limit_total THEN
    RETURN QUERY SELECT false, 0::numeric, 'Coupon fully redeemed', c.id, c.discount_type; RETURN;
  END IF;
  IF c.usage_limit_per_user IS NOT NULL THEN
    SELECT COUNT(*) INTO user_uses FROM public.coupon_redemptions
      WHERE coupon_id = c.id AND user_id = _user;
    IF user_uses >= c.usage_limit_per_user THEN
      RETURN QUERY SELECT false, 0::numeric, 'You have already used this coupon', c.id, c.discount_type; RETURN;
    END IF;
  END IF;
  IF c.new_customers_only AND EXISTS (
    SELECT 1 FROM public.orders o WHERE o.customer_id = _user
      AND (_seller IS NULL OR o.seller_id = _seller)
  ) THEN
    RETURN QUERY SELECT false, 0::numeric, 'Only for first-time customers', c.id, c.discount_type; RETURN;
  END IF;

  -- compute discount
  IF c.discount_type = 'flat' THEN
    computed := COALESCE(c.discount_flat, 0);
  ELSIF c.discount_type = 'percent' THEN
    computed := round(_order_total * COALESCE(c.discount_percent, 0) / 100.0, 2);
    IF c.max_discount IS NOT NULL THEN
      computed := LEAST(computed, c.max_discount);
    END IF;
  ELSIF c.discount_type = 'free_delivery' THEN
    computed := 0; -- free delivery handled separately; signal via discount_type
  ELSIF c.discount_type = 'partial_delivery' THEN
    computed := COALESCE(c.discount_flat, 0);
  END IF;

  computed := LEAST(computed, _order_total);
  RETURN QUERY SELECT true, computed, 'OK'::text, c.id, c.discount_type;
END $$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, uuid, numeric, text) TO authenticated;

-- Atomic redemption function
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  _code text,
  _user uuid,
  _seller uuid,
  _order_total numeric,
  _order_id uuid,
  _subscription_id uuid,
  _kind text
) RETURNS TABLE (success boolean, discount numeric, reason text, discount_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM public.validate_coupon(_code, _user, _seller, _order_total, _kind);
  IF NOT v.valid THEN
    RETURN QUERY SELECT false, 0::numeric, v.reason, v.discount_type; RETURN;
  END IF;
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, subscription_id, discount_amount, order_total)
    VALUES (v.coupon_id, _user, _order_id, _subscription_id, v.discount, _order_total);
  UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = v.coupon_id;
  RETURN QUERY SELECT true, v.discount, 'OK'::text, v.discount_type;
END $$;

GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid, uuid, numeric, uuid, uuid, text) TO authenticated;
