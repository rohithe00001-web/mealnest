CREATE TABLE IF NOT EXISTS public.promotional_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL, -- festival, happy_hour, flash_sale, combo, family_plan, corporate, weather
  scope text NOT NULL DEFAULT 'platform', -- platform | seller
  seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE,
  banner_image text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  discount_type text, -- flat | percent | free_delivery | combo_price
  discount_value numeric DEFAULT 0,
  max_discount numeric,
  min_order numeric DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  audience_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotional_campaigns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotional_campaigns TO authenticated;
GRANT ALL ON public.promotional_campaigns TO service_role;
ALTER TABLE public.promotional_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active campaigns" ON public.promotional_campaigns
  FOR SELECT USING (active = true AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "Admins manage all campaigns" ON public.promotional_campaigns
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers view own campaigns" ON public.promotional_campaigns
  FOR SELECT TO authenticated
  USING (scope = 'seller' AND seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Sellers manage own campaigns" ON public.promotional_campaigns
  FOR ALL TO authenticated
  USING (scope = 'seller' AND seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  WITH CHECK (scope = 'seller' AND seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE TRIGGER trg_campaigns_updated
  BEFORE UPDATE ON public.promotional_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_campaigns_active ON public.promotional_campaigns(active, ends_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_seller ON public.promotional_campaigns(seller_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.promotional_campaigns(type);

CREATE TABLE IF NOT EXISTS public.campaign_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.promotional_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  order_total numeric NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.campaign_redemptions TO authenticated;
GRANT ALL ON public.campaign_redemptions TO service_role;
ALTER TABLE public.campaign_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own campaign redemptions" ON public.campaign_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own campaign redemptions" ON public.campaign_redemptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_camp_red_camp ON public.campaign_redemptions(campaign_id);