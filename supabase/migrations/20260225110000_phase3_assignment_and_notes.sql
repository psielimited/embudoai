-- Phase 3: lead assignment + lead notes

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid NULL REFERENCES auth.users(id);

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid NULL REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_leads_assignee_user_id
ON public.leads (assignee_user_id);

CREATE INDEX IF NOT EXISTS idx_leads_lead_stage
ON public.leads (lead_stage);

CREATE INDEX IF NOT EXISTS idx_conversations_assignee_user_id
ON public.conversations (assignee_user_id);

CREATE TABLE IF NOT EXISTS public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  conversation_id uuid NULL REFERENCES public.conversations(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NULL,
  updated_by_user_id uuid NULL REFERENCES auth.users(id),
  deleted_at timestamptz NULL,
  deleted_by_user_id uuid NULL REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_created_desc
ON public.lead_notes (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_notes_merchant_created_desc
ON public.lead_notes (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_notes_org_id
ON public.lead_notes (org_id);

CREATE INDEX IF NOT EXISTS idx_lead_notes_active_by_lead
ON public.lead_notes (lead_id)
WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_lead_note_scope_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lead_org uuid;
  v_merchant_org uuid;
  v_conv_org uuid;
BEGIN
  SELECT org_id INTO v_lead_org
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF v_lead_org IS NULL THEN
    RAISE EXCEPTION 'Lead % not found', NEW.lead_id;
  END IF;

  SELECT org_id INTO v_merchant_org
  FROM public.merchants
  WHERE id = NEW.merchant_id;

  IF v_merchant_org IS NULL THEN
    RAISE EXCEPTION 'Merchant % not found', NEW.merchant_id;
  END IF;

  IF NEW.org_id <> v_lead_org OR NEW.org_id <> v_merchant_org THEN
    RAISE EXCEPTION 'lead_notes org scope mismatch';
  END IF;

  IF NEW.conversation_id IS NOT NULL THEN
    SELECT org_id INTO v_conv_org
    FROM public.conversations
    WHERE id = NEW.conversation_id;

    IF v_conv_org IS NULL THEN
      RAISE EXCEPTION 'Conversation % not found', NEW.conversation_id;
    END IF;

    IF NEW.org_id <> v_conv_org THEN
      RAISE EXCEPTION 'lead_notes conversation org mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_notes_scope_match ON public.lead_notes;
CREATE TRIGGER trg_lead_notes_scope_match
  BEFORE INSERT OR UPDATE ON public.lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_note_scope_match();

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lead_notes'
      AND policyname = 'Org members read lead_notes'
  ) THEN
    CREATE POLICY "Org members read lead_notes"
    ON public.lead_notes
    FOR SELECT
    USING (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lead_notes'
      AND policyname = 'Org members insert own lead_notes'
  ) THEN
    CREATE POLICY "Org members insert own lead_notes"
    ON public.lead_notes
    FOR INSERT
    WITH CHECK (
      org_id = get_active_org_id()
      AND created_by_user_id = auth.uid()
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lead_notes'
      AND policyname = 'Org members update own active lead_notes'
  ) THEN
    CREATE POLICY "Org members update own active lead_notes"
    ON public.lead_notes
    FOR UPDATE
    USING (
      org_id = get_active_org_id()
      AND created_by_user_id = auth.uid()
      AND deleted_at IS NULL
    )
    WITH CHECK (
      org_id = get_active_org_id()
      AND created_by_user_id = auth.uid()
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lead_notes'
      AND policyname = 'Service role full lead_notes'
  ) THEN
    CREATE POLICY "Service role full lead_notes"
    ON public.lead_notes
    FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;
