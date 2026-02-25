ALTER TABLE public.merchant_settings
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_waba_id text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_business_id text NULL,
  ADD COLUMN IF NOT EXISTS creds_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS creds_error text NULL,
  ADD COLUMN IF NOT EXISTS creds_checked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS webhook_verify_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS webhook_verify_error text NULL,
  ADD COLUMN IF NOT EXISTS webhook_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_inbound_event_id uuid NULL,
  ADD COLUMN IF NOT EXISTS inbound_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS inbound_error text NULL,
  ADD COLUMN IF NOT EXISTS last_outbound_error text NULL,
  ADD COLUMN IF NOT EXISTS outbound_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS templates_summary jsonb NULL,
  ADD COLUMN IF NOT EXISTS templates_checked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_validation_payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS step_progress jsonb NULL;

-- Keep snapshot ids in sync with existing merchant/meta values
UPDATE public.merchant_settings ms
SET
  whatsapp_phone_number_id = COALESCE(ms.whatsapp_phone_number_id, ms.meta_phone_number_id, m.whatsapp_phone_number_id),
  whatsapp_waba_id = COALESCE(ms.whatsapp_waba_id, ms.meta_waba_id)
FROM public.merchants m
WHERE m.id = ms.merchant_id;

-- Backfill compact statuses from legacy booleans
UPDATE public.merchant_settings
SET
  creds_status = CASE
    WHEN credentials_valid IS TRUE THEN 'pass'
    WHEN credentials_error IS NOT NULL THEN 'fail'
    ELSE 'unknown'
  END,
  creds_error = COALESCE(creds_error, credentials_error),
  creds_checked_at = COALESCE(creds_checked_at, credentials_last_checked_at),
  webhook_verify_status = CASE
    WHEN webhook_challenge_valid IS TRUE THEN 'pass'
    WHEN webhook_challenge_error IS NOT NULL THEN 'fail'
    ELSE 'unknown'
  END,
  webhook_verify_error = COALESCE(webhook_verify_error, webhook_challenge_error),
  webhook_verified_at = COALESCE(webhook_verified_at, webhook_challenge_last_checked_at),
  last_inbound_at = COALESCE(last_inbound_at, last_webhook_received_at),
  inbound_status = CASE
    WHEN connectivity_inbound_ok IS TRUE THEN 'pass'
    WHEN connectivity_inbound_last_checked_at IS NOT NULL THEN 'fail'
    ELSE 'unknown'
  END,
  inbound_error = CASE
    WHEN connectivity_inbound_ok IS TRUE THEN NULL
    ELSE inbound_error
  END,
  last_outbound_error = COALESCE(last_outbound_error, connectivity_outbound_error),
  outbound_status = CASE
    WHEN connectivity_outbound_ok IS TRUE THEN 'pass'
    WHEN connectivity_outbound_last_checked_at IS NOT NULL OR connectivity_outbound_error IS NOT NULL THEN 'fail'
    ELSE 'unknown'
  END,
  templates_summary = COALESCE(
    templates_summary,
    jsonb_build_object(
      'approved_count', COALESCE(template_approved_count, 0),
      'pending_count', COALESCE(template_pending_count, 0),
      'rejected_count', COALESCE(template_rejected_count, 0)
    )
  ),
  templates_checked_at = COALESCE(
    templates_checked_at,
    token_last_checked_at,
    credentials_last_checked_at
  ),
  last_validation_payload = COALESCE(last_validation_payload, validation_results),
  step_progress = COALESCE(
    step_progress,
    jsonb_build_object('onboarding_step', onboarding_step)
  );

-- Link latest inbound event ids where possible
UPDATE public.merchant_settings ms
SET last_inbound_event_id = latest.id
FROM (
  SELECT DISTINCT ON (ce.merchant_id)
    ce.merchant_id,
    ce.id
  FROM public.channel_events ce
  WHERE ce.channel = 'whatsapp'
    AND ce.event_type = 'message'
  ORDER BY ce.merchant_id, ce.created_at DESC
) latest
WHERE latest.merchant_id = ms.merchant_id
  AND ms.last_inbound_event_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_settings_updated_at
ON public.merchant_settings(updated_at);

CREATE INDEX IF NOT EXISTS idx_merchant_settings_last_inbound_at
ON public.merchant_settings(last_inbound_at);

CREATE INDEX IF NOT EXISTS idx_merchant_settings_last_outbound_success_at
ON public.merchant_settings(last_outbound_success_at);
