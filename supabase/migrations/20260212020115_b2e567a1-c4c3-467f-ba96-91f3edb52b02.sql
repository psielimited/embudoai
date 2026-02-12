
-- ============================================
-- Phase 6: Analytics, SLA, Notifications
-- ============================================

-- 1. analytics_daily table
CREATE TABLE public.analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id),
  owner_user_id uuid,
  metric text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_analytics_daily_unique ON public.analytics_daily (day, pipeline_id, COALESCE(owner_user_id, '00000000-0000-0000-0000-000000000000'), metric);
CREATE INDEX idx_analytics_daily_day ON public.analytics_daily (day);

ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;

-- Analytics readable by admin; reps/managers see own
CREATE POLICY "Admin can read all analytics" ON public.analytics_daily FOR SELECT TO authenticated
  USING (get_my_role() = 'admin'::app_role);
CREATE POLICY "Users can read own analytics" ON public.analytics_daily FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());
CREATE POLICY "Manager can read team analytics" ON public.analytics_daily FOR SELECT TO authenticated
  USING (get_my_role() = 'manager'::app_role AND (
    owner_user_id IN (SELECT p.user_id FROM profiles p WHERE p.manager_user_id = auth.uid())
    OR owner_user_id = auth.uid()
    OR owner_user_id IS NULL
  ));

-- 2. sla_events table
CREATE TABLE public.sla_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'opportunity',
  entity_id uuid NOT NULL,
  sla_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warn',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX idx_sla_entity ON public.sla_events (entity_type, entity_id);
CREATE INDEX idx_sla_type_created ON public.sla_events (sla_type, created_at);
CREATE INDEX idx_sla_resolved ON public.sla_events (resolved_at);

ALTER TABLE public.sla_events ENABLE ROW LEVEL SECURITY;

-- SLA events visible if underlying opportunity is visible (same as audit_events)
CREATE POLICY "SLA events visible via opportunity" ON public.sla_events FOR SELECT TO authenticated
  USING (entity_type = 'opportunity' AND EXISTS (
    SELECT 1 FROM opportunities o WHERE o.id = sla_events.entity_id
  ));

-- 3. notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at);
CREATE INDEX idx_notifications_user_read ON public.notifications (user_id, read_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admin can read all notifications" ON public.notifications FOR SELECT TO authenticated
  USING (get_my_role() = 'admin'::app_role);

-- 4. Views

-- 4.1 Funnel counts from audit_events
CREATE OR REPLACE VIEW public.v_funnel_counts AS
SELECT
  o.pipeline_id,
  (ae.diff->>'to_stage_id')::uuid AS stage_id,
  (ae.created_at::date) AS day,
  COUNT(*) AS entries
FROM public.audit_events ae
JOIN public.opportunities o ON o.id = ae.opportunity_id
WHERE ae.event_type = 'stage_changed'
  AND ae.diff->>'to_stage_id' IS NOT NULL
GROUP BY o.pipeline_id, ae.diff->>'to_stage_id', ae.created_at::date;

-- 4.2 Time in stage
CREATE OR REPLACE VIEW public.v_time_in_stage AS
WITH stage_enters AS (
  SELECT
    ae.opportunity_id,
    (ae.diff->>'to_stage_id')::uuid AS stage_id,
    ae.created_at AS entered_at,
    LEAD(ae.created_at) OVER (PARTITION BY ae.opportunity_id ORDER BY ae.created_at) AS exited_at
  FROM public.audit_events ae
  WHERE ae.event_type = 'stage_changed'
    AND ae.diff->>'to_stage_id' IS NOT NULL
)
SELECT
  opportunity_id,
  stage_id,
  entered_at,
  exited_at,
  EXTRACT(EPOCH FROM COALESCE(exited_at, now()) - entered_at) / 3600.0 AS duration_hours
FROM stage_enters;

-- 4.3 Rep performance daily
CREATE OR REPLACE VIEW public.v_rep_performance_daily AS
SELECT
  o.owner_user_id,
  a.created_at::date AS day,
  COUNT(*) AS activities_count,
  0 AS tasks_created,
  0 AS tasks_overdue_count
FROM public.activities a
JOIN public.opportunities o ON o.id = a.entity_id AND a.entity_type = 'opportunity'
GROUP BY o.owner_user_id, a.created_at::date;
