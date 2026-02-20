-- Meta Embedded Signup support

ALTER TABLE public.merchant_settings
  ADD COLUMN IF NOT EXISTS meta_waba_id text NULL,
  ADD COLUMN IF NOT EXISTS meta_phone_number_id text NULL,
  ADD COLUMN IF NOT EXISTS meta_access_token_last4 text NULL,
  ADD COLUMN IF NOT EXISTS meta_token_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS embedded_signup_status text NULL,
  ADD COLUMN IF NOT EXISTS embedded_signup_error text NULL,
  ADD COLUMN IF NOT EXISTS embedded_signup_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.meta_signup_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  consumed_at timestamptz NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_signup_nonces_lookup
ON public.meta_signup_nonces(state, merchant_id, user_id, expires_at);

ALTER TABLE public.meta_signup_nonces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_signup_nonces' AND policyname = 'Service role full meta_signup_nonces'
  ) THEN
    CREATE POLICY "Service role full meta_signup_nonces"
    ON public.meta_signup_nonces FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;
