CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _user uuid, _seller uuid, _order_total numeric, _kind text DEFAULT 'order'::text)
 RETURNS TABLE(valid boolean, discount numeric, reason text, coupon_id uuid, discount_type text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
    SELECT COUNT(*) INTO user_uses FROM public.coupon_redemptions cr
      WHERE cr.coupon_id = c.id AND cr.user_id = _user;
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

  IF c.discount_type = 'flat' THEN
    computed := COALESCE(c.discount_flat, 0);
  ELSIF c.discount_type = 'percent' THEN
    computed := round(_order_total * COALESCE(c.discount_percent, 0) / 100.0, 2);
    IF c.max_discount IS NOT NULL THEN
      computed := LEAST(computed, c.max_discount);
    END IF;
  ELSIF c.discount_type = 'free_delivery' THEN
    computed := 0;
  ELSIF c.discount_type = 'partial_delivery' THEN
    computed := COALESCE(c.discount_flat, 0);
  END IF;

  computed := LEAST(computed, _order_total);
  RETURN QUERY SELECT true, computed, 'OK'::text, c.id, c.discount_type;
END $function$;