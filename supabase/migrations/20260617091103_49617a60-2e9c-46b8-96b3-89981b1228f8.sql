
-- Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery_agent';

-- Enums
DO $$ BEGIN
  CREATE TYPE public.delivery_agent_status AS ENUM ('pending_seller','pending_admin','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_assignment_status AS ENUM ('assigned','picked_up','delivered','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- delivery_agents
CREATE TABLE public.delivery_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  vehicle_type text,
  vehicle_number text,
  aadhaar_number text,
  license_number text,
  id_doc_url text,
  license_doc_url text,
  vehicle_doc_url text,
  background_check_passed boolean NOT NULL DEFAULT false,
  status public.delivery_agent_status NOT NULL DEFAULT 'pending_seller',
  seller_approved_at timestamptz,
  admin_approved_at timestamptz,
  rejected_reason text,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  delivery_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, seller_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_agents TO authenticated;
GRANT ALL ON public.delivery_agents TO service_role;
ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent reads own" ON public.delivery_agents FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "seller reads own agents" ON public.delivery_agents FOR SELECT TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "admin reads all agents" ON public.delivery_agents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agent self register" ON public.delivery_agents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending_seller');
CREATE POLICY "agent updates own profile" ON public.delivery_agents FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "seller updates own agents" ON public.delivery_agents FOR UPDATE TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "admin updates all agents" ON public.delivery_agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "seller deletes own agents" ON public.delivery_agents FOR DELETE TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE TRIGGER trg_delivery_agents_updated BEFORE UPDATE ON public.delivery_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- delivery_zones
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name text NOT NULL,
  pincode text NOT NULL,
  radius_km numeric(5,2) NOT NULL DEFAULT 5,
  admin_approved boolean NOT NULL DEFAULT false,
  admin_approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT SELECT ON public.delivery_zones TO anon;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads approved zones" ON public.delivery_zones FOR SELECT
  USING (admin_approved OR seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "seller manages own zones" ON public.delivery_zones FOR ALL TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "admin manages all zones" ON public.delivery_zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_delivery_zones_updated BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_schedules
CREATE TABLE public.agent_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  slot text NOT NULL CHECK (slot IN ('morning','afternoon','evening')),
  active boolean NOT NULL DEFAULT true,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, weekday, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_schedules TO authenticated;
GRANT ALL ON public.agent_schedules TO service_role;
ALTER TABLE public.agent_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent reads own schedule" ON public.agent_schedules FOR SELECT TO authenticated
  USING (agent_id IN (SELECT id FROM public.delivery_agents WHERE user_id = auth.uid()));
CREATE POLICY "seller manages own agent schedule" ON public.agent_schedules FOR ALL TO authenticated
  USING (agent_id IN (SELECT da.id FROM public.delivery_agents da JOIN public.sellers s ON s.id=da.seller_id WHERE s.user_id=auth.uid()))
  WITH CHECK (agent_id IN (SELECT da.id FROM public.delivery_agents da JOIN public.sellers s ON s.id=da.seller_id WHERE s.user_id=auth.uid()));
CREATE POLICY "admin reads all schedules" ON public.agent_schedules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- agent_payroll
CREATE TABLE public.agent_payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  month date NOT NULL,
  salary_base numeric(10,2) NOT NULL DEFAULT 0,
  per_order_rate numeric(10,2) NOT NULL DEFAULT 0,
  incentive_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_amount numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_payroll TO authenticated;
GRANT ALL ON public.agent_payroll TO service_role;
ALTER TABLE public.agent_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent reads own payroll" ON public.agent_payroll FOR SELECT TO authenticated
  USING (agent_id IN (SELECT id FROM public.delivery_agents WHERE user_id = auth.uid()));
CREATE POLICY "seller manages own agent payroll" ON public.agent_payroll FOR ALL TO authenticated
  USING (agent_id IN (SELECT da.id FROM public.delivery_agents da JOIN public.sellers s ON s.id=da.seller_id WHERE s.user_id=auth.uid()))
  WITH CHECK (agent_id IN (SELECT da.id FROM public.delivery_agents da JOIN public.sellers s ON s.id=da.seller_id WHERE s.user_id=auth.uid()));
CREATE POLICY "admin reads all payroll" ON public.agent_payroll FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_agent_payroll_updated BEFORE UPDATE ON public.agent_payroll
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- delivery_assignments
CREATE TABLE public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.delivery_agents(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  subscription_delivery_id uuid REFERENCES public.subscription_deliveries(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.delivery_assignment_status NOT NULL DEFAULT 'assigned',
  otp text NOT NULL DEFAULT lpad((floor(random()*10000))::text, 4, '0'),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  failed_reason text,
  customer_rating smallint CHECK (customer_rating BETWEEN 1 AND 5),
  customer_feedback text,
  current_lat numeric(9,6),
  current_lng numeric(9,6),
  last_location_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (order_id IS NOT NULL OR subscription_delivery_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_assignments TO authenticated;
GRANT ALL ON public.delivery_assignments TO service_role;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer reads own assignment" ON public.delivery_assignments FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY "agent reads own assignment" ON public.delivery_assignments FOR SELECT TO authenticated
  USING (agent_id IN (SELECT id FROM public.delivery_agents WHERE user_id = auth.uid()));
CREATE POLICY "agent updates own assignment" ON public.delivery_assignments FOR UPDATE TO authenticated
  USING (agent_id IN (SELECT id FROM public.delivery_agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM public.delivery_agents WHERE user_id = auth.uid()));
CREATE POLICY "seller manages own assignments" ON public.delivery_assignments FOR ALL TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "admin manages all assignments" ON public.delivery_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- delivery_audit_log
CREATE TABLE public.delivery_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_audit_log TO authenticated;
GRANT ALL ON public.delivery_audit_log TO service_role;
ALTER TABLE public.delivery_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads audit" ON public.delivery_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "authenticated insert audit" ON public.delivery_audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Extend orders & subscription_deliveries
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_agent_id uuid REFERENCES public.delivery_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_status text;

ALTER TABLE public.subscription_deliveries
  ADD COLUMN IF NOT EXISTS delivery_agent_id uuid REFERENCES public.delivery_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_status text;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_da_seller ON public.delivery_agents(seller_id);
CREATE INDEX IF NOT EXISTS idx_da_user ON public.delivery_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_da_status ON public.delivery_agents(status);
CREATE INDEX IF NOT EXISTS idx_assignments_agent ON public.delivery_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_assignments_seller ON public.delivery_assignments(seller_id);
CREATE INDEX IF NOT EXISTS idx_assignments_customer ON public.delivery_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_zones_seller ON public.delivery_zones(seller_id);
