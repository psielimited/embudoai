
-- Phase 7 Part 1: Drop views, create tables, add columns, backfill

-- Drop views that reference tables we'll modify
DROP VIEW IF EXISTS public.v_funnel_counts CASCADE;
DROP VIEW IF EXISTS public.v_time_in_stage CASCADE;
DROP VIEW IF EXISTS public.v_rep_performance_daily CASCADE;

-- 1. Create orgs table
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- 2. Create org_members table
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('org_admin','manager','rep','analyst')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members (user_id);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 3. Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_org ON public.teams (org_id);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 4. Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_team_manager boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members (user_id);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 5. Add active_org_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_org_id uuid REFERENCES public.orgs(id);

-- 6. Add org_id to all core tables
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.stages ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.stage_gates ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.analytics_daily ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.sla_events ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);

-- 7. Backfill default org
INSERT INTO public.orgs (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Default Org')
ON CONFLICT (id) DO NOTHING;

UPDATE public.pipelines SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.stages SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.stage_gates SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.opportunities SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.activities SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.tasks SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.audit_events SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.automation_rules SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.analytics_daily SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.sla_events SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.notifications SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.profiles SET active_org_id = '00000000-0000-0000-0000-000000000001' WHERE active_org_id IS NULL;

-- 8. Make org_id NOT NULL
ALTER TABLE public.pipelines ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.stages ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.stage_gates ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.opportunities ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.activities ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.audit_events ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.automation_rules ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.analytics_daily ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.sla_events ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN org_id SET NOT NULL;

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_pipelines_org ON public.pipelines (org_id);
CREATE INDEX IF NOT EXISTS idx_stages_org ON public.stages (org_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON public.opportunities (org_id);
CREATE INDEX IF NOT EXISTS idx_activities_org ON public.activities (org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks (org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_org ON public.audit_events (org_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON public.automation_rules (org_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_org ON public.analytics_daily (org_id);
CREATE INDEX IF NOT EXISTS idx_sla_events_org ON public.sla_events (org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications (org_id);

-- 10. Backfill org_members
INSERT INTO public.org_members (org_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', p.user_id,
  CASE p.role WHEN 'admin' THEN 'org_admin' WHEN 'manager' THEN 'manager' WHEN 'rep' THEN 'rep' ELSE 'rep' END
FROM public.profiles p
ON CONFLICT DO NOTHING;

-- 11. Helper functions
CREATE OR REPLACE FUNCTION public.get_active_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT active_org_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_org_role(p_org_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.org_members WHERE org_id = p_org_id AND user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.org_members WHERE org_id = p_org_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_team_user_ids(p_org_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT tm2.user_id
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  JOIN public.team_members tm2 ON tm2.team_id = tm.team_id
  WHERE t.org_id = p_org_id AND tm.user_id = auth.uid() AND tm.is_team_manager = true;
$$;

-- 12. RLS for new tables
CREATE POLICY "Members can read own orgs" ON public.orgs FOR SELECT TO authenticated
  USING (is_org_member(id));

CREATE POLICY "Members can read org members" ON public.org_members FOR SELECT TO authenticated
  USING (is_org_member(org_id));
CREATE POLICY "Org admin can manage members" ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (get_org_role(org_id) = 'org_admin');
CREATE POLICY "Org admin can update members" ON public.org_members FOR UPDATE TO authenticated
  USING (get_org_role(org_id) = 'org_admin');
CREATE POLICY "Org admin can delete members" ON public.org_members FOR DELETE TO authenticated
  USING (get_org_role(org_id) = 'org_admin');

CREATE POLICY "Members can read teams" ON public.teams FOR SELECT TO authenticated
  USING (is_org_member(org_id));
CREATE POLICY "Admin/manager can manage teams" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (get_org_role(org_id) IN ('org_admin', 'manager'));
CREATE POLICY "Admin/manager can update teams" ON public.teams FOR UPDATE TO authenticated
  USING (get_org_role(org_id) IN ('org_admin', 'manager'));
CREATE POLICY "Org admin can delete teams" ON public.teams FOR DELETE TO authenticated
  USING (get_org_role(org_id) = 'org_admin');

CREATE POLICY "Members can read team members" ON public.team_members FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND is_org_member(t.org_id)));
CREATE POLICY "Admin/manager can insert team members" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND get_org_role(t.org_id) IN ('org_admin','manager')));
CREATE POLICY "Admin/manager can update team members" ON public.team_members FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND get_org_role(t.org_id) IN ('org_admin','manager')));
CREATE POLICY "Admin/manager can delete team members" ON public.team_members FOR DELETE TO authenticated
  USING (EXISTS(SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND get_org_role(t.org_id) IN ('org_admin','manager')));

-- 13. Replace old RLS with org-aware
DROP POLICY IF EXISTS "Admin sees all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Manager sees managed reps opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Rep sees own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admin can insert any opportunity" ON public.opportunities;
DROP POLICY IF EXISTS "Admin can update any opportunity" ON public.opportunities;
DROP POLICY IF EXISTS "Manager can update managed opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Rep can insert own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Rep can update own opportunities" ON public.opportunities;

CREATE POLICY "Org sees opportunities" ON public.opportunities FOR SELECT TO authenticated
  USING (org_id = get_active_org_id() AND (
    get_org_role(org_id) IN ('org_admin', 'analyst') OR owner_user_id = auth.uid()
    OR (get_org_role(org_id) = 'manager' AND owner_user_id IN (SELECT get_team_user_ids(org_id)))
  ));
CREATE POLICY "Org insert opportunities" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (org_id = get_active_org_id() AND get_org_role(org_id) IN ('org_admin', 'manager', 'rep'));
CREATE POLICY "Org update opportunities" ON public.opportunities FOR UPDATE TO authenticated
  USING (org_id = get_active_org_id() AND (
    get_org_role(org_id) = 'org_admin' OR owner_user_id = auth.uid()
    OR (get_org_role(org_id) = 'manager' AND owner_user_id IN (SELECT get_team_user_ids(org_id)))
  ));

DROP POLICY IF EXISTS "Authenticated can read pipelines" ON public.pipelines;
CREATE POLICY "Org reads pipelines" ON public.pipelines FOR SELECT TO authenticated USING (org_id = get_active_org_id());

DROP POLICY IF EXISTS "Authenticated can read stages" ON public.stages;
CREATE POLICY "Org reads stages" ON public.stages FOR SELECT TO authenticated USING (org_id = get_active_org_id());

DROP POLICY IF EXISTS "Authenticated can read stage_gates" ON public.stage_gates;
CREATE POLICY "Org reads stage_gates" ON public.stage_gates FOR SELECT TO authenticated USING (org_id = get_active_org_id());

DROP POLICY IF EXISTS "Activities visible via opportunity" ON public.activities;
DROP POLICY IF EXISTS "User can insert activities" ON public.activities;
CREATE POLICY "Org sees activities" ON public.activities FOR SELECT TO authenticated
  USING (org_id = get_active_org_id());
CREATE POLICY "Org insert activities" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (org_id = get_active_org_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Tasks visible via opportunity" ON public.tasks;
DROP POLICY IF EXISTS "User can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "User can update own tasks" ON public.tasks;
CREATE POLICY "Org sees tasks" ON public.tasks FOR SELECT TO authenticated
  USING (org_id = get_active_org_id());
CREATE POLICY "Org insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (org_id = get_active_org_id());
CREATE POLICY "Org update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (org_id = get_active_org_id() AND (assigned_to = auth.uid() OR created_by = auth.uid()));

DROP POLICY IF EXISTS "Audit events readable via opportunity" ON public.audit_events;
CREATE POLICY "Org sees audit events" ON public.audit_events FOR SELECT TO authenticated
  USING (org_id = get_active_org_id());

DROP POLICY IF EXISTS "Admin can read automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Admin can insert automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Admin can update automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Admin can delete automation_rules" ON public.automation_rules;
CREATE POLICY "Org admin reads rules" ON public.automation_rules FOR SELECT TO authenticated
  USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin');
CREATE POLICY "Org admin inserts rules" ON public.automation_rules FOR INSERT TO authenticated
  WITH CHECK (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin');
CREATE POLICY "Org admin updates rules" ON public.automation_rules FOR UPDATE TO authenticated
  USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin');
CREATE POLICY "Org admin deletes rules" ON public.automation_rules FOR DELETE TO authenticated
  USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin');

DROP POLICY IF EXISTS "Admin can read all analytics" ON public.analytics_daily;
DROP POLICY IF EXISTS "Users can read own analytics" ON public.analytics_daily;
DROP POLICY IF EXISTS "Manager can read team analytics" ON public.analytics_daily;
CREATE POLICY "Org reads analytics" ON public.analytics_daily FOR SELECT TO authenticated
  USING (org_id = get_active_org_id());

DROP POLICY IF EXISTS "SLA events visible via opportunity" ON public.sla_events;
CREATE POLICY "Org sees sla events" ON public.sla_events FOR SELECT TO authenticated
  USING (org_id = get_active_org_id());

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin can read all notifications" ON public.notifications;
CREATE POLICY "Own notifications in org" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND org_id = get_active_org_id());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND org_id = get_active_org_id());

-- 14. Recreate views with org_id
CREATE VIEW public.v_funnel_counts WITH (security_invoker=on) AS
SELECT o.pipeline_id, o.org_id, (ae.diff->>'to_stage_id')::uuid AS stage_id,
  (ae.created_at::date) AS day, COUNT(*) AS entries
FROM public.audit_events ae
JOIN public.opportunities o ON o.id = ae.opportunity_id
WHERE ae.event_type = 'stage_changed' AND ae.diff->>'to_stage_id' IS NOT NULL
GROUP BY o.pipeline_id, o.org_id, ae.diff->>'to_stage_id', ae.created_at::date;

CREATE VIEW public.v_time_in_stage WITH (security_invoker=on) AS
WITH stage_enters AS (
  SELECT ae.opportunity_id, o.org_id, (ae.diff->>'to_stage_id')::uuid AS stage_id,
    ae.created_at AS entered_at,
    LEAD(ae.created_at) OVER (PARTITION BY ae.opportunity_id ORDER BY ae.created_at) AS exited_at
  FROM public.audit_events ae
  JOIN public.opportunities o ON o.id = ae.opportunity_id
  WHERE ae.event_type = 'stage_changed' AND ae.diff->>'to_stage_id' IS NOT NULL
)
SELECT opportunity_id, org_id, stage_id, entered_at, exited_at,
  EXTRACT(EPOCH FROM COALESCE(exited_at, now()) - entered_at) / 3600.0 AS duration_hours
FROM stage_enters;

CREATE VIEW public.v_rep_performance_daily WITH (security_invoker=on) AS
SELECT o.owner_user_id, o.org_id, a.created_at::date AS day,
  COUNT(*) AS activities_count, 0 AS tasks_created, 0 AS tasks_overdue_count
FROM public.activities a
JOIN public.opportunities o ON o.id = a.entity_id AND a.entity_type = 'opportunity'
GROUP BY o.owner_user_id, o.org_id, a.created_at::date;
