-- Autonomous AI Sales Agent foundation (idempotent)

CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  trigger_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  model text NOT NULL,
  status text NOT NULL,
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_org_conv_created
ON public.ai_agent_runs(org_id, conversation_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_runs_unique_trigger
ON public.ai_agent_runs(org_id, conversation_id, trigger_message_id)
WHERE trigger_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.ai_agent_runs(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text NULL,
  executed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_actions_org_run_created
ON public.ai_agent_actions(org_id, run_id, created_at);

CREATE TABLE IF NOT EXISTS public.merchant_agent_settings (
  merchant_id uuid PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  objective text NOT NULL DEFAULT 'convert',
  handoff_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_agent_settings_org
ON public.merchant_agent_settings(org_id, merchant_id);

ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_agent_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_agent_runs' AND policyname = 'Org members read ai_agent_runs'
  ) THEN
    CREATE POLICY "Org members read ai_agent_runs"
    ON public.ai_agent_runs FOR SELECT
    USING (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_agent_runs' AND policyname = 'Service role full ai_agent_runs'
  ) THEN
    CREATE POLICY "Service role full ai_agent_runs"
    ON public.ai_agent_runs FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_agent_actions' AND policyname = 'Org members read ai_agent_actions'
  ) THEN
    CREATE POLICY "Org members read ai_agent_actions"
    ON public.ai_agent_actions FOR SELECT
    USING (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_agent_actions' AND policyname = 'Service role full ai_agent_actions'
  ) THEN
    CREATE POLICY "Service role full ai_agent_actions"
    ON public.ai_agent_actions FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'merchant_agent_settings' AND policyname = 'Org members read merchant_agent_settings'
  ) THEN
    CREATE POLICY "Org members read merchant_agent_settings"
    ON public.merchant_agent_settings FOR SELECT
    USING (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'merchant_agent_settings' AND policyname = 'Service role full merchant_agent_settings'
  ) THEN
    CREATE POLICY "Service role full merchant_agent_settings"
    ON public.merchant_agent_settings FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_merchant_agent_settings_updated_at ON public.merchant_agent_settings;
CREATE TRIGGER update_merchant_agent_settings_updated_at
BEFORE UPDATE ON public.merchant_agent_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS lead_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_score_reason jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_intent text NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_org_lead_score_updated
ON public.conversations(org_id, lead_score DESC, updated_at DESC);