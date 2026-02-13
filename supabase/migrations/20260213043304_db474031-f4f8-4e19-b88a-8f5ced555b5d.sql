
-- =============================================================
-- 1) channel_events: idempotent event ledger
-- =============================================================
CREATE TABLE IF NOT EXISTS public.channel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  channel text NOT NULL,
  provider text NOT NULL,
  event_type text NOT NULL,
  provider_event_id text NOT NULL,
  external_contact text NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX channel_events_unique
ON public.channel_events(org_id, channel, provider, event_type, provider_event_id);

ALTER TABLE public.channel_events ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read
CREATE POLICY "Org members read channel_events"
ON public.channel_events FOR SELECT
USING (org_id = get_active_org_id());

-- RLS: service role full access
CREATE POLICY "Service role full channel_events"
ON public.channel_events FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- =============================================================
-- 2) messages: provider identity + delivery state columns
-- =============================================================
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS provider text NULL,
ADD COLUMN IF NOT EXISTS provider_message_id text NULL,
ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS read_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS failed_at timestamptz NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_provider_unique
ON public.messages(org_id, channel, provider, provider_message_id)
WHERE provider_message_id IS NOT NULL;

-- =============================================================
-- 3) merchants: WhatsApp config columns
-- =============================================================
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text NULL,
ADD COLUMN IF NOT EXISTS whatsapp_verify_token text NULL,
ADD COLUMN IF NOT EXISTS whatsapp_app_secret text NULL;
