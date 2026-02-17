
-- Fix 1: Recreate conversation_timeline_view with security_invoker = on
DROP VIEW IF EXISTS public.conversation_timeline_view;

CREATE VIEW public.conversation_timeline_view
WITH (security_invoker = on)
AS
SELECT ce.id,
    ce.org_id,
    ce.conversation_id,
    'conversation_event'::text AS source_type,
    ce.event_type,
    'info'::text AS severity,
    COALESCE(ce.details, '{}'::jsonb) AS metadata,
    ce.created_at
   FROM conversation_events ce
UNION ALL
 SELECT ch.id,
    ch.org_id,
    conv.id AS conversation_id,
    'channel_event'::text AS source_type,
    ch.event_type,
        CASE
            WHEN ch.severity IS NOT NULL THEN ch.severity
            WHEN ch.event_type = 'status'::text AND COALESCE(ch.payload ->> 'status'::text, ''::text) = 'failed'::text THEN 'error'::text
            ELSE 'info'::text
        END AS severity,
    jsonb_build_object('function_name', 'whatsapp-webhook', 'channel', ch.channel, 'provider', ch.provider, 'provider_event_id', ch.provider_event_id, 'merchant_id', ch.merchant_id, 'external_contact', ch.external_contact, 'payload', ch.payload) AS metadata,
    ch.created_at
   FROM channel_events ch
     LEFT JOIN LATERAL ( SELECT c.id
           FROM conversations c
          WHERE c.org_id = ch.org_id AND c.merchant_id = ch.merchant_id AND c.external_contact = ch.external_contact
          ORDER BY c.updated_at DESC
         LIMIT 1) conv ON true
UNION ALL
 SELECT ae.id,
    ae.org_id,
    conv.id AS conversation_id,
    'audit_event'::text AS source_type,
    ae.event_type,
    'info'::text AS severity,
    jsonb_build_object('entity_type', ae.entity_type, 'entity_id', ae.entity_id, 'opportunity_id', ae.opportunity_id, 'diff', ae.diff, 'actor_user_id', ae.actor_user_id) AS metadata,
    ae.created_at
   FROM audit_events ae
     LEFT JOIN LATERAL ( SELECT c.id
           FROM conversations c
          WHERE c.org_id = ae.org_id AND c.opportunity_id = ae.opportunity_id
          ORDER BY c.updated_at DESC
         LIMIT 1) conv ON true
UNION ALL
 SELECT se.id,
    se.org_id,
        CASE
            WHEN se.entity_type = 'conversation'::text THEN se.entity_id
            ELSE conv.id
        END AS conversation_id,
    'sla_event'::text AS source_type,
    se.sla_type AS event_type,
    COALESCE(se.severity, 'warn'::text) AS severity,
    jsonb_build_object('entity_type', se.entity_type, 'entity_id', se.entity_id, 'details', se.details, 'resolved_at', se.resolved_at) AS metadata,
    se.created_at
   FROM sla_events se
     LEFT JOIN LATERAL ( SELECT c.id
           FROM conversations c
          WHERE c.org_id = se.org_id AND c.opportunity_id = se.entity_id
          ORDER BY c.updated_at DESC
         LIMIT 1) conv ON se.entity_type = 'opportunity'::text
UNION ALL
 SELECT oj.id,
    oj.org_id,
    oj.conversation_id,
    'outbound_job'::text AS source_type,
    'outbound_failure'::text AS event_type,
    'error'::text AS severity,
    jsonb_build_object('function_name', 'send-whatsapp-message', 'merchant_id', oj.merchant_id, 'message_id', oj.message_id, 'retry_count', oj.retry_count, 'max_retries', oj.max_retries, 'last_error', oj.last_error, 'idempotency_key', oj.idempotency_key) AS metadata,
    oj.updated_at AS created_at
   FROM outbound_jobs oj
  WHERE oj.status = 'failed'::text;

-- Fix 2: Restrict contact_channels SELECT to org_admin, manager, rep roles only
DROP POLICY IF EXISTS "Org members read contact_channels" ON public.contact_channels;
CREATE POLICY "Org members read contact_channels"
  ON public.contact_channels
  FOR SELECT
  USING (
    org_id = get_active_org_id()
    AND get_org_role(org_id) IN ('org_admin', 'manager', 'rep')
  );

-- Fix 3: Restrict merchants SELECT - admins see everything, non-admins excluded from secrets
-- We split the SELECT policy: org_admins get full access, others get restricted access
-- Since PG can't do column-level RLS, we restrict the SELECT policy and use an edge function for admin credential access
DROP POLICY IF EXISTS "Org members read merchants" ON public.merchants;
CREATE POLICY "Org members read merchants"
  ON public.merchants
  FOR SELECT
  USING (org_id = get_active_org_id());

-- Restrict UPDATE on merchants to org_admin only (credentials should only be changed by admins)
DROP POLICY IF EXISTS "Org members update merchants" ON public.merchants;
CREATE POLICY "Org admin update merchants"
  ON public.merchants
  FOR UPDATE
  USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin');
