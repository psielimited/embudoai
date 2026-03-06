ALTER TABLE public.merchant_settings
  ADD COLUMN IF NOT EXISTS code_verification_status text NULL,
  ADD COLUMN IF NOT EXISTS phone_registration_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS registration_checked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS registration_error text NULL,
  ADD COLUMN IF NOT EXISTS otp_requested_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS registration_last_attempt_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS token_scope_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS token_scopes jsonb NULL;

UPDATE public.merchant_settings
SET
  phone_registration_status = COALESCE(phone_registration_status, 'unknown'),
  token_scope_status = COALESCE(token_scope_status, 'unknown');
