-- Reliability + Observability hardening

ALTER TABLE public.outbound_jobs
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE public.outbound_jobs
SET retry_count = COALESCE(retry_count, attempts, 0)
WHERE retry_count IS DISTINCT FROM COALESCE(attempts, 0);

UPDATE public.outbound_jobs
SET next_retry_at = COALESCE(next_retry_at, now())
WHERE next_retry_at IS NULL;

UPDATE public.outbound_jobs
SET idempotency_key = COALESCE(idempotency_key, 'msg:' || message_id::text)
WHERE idempotency_key IS NULL;

ALTER TABLE public.outbound_jobs
  ALTER COLUMN next_retry_at SET DEFAULT now(),
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS outbound_jobs_unique_idempotency_key
ON public.outbound_jobs(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_outbound_jobs_queue
ON public.outbound_jobs(status, next_retry_at, retry_count, max_retries);

ALTER TABLE public.channel_events
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';

CREATE INDEX IF NOT EXISTS idx_channel_events_severity_created
ON public.channel_events(org_id, severity, created_at DESC);

CREATE OR REPLACE VIEW public.conversation_timeline_view AS
SELECT
  ce.id,
  ce.org_id,
  ce.conversation_id,
  'conversation_event'::text AS source_type,
  ce.event_type,
  'info'::text AS severity,
  COALESCE(ce.details, '{}'::jsonb) AS metadata,
  ce.created_at
FROM public.conversation_events ce

UNION ALL

SELECT
  ch.id,
  ch.org_id,
  conv.id AS conversation_id,
  'channel_event'::text AS source_type,
  ch.event_type,
  CASE
    WHEN ch.severity IS NOT NULL THEN ch.severity
    WHEN ch.event_type = 'status' AND COALESCE(ch.payload->>'status', '') = 'failed' THEN 'error'
    ELSE 'info'
  END AS severity,
  jsonb_build_object(
    'function_name', 'whatsapp-webhook',
    'channel', ch.channel,
    'provider', ch.provider,
    'provider_event_id', ch.provider_event_id,
    'merchant_id', ch.merchant_id,
    'external_contact', ch.external_contact,
    'payload', ch.payload
  ) AS metadata,
  ch.created_at
FROM public.channel_events ch
LEFT JOIN LATERAL (
  SELECT c.id
  FROM public.conversations c
  WHERE c.org_id = ch.org_id
    AND c.merchant_id = ch.merchant_id
    AND c.external_contact = ch.external_contact
  ORDER BY c.updated_at DESC
  LIMIT 1
) conv ON true

UNION ALL

SELECT
  ae.id,
  ae.org_id,
  conv.id AS conversation_id,
  'audit_event'::text AS source_type,
  ae.event_type,
  'info'::text AS severity,
  jsonb_build_object(
    'entity_type', ae.entity_type,
    'entity_id', ae.entity_id,
    'opportunity_id', ae.opportunity_id,
    'diff', ae.diff,
    'actor_user_id', ae.actor_user_id
  ) AS metadata,
  ae.created_at
FROM public.audit_events ae
LEFT JOIN LATERAL (
  SELECT c.id
  FROM public.conversations c
  WHERE c.org_id = ae.org_id
    AND c.opportunity_id = ae.opportunity_id
  ORDER BY c.updated_at DESC
  LIMIT 1
) conv ON true

UNION ALL

SELECT
  se.id,
  se.org_id,
  CASE
    WHEN se.entity_type = 'conversation' THEN se.entity_id
    ELSE conv.id
  END AS conversation_id,
  'sla_event'::text AS source_type,
  se.sla_type AS event_type,
  COALESCE(se.severity, 'warn') AS severity,
  jsonb_build_object(
    'entity_type', se.entity_type,
    'entity_id', se.entity_id,
    'details', se.details,
    'resolved_at', se.resolved_at
  ) AS metadata,
  se.created_at
FROM public.sla_events se
LEFT JOIN LATERAL (
  SELECT c.id
  FROM public.conversations c
  WHERE c.org_id = se.org_id
    AND c.opportunity_id = se.entity_id
  ORDER BY c.updated_at DESC
  LIMIT 1
) conv ON se.entity_type = 'opportunity'

UNION ALL

SELECT
  oj.id,
  oj.org_id,
  oj.conversation_id,
  'outbound_job'::text AS source_type,
  'outbound_failure'::text AS event_type,
  'error'::text AS severity,
  jsonb_build_object(
    'function_name', 'send-whatsapp-message',
    'merchant_id', oj.merchant_id,
    'message_id', oj.message_id,
    'retry_count', oj.retry_count,
    'max_retries', oj.max_retries,
    'last_error', oj.last_error,
    'idempotency_key', oj.idempotency_key
  ) AS metadata,
  oj.updated_at AS created_at
FROM public.outbound_jobs oj
WHERE oj.status = 'failed';
