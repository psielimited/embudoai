-- HITL smoke test checks for Embudex
-- Run this after exercising the flows (abuse, ai_error, human send, resolve) in UI/API.
--
-- Optional: update target_email / external_contact to your fixture.

DO $$
DECLARE
  target_email text := 'embudex04@yopmail.com';
  external_contact text := '18095550001';

  v_user_id uuid;
  v_org_id uuid;
  v_conversation_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = target_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for %', target_email;
  END IF;

  SELECT active_org_id INTO v_org_id
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No active_org_id found for %', target_email;
  END IF;

  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE org_id = v_org_id
    AND external_contact = external_contact
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'No conversation found for contact % in org %', external_contact, v_org_id;
  END IF;

  RAISE NOTICE 'Using org_id=% conversation_id=%', v_org_id, v_conversation_id;
END $$;

-- Scenario 1: Abuse/escalation should create handoff + no AI auto-send after handoff
WITH base AS (
  SELECT c.id AS conversation_id
  FROM public.conversations c
  JOIN public.profiles p ON p.active_org_id = c.org_id
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = 'embudex04@yopmail.com'
    AND c.external_contact = '18095550001'
  ORDER BY c.updated_at DESC
  LIMIT 1
),
latest_handoff AS (
  SELECT h.*
  FROM public.conversation_handoffs h
  JOIN base b ON b.conversation_id = h.conversation_id
  ORDER BY h.created_at DESC
  LIMIT 1
),
ai_outbound_after_handoff AS (
  SELECT count(*) AS count_ai_outbound
  FROM public.messages m
  JOIN latest_handoff h ON h.conversation_id = m.conversation_id
  WHERE m.sender = 'ai'
    AND m.direction = 'outbound'
    AND m.created_at > h.created_at
)
SELECT
  'Scenario 1 - Abuse/Handoff' AS check_name,
  h.id AS handoff_id,
  h.reason_code,
  h.status AS handoff_status,
  c.status AS conversation_status,
  c.handoff_active,
  a.count_ai_outbound,
  (h.id IS NOT NULL) AS pass_handoff_created,
  (c.status = 'needs_handoff' AND c.handoff_active = true) AS pass_conversation_in_handoff,
  (a.count_ai_outbound = 0) AS pass_no_ai_autosend_after_handoff
FROM latest_handoff h
JOIN public.conversations c ON c.id = h.conversation_id
CROSS JOIN ai_outbound_after_handoff a;

-- Scenario 2: AI error should create handoff with reason_code='ai_error'
WITH base AS (
  SELECT c.id AS conversation_id
  FROM public.conversations c
  JOIN public.profiles p ON p.active_org_id = c.org_id
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = 'embudex04@yopmail.com'
    AND c.external_contact = '18095550001'
  ORDER BY c.updated_at DESC
  LIMIT 1
),
ai_error_handoff AS (
  SELECT h.*
  FROM public.conversation_handoffs h
  JOIN base b ON b.conversation_id = h.conversation_id
  WHERE h.reason_code = 'ai_error'
  ORDER BY h.created_at DESC
  LIMIT 1
)
SELECT
  'Scenario 2 - AI Error Handoff' AS check_name,
  h.id AS handoff_id,
  h.reason_code,
  h.created_at,
  (h.id IS NOT NULL) AS pass_ai_error_handoff_exists
FROM ai_error_handoff h;

-- Scenario 3: Human send from suggestion should queue outbound + suggestion used
WITH base AS (
  SELECT c.id AS conversation_id
  FROM public.conversations c
  JOIN public.profiles p ON p.active_org_id = c.org_id
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = 'embudex04@yopmail.com'
    AND c.external_contact = '18095550001'
  ORDER BY c.updated_at DESC
  LIMIT 1
),
latest_used_suggestion AS (
  SELECT s.*
  FROM public.conversation_suggestions s
  JOIN base b ON b.conversation_id = s.conversation_id
  WHERE s.status = 'used'
  ORDER BY s.created_at DESC
  LIMIT 1
),
latest_human_message AS (
  SELECT m.*
  FROM public.messages m
  JOIN base b ON b.conversation_id = m.conversation_id
  WHERE m.sender = 'human'
    AND m.direction = 'outbound'
  ORDER BY m.created_at DESC
  LIMIT 1
),
job_for_message AS (
  SELECT j.*
  FROM public.outbound_jobs j
  JOIN latest_human_message m ON m.id = j.message_id
  ORDER BY j.created_at DESC
  LIMIT 1
)
SELECT
  'Scenario 3 - Human Send From Suggestion' AS check_name,
  s.id AS suggestion_id,
  s.status AS suggestion_status,
  m.id AS human_message_id,
  m.send_status AS human_message_send_status,
  j.id AS outbound_job_id,
  j.status AS outbound_job_status,
  (s.id IS NOT NULL AND s.status = 'used') AS pass_suggestion_used,
  (m.id IS NOT NULL) AS pass_human_message_created,
  (j.id IS NOT NULL) AS pass_outbound_job_created
FROM latest_used_suggestion s
FULL OUTER JOIN latest_human_message m ON TRUE
FULL OUTER JOIN job_for_message j ON TRUE;

-- Scenario 4: Resolve handoff should restore automation
WITH base AS (
  SELECT c.*
  FROM public.conversations c
  JOIN public.profiles p ON p.active_org_id = c.org_id
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = 'embudex04@yopmail.com'
    AND c.external_contact = '18095550001'
  ORDER BY c.updated_at DESC
  LIMIT 1
),
latest_resolved_handoff AS (
  SELECT h.*
  FROM public.conversation_handoffs h
  JOIN base b ON b.id = h.conversation_id
  WHERE h.status = 'resolved'
  ORDER BY h.resolved_at DESC NULLS LAST, h.created_at DESC
  LIMIT 1
)
SELECT
  'Scenario 4 - Resolve & Resume' AS check_name,
  h.id AS resolved_handoff_id,
  h.status AS handoff_status,
  h.resolved_at,
  c.status AS conversation_status,
  c.handoff_active,
  c.ai_paused,
  (h.id IS NOT NULL) AS pass_resolved_handoff_exists,
  (c.status = 'open' AND c.handoff_active = false AND c.ai_paused = false) AS pass_conversation_resumed
FROM latest_resolved_handoff h
JOIN base c ON c.id = h.conversation_id;
