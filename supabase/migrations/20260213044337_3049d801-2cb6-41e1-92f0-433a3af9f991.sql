
-- Add outbound fields to messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound',
ADD COLUMN IF NOT EXISTS send_status text NOT NULL DEFAULT 'unsent',
ADD COLUMN IF NOT EXISTS send_error text NULL,
ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL;

-- Backfill: user messages are inbound, ai/human are outbound drafts
UPDATE public.messages SET direction = 'inbound' WHERE sender = 'user';
UPDATE public.messages SET direction = 'outbound' WHERE sender IN ('ai', 'human');

-- Add whatsapp_access_token to merchants (server-side only)
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS whatsapp_access_token text NULL;

-- Create outbound_jobs table for idempotent send queue
CREATE TABLE IF NOT EXISTS public.outbound_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one job per message
CREATE UNIQUE INDEX IF NOT EXISTS outbound_jobs_unique_message
ON public.outbound_jobs(org_id, message_id);

-- Index for query patterns
CREATE INDEX IF NOT EXISTS idx_messages_outbound
ON public.messages(org_id, conversation_id, direction, send_status, created_at);

-- Enable RLS
ALTER TABLE public.outbound_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read their own jobs
CREATE POLICY "Org members read outbound_jobs"
ON public.outbound_jobs FOR SELECT
USING (org_id = get_active_org_id());

-- RLS: service role full access
CREATE POLICY "Service role full outbound_jobs"
ON public.outbound_jobs FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Trigger for updated_at
CREATE TRIGGER update_outbound_jobs_updated_at
BEFORE UPDATE ON public.outbound_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
