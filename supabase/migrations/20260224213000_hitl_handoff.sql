-- Human-in-the-loop escalation (HITL)

CREATE TABLE IF NOT EXISTS public.conversation_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  run_id uuid NULL REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,
  created_by_user_id uuid NULL,
  reason_code text NOT NULL CHECK (
    reason_code IN (
      'abuse',
      'legal_threat',
      'billing_dispute',
      'refund_dispute',
      'low_confidence',
      'policy_unknown',
      'ai_error',
      'merchant_pause',
      'manual_request',
      'other'
    )
  ),
  reason_text text NULL,
  packet jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  acknowledged_by_user_id uuid NULL,
  acknowledged_at timestamptz NULL,
  resolved_by_user_id uuid NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  handoff_id uuid NULL REFERENCES public.conversation_handoffs(id) ON DELETE CASCADE,
  source_run_id uuid NULL REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used')),
  language text NULL,
  suggestions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_handoffs_org_conv_created
ON public.conversation_handoffs(org_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_handoffs_org_status_created
ON public.conversation_handoffs(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_suggestions_org_conv_created
ON public.conversation_suggestions(org_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_suggestions_org_handoff_created
ON public.conversation_suggestions(org_id, handoff_id, created_at DESC);

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS handoff_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handoff_reason_code text NULL,
  ADD COLUMN IF NOT EXISTS handoff_reason_text text NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_org_handoff_active_updated
ON public.conversations(org_id, handoff_active, updated_at DESC);

ALTER TABLE public.conversation_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_suggestions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_handoffs' AND policyname = 'Org members read conversation_handoffs'
  ) THEN
    CREATE POLICY "Org members read conversation_handoffs"
    ON public.conversation_handoffs FOR SELECT
    USING (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_handoffs' AND policyname = 'Org members insert conversation_handoffs'
  ) THEN
    CREATE POLICY "Org members insert conversation_handoffs"
    ON public.conversation_handoffs FOR INSERT
    WITH CHECK (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_handoffs' AND policyname = 'Org members update conversation_handoffs'
  ) THEN
    CREATE POLICY "Org members update conversation_handoffs"
    ON public.conversation_handoffs FOR UPDATE
    USING (org_id = get_active_org_id())
    WITH CHECK (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_handoffs' AND policyname = 'Service role full conversation_handoffs'
  ) THEN
    CREATE POLICY "Service role full conversation_handoffs"
    ON public.conversation_handoffs FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_suggestions' AND policyname = 'Org members read conversation_suggestions'
  ) THEN
    CREATE POLICY "Org members read conversation_suggestions"
    ON public.conversation_suggestions FOR SELECT
    USING (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_suggestions' AND policyname = 'Service role full conversation_suggestions'
  ) THEN
    CREATE POLICY "Service role full conversation_suggestions"
    ON public.conversation_suggestions FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;
