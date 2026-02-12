
-- Fix security definer views by recreating with security_invoker=on

CREATE OR REPLACE VIEW public.v_funnel_counts
WITH (security_invoker=on) AS
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

CREATE OR REPLACE VIEW public.v_time_in_stage
WITH (security_invoker=on) AS
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

CREATE OR REPLACE VIEW public.v_rep_performance_daily
WITH (security_invoker=on) AS
SELECT
  o.owner_user_id,
  a.created_at::date AS day,
  COUNT(*) AS activities_count,
  0 AS tasks_created,
  0 AS tasks_overdue_count
FROM public.activities a
JOIN public.opportunities o ON o.id = a.entity_id AND a.entity_type = 'opportunity'
GROUP BY o.owner_user_id, a.created_at::date;
