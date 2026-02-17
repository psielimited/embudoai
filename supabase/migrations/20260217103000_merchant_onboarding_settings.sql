CREATE TABLE IF NOT EXISTS public.merchant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  onboarding_step int NOT NULL DEFAULT 1,
  credentials_valid boolean NOT NULL DEFAULT false,
  credentials_last_checked_at timestamptz NULL,
  credentials_error text NULL,
  webhook_challenge_valid boolean NOT NULL DEFAULT false,
  webhook_challenge_last_checked_at timestamptz NULL,
  webhook_challenge_error text NULL,
  connectivity_outbound_ok boolean NOT NULL DEFAULT false,
  connectivity_outbound_last_checked_at timestamptz NULL,
  connectivity_outbound_error text NULL,
  connectivity_inbound_ok boolean NOT NULL DEFAULT false,
  connectivity_inbound_last_checked_at timestamptz NULL,
  connectivity_inbound_marker text NULL,
  last_webhook_received_at timestamptz NULL,
  last_outbound_success_at timestamptz NULL,
  last_outbound_failure_at timestamptz NULL,
  token_expires_at timestamptz NULL,
  token_valid boolean NOT NULL DEFAULT false,
  token_last_checked_at timestamptz NULL,
  template_approval_state text NULL,
  template_approved_count int NOT NULL DEFAULT 0,
  template_pending_count int NOT NULL DEFAULT 0,
  template_rejected_count int NOT NULL DEFAULT 0,
  validation_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_settings_org ON public.merchant_settings(org_id, merchant_id);

ALTER TABLE public.merchant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read merchant_settings"
ON public.merchant_settings FOR SELECT
USING (org_id = get_active_org_id());

CREATE POLICY "Service role full merchant_settings"
ON public.merchant_settings FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

DROP TRIGGER IF EXISTS update_merchant_settings_updated_at ON public.merchant_settings;
CREATE TRIGGER update_merchant_settings_updated_at
BEFORE UPDATE ON public.merchant_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
