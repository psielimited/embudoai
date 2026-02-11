
-- ============================================================
-- Phase 0: Foundation Schema, RLS, Profiles Trigger, Seed Data
-- ============================================================

-- 0. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'rep');

-- 1. Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role app_role NOT NULL DEFAULT 'rep',
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Managers can read managed profiles" ON public.profiles FOR SELECT TO authenticated USING (
  manager_user_id = auth.uid()
);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: check role without recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_manager()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manager_user_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Pipelines
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read pipelines" ON public.pipelines FOR SELECT TO authenticated USING (true);

-- 3. Stages
CREATE TABLE public.stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read stages" ON public.stages FOR SELECT TO authenticated USING (true);

-- 4. Stage Gates
CREATE TABLE public.stage_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  required_fields text[] NOT NULL DEFAULT '{}',
  required_activity_types text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stage_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read stage_gates" ON public.stage_gates FOR SELECT TO authenticated USING (true);

-- 5. Opportunities
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.stages(id),
  name text NOT NULL,
  amount numeric,
  expected_close_date date,
  status text NOT NULL DEFAULT 'open',
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Opportunity RLS: rep sees own, manager sees reps', admin sees all
CREATE POLICY "Rep sees own opportunities" ON public.opportunities FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());
CREATE POLICY "Manager sees managed reps opportunities" ON public.opportunities FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'manager'
    AND owner_user_id IN (
      SELECT p.user_id FROM public.profiles p WHERE p.manager_user_id = auth.uid()
    )
  );
CREATE POLICY "Admin sees all opportunities" ON public.opportunities FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY "Rep can insert own opportunities" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Admin can insert any opportunity" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Rep can update own opportunities" ON public.opportunities FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Admin can update any opportunity" ON public.opportunities FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin');
CREATE POLICY "Manager can update managed opportunities" ON public.opportunities FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'manager'
    AND owner_user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.manager_user_id = auth.uid())
  );

-- 6. Activities
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'opportunity',
  entity_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('call','message','email','meeting','note','file')),
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Activities visible if related opportunity is visible
CREATE POLICY "Activities visible via opportunity" ON public.activities FOR SELECT TO authenticated
  USING (
    entity_type = 'opportunity'
    AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = entity_id)
  );
CREATE POLICY "User can insert activities" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND entity_type = 'opportunity'
    AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = entity_id)
  );

-- 7. Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  assigned_to uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks visible via opportunity" ON public.tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id));
CREATE POLICY "User can insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id));
CREATE POLICY "User can update own tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

-- 8. Audit Events (append-only, no client writes)
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL,
  diff jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Read-only for clients via opportunity visibility
CREATE POLICY "Audit events readable via opportunity" ON public.audit_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id));
-- No INSERT/UPDATE/DELETE policies for authenticated = client cannot write

-- 9. Automation Rules
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('stage_changed','opportunity_created')),
  conditions jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read automation_rules" ON public.automation_rules FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');
CREATE POLICY "Admin can insert automation_rules" ON public.automation_rules FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admin can update automation_rules" ON public.automation_rules FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin');
CREATE POLICY "Admin can delete automation_rules" ON public.automation_rules FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- Seed data: Default pipeline + stages + stage gates
-- ============================================================

INSERT INTO public.pipelines (id, name, is_default) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Default Pipeline', true);

INSERT INTO public.stages (id, pipeline_id, name, position) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Lead', 0),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Qualified', 1),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Proposal Sent', 2),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Negotiation', 3),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Won', 4),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Lost', 5);

INSERT INTO public.stage_gates (stage_id, required_fields, required_activity_types) VALUES
  ('b0000000-0000-0000-0000-000000000002', '{}', '{"call"}'),
  ('b0000000-0000-0000-0000-000000000003', '{"amount","expected_close_date"}', '{}'),
  ('b0000000-0000-0000-0000-000000000005', '{"amount"}', '{}');

-- Updated_at triggers for new tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
