
-- Extend conversations with workflow fields
-- Note: 'status' column already exists, we'll expand its values via application code
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL,
ADD COLUMN IF NOT EXISTS owner_team_id uuid NULL,
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS ai_paused boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS last_human_outbound_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS last_ai_outbound_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS outcome text NULL;

-- Indexes for workflow queries
CREATE INDEX IF NOT EXISTS idx_conversations_workflow
ON public.conversations(org_id, status, priority, updated_at);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_user
ON public.conversations(org_id, owner_user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_team
ON public.conversations(org_id, owner_team_id, updated_at);

-- Conversation events audit trail
CREATE TABLE IF NOT EXISTS public.conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  actor_user_id uuid NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_events_conv
ON public.conversation_events(org_id, conversation_id, created_at);

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read conversation_events"
ON public.conversation_events FOR SELECT
USING (org_id = get_active_org_id());

CREATE POLICY "Service role full conversation_events"
ON public.conversation_events FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SLA policies per merchant
CREATE TABLE IF NOT EXISTS public.conversation_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  first_response_minutes int NOT NULL DEFAULT 15,
  next_response_minutes int NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, merchant_id)
);

ALTER TABLE public.conversation_sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read conversation_sla_policies"
ON public.conversation_sla_policies FOR SELECT
USING (org_id = get_active_org_id());

CREATE POLICY "Org admin manages conversation_sla_policies"
ON public.conversation_sla_policies FOR INSERT
WITH CHECK (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin'::text);

CREATE POLICY "Org admin updates conversation_sla_policies"
ON public.conversation_sla_policies FOR UPDATE
USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin'::text);

CREATE POLICY "Org admin deletes conversation_sla_policies"
ON public.conversation_sla_policies FOR DELETE
USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin'::text);

-- Trigger for updated_at on sla_policies
CREATE TRIGGER update_conversation_sla_policies_updated_at
BEFORE UPDATE ON public.conversation_sla_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
