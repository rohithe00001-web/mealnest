
-- ============= ENUMS =============
CREATE TYPE public.subscription_plan_type AS ENUM ('weekly', 'half_month', 'monthly');
CREATE TYPE public.subscription_plan_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE public.subscription_meal_selection AS ENUM (
  'breakfast_only','lunch_only','dinner_only','breakfast_lunch','lunch_dinner','full_day'
);
CREATE TYPE public.subscription_status AS ENUM ('active','paused','completed','cancelled');
CREATE TYPE public.subscription_delivery_status AS ENUM ('scheduled','skipped','delivered','paused');

-- ============= subscription_plans =============
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  plan_type public.subscription_plan_type NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days IN (7,15,30)),
  meal_types text[] NOT NULL DEFAULT ARRAY['breakfast','lunch','dinner']::text[],
  price_per_person numeric(10,2) NOT NULL CHECK (price_per_person >= 0),
  cuisines text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_veg boolean NOT NULL DEFAULT true,
  image_url text,
  status public.subscription_plan_status NOT NULL DEFAULT 'draft',
  is_active boolean NOT NULL DEFAULT true,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_plans_seller ON public.subscription_plans(seller_id);
CREATE INDEX idx_subscription_plans_status ON public.subscription_plans(status, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can view approved active plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (status = 'approved' AND is_active = true);

CREATE POLICY "Sellers manage own plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= subscription_plan_days =============
CREATE TABLE public.subscription_plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 31),
  breakfast_name text,
  breakfast_desc text,
  lunch_name text,
  lunch_desc text,
  dinner_name text,
  dinner_desc text,
  calories integer DEFAULT 0,
  protein_g integer DEFAULT 0,
  carbs_g integer DEFAULT 0,
  fat_g integer DEFAULT 0,
  is_veg boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_number)
);
CREATE INDEX idx_plan_days_plan ON public.subscription_plan_days(plan_id, day_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plan_days TO authenticated;
GRANT ALL ON public.subscription_plan_days TO service_role;

ALTER TABLE public.subscription_plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View days of approved plans"
  ON public.subscription_plan_days FOR SELECT TO authenticated
  USING (plan_id IN (
    SELECT id FROM public.subscription_plans
    WHERE status = 'approved' AND is_active = true
  ));

CREATE POLICY "Sellers manage own plan days"
  ON public.subscription_plan_days FOR ALL TO authenticated
  USING (plan_id IN (
    SELECT p.id FROM public.subscription_plans p
    JOIN public.sellers s ON s.id = p.seller_id
    WHERE s.user_id = auth.uid()
  ))
  WITH CHECK (plan_id IN (
    SELECT p.id FROM public.subscription_plans p
    JOIN public.sellers s ON s.id = p.seller_id
    WHERE s.user_id = auth.uid()
  ));

CREATE POLICY "Admins manage all plan days"
  ON public.subscription_plan_days FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= subscriptions =============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
  people_count integer NOT NULL DEFAULT 1 CHECK (people_count >= 1),
  meal_selection public.subscription_meal_selection NOT NULL DEFAULT 'full_day',
  address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  delivery_address jsonb NOT NULL,
  delivery_slot text NOT NULL DEFAULT 'lunch',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'active',
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  customizations jsonb NOT NULL DEFAULT '{}'::jsonb,
  extension_days integer NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cod',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_customer ON public.subscriptions(customer_id, status);
CREATE INDEX idx_subscriptions_seller ON public.subscriptions(seller_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage own subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Sellers view their subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= subscription_deliveries =============
CREATE TABLE public.subscription_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  day_number integer NOT NULL,
  status public.subscription_delivery_status NOT NULL DEFAULT 'scheduled',
  meals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, scheduled_date)
);
CREATE INDEX idx_deliveries_sub ON public.subscription_deliveries(subscription_id, scheduled_date);
CREATE INDEX idx_deliveries_seller_date ON public.subscription_deliveries(seller_id, scheduled_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_deliveries TO authenticated;
GRANT ALL ON public.subscription_deliveries TO service_role;

ALTER TABLE public.subscription_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own deliveries"
  ON public.subscription_deliveries FOR SELECT TO authenticated
  USING (subscription_id IN (SELECT id FROM public.subscriptions WHERE customer_id = auth.uid()));

CREATE POLICY "Customers update own deliveries"
  ON public.subscription_deliveries FOR UPDATE TO authenticated
  USING (subscription_id IN (SELECT id FROM public.subscriptions WHERE customer_id = auth.uid()))
  WITH CHECK (subscription_id IN (SELECT id FROM public.subscriptions WHERE customer_id = auth.uid()));

CREATE POLICY "Sellers view their deliveries"
  ON public.subscription_deliveries FOR SELECT TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Sellers update their deliveries"
  ON public.subscription_deliveries FOR UPDATE TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all deliveries"
  ON public.subscription_deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_deliveries_updated_at
  BEFORE UPDATE ON public.subscription_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= Trigger: auto-generate deliveries on subscription insert =============
CREATE OR REPLACE FUNCTION public.generate_subscription_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d integer;
  duration integer;
  day_row record;
  meal_data jsonb;
BEGIN
  SELECT duration_days INTO duration FROM public.subscription_plans WHERE id = NEW.plan_id;
  IF duration IS NULL THEN RETURN NEW; END IF;

  FOR d IN 1..duration LOOP
    SELECT * INTO day_row FROM public.subscription_plan_days
      WHERE plan_id = NEW.plan_id AND day_number = d LIMIT 1;
    meal_data := jsonb_build_object(
      'breakfast_name', COALESCE(day_row.breakfast_name, ''),
      'lunch_name',     COALESCE(day_row.lunch_name, ''),
      'dinner_name',    COALESCE(day_row.dinner_name, ''),
      'calories',       COALESCE(day_row.calories, 0),
      'protein_g',      COALESCE(day_row.protein_g, 0),
      'carbs_g',        COALESCE(day_row.carbs_g, 0),
      'fat_g',          COALESCE(day_row.fat_g, 0)
    );
    INSERT INTO public.subscription_deliveries
      (subscription_id, seller_id, scheduled_date, day_number, meals)
    VALUES
      (NEW.id, NEW.seller_id, NEW.start_date + (d - 1), d, meal_data)
    ON CONFLICT (subscription_id, scheduled_date) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_deliveries_after_subscribe
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.generate_subscription_deliveries();

-- ============= Trigger: auto-extend end_date when a delivery is skipped =============
CREATE OR REPLACE FUNCTION public.extend_subscription_on_skip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_date date;
  sub record;
BEGIN
  IF NEW.status = 'skipped' AND (OLD.status IS DISTINCT FROM 'skipped') THEN
    SELECT * INTO sub FROM public.subscriptions WHERE id = NEW.subscription_id;
    new_date := sub.end_date + 1;
    -- Find next free date
    WHILE EXISTS (
      SELECT 1 FROM public.subscription_deliveries
      WHERE subscription_id = NEW.subscription_id AND scheduled_date = new_date
    ) LOOP
      new_date := new_date + 1;
    END LOOP;
    INSERT INTO public.subscription_deliveries
      (subscription_id, seller_id, scheduled_date, day_number, meals, status)
    VALUES
      (NEW.subscription_id, NEW.seller_id, new_date, NEW.day_number, NEW.meals, 'scheduled');
    UPDATE public.subscriptions
      SET end_date = new_date, extension_days = extension_days + 1
      WHERE id = NEW.subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER extend_sub_on_skip
  AFTER UPDATE ON public.subscription_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.extend_subscription_on_skip();
