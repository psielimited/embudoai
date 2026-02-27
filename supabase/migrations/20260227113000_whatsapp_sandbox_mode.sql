ALTER TABLE public.merchant_settings
  ADD COLUMN IF NOT EXISTS whatsapp_is_sandbox boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sandbox_waba_id text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_sandbox_phone_number_id text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_sandbox_token_last4 text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_sandbox_token_updated_at timestamptz NULL;

ALTER TABLE public.merchant_settings
  DROP CONSTRAINT IF EXISTS merchant_settings_whatsapp_mode_isolation_chk;

ALTER TABLE public.merchant_settings
  ADD CONSTRAINT merchant_settings_whatsapp_mode_isolation_chk
  CHECK (
    (
      whatsapp_is_sandbox = true
      AND whatsapp_waba_id IS NULL
      AND whatsapp_phone_number_id IS NULL
      AND meta_access_token_last4 IS NULL
      AND meta_token_updated_at IS NULL
      AND meta_waba_id IS NULL
      AND meta_phone_number_id IS NULL
    )
    OR
    (
      whatsapp_is_sandbox = false
      AND whatsapp_sandbox_waba_id IS NULL
      AND whatsapp_sandbox_phone_number_id IS NULL
      AND whatsapp_sandbox_token_last4 IS NULL
      AND whatsapp_sandbox_token_updated_at IS NULL
    )
  );

