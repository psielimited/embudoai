
-- =====================================================
-- Gap #2: CRM linkage for messaging tables
-- =====================================================

-- A) Extend conversations with CRM references
ALTER TABLE conversations
  ADD COLUMN contact_id uuid NULL REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN opportunity_id uuid NULL REFERENCES opportunities(id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversations_opportunity_id ON conversations(opportunity_id);

-- Enforce at most one of contact_id / lead_id
CREATE OR REPLACE FUNCTION public.enforce_conversation_person_link()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND NEW.lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'conversation cannot reference both contact_id and lead_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_conversation_person_link
  BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION enforce_conversation_person_link();

-- Org-alignment triggers for conversation CRM references
CREATE OR REPLACE FUNCTION public.enforce_conversation_crm_org_match()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_ref_org uuid;
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    SELECT org_id INTO v_ref_org FROM contacts WHERE id = NEW.contact_id;
    IF v_ref_org IS NULL OR v_ref_org != NEW.org_id THEN
      RAISE EXCEPTION 'conversation.contact_id org mismatch: conv=% ref=%', NEW.org_id, v_ref_org;
    END IF;
  END IF;
  IF NEW.lead_id IS NOT NULL THEN
    SELECT org_id INTO v_ref_org FROM leads WHERE id = NEW.lead_id;
    IF v_ref_org IS NULL OR v_ref_org != NEW.org_id THEN
      RAISE EXCEPTION 'conversation.lead_id org mismatch: conv=% ref=%', NEW.org_id, v_ref_org;
    END IF;
  END IF;
  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT org_id INTO v_ref_org FROM opportunities WHERE id = NEW.opportunity_id;
    IF v_ref_org IS NULL OR v_ref_org != NEW.org_id THEN
      RAISE EXCEPTION 'conversation.opportunity_id org mismatch: conv=% ref=%', NEW.org_id, v_ref_org;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_conversation_crm_org_match
  BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION enforce_conversation_crm_org_match();

-- B) contact_channels canonical identity table
CREATE TABLE IF NOT EXISTS public.contact_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  channel text NOT NULL,
  external_contact text NOT NULL,
  contact_id uuid NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- XOR constraint: exactly one of contact_id/lead_id must be set
-- Using a trigger since CHECK with complex logic can be fragile
CREATE OR REPLACE FUNCTION public.enforce_contact_channels_one_person()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF (NEW.contact_id IS NULL AND NEW.lead_id IS NULL) OR
     (NEW.contact_id IS NOT NULL AND NEW.lead_id IS NOT NULL) THEN
    RAISE EXCEPTION 'contact_channels must reference exactly one of contact_id or lead_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_channels_one_person
  BEFORE INSERT OR UPDATE ON contact_channels
  FOR EACH ROW EXECUTE FUNCTION enforce_contact_channels_one_person();

CREATE UNIQUE INDEX contact_channels_unique
  ON contact_channels(org_id, channel, external_contact);

ALTER TABLE contact_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read contact_channels"
  ON contact_channels FOR SELECT
  USING (org_id = get_active_org_id());

CREATE POLICY "Org members insert contact_channels"
  ON contact_channels FOR INSERT
  WITH CHECK (org_id = get_active_org_id());

CREATE POLICY "Org members update contact_channels"
  ON contact_channels FOR UPDATE
  USING (org_id = get_active_org_id());

CREATE POLICY "Org members delete contact_channels"
  ON contact_channels FOR DELETE
  USING (org_id = get_active_org_id());

CREATE POLICY "Service role full contact_channels"
  ON contact_channels FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Org-alignment trigger for contact_channels references
CREATE OR REPLACE FUNCTION public.enforce_contact_channels_org_match()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_ref_org uuid;
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    SELECT org_id INTO v_ref_org FROM contacts WHERE id = NEW.contact_id;
    IF v_ref_org IS NULL OR v_ref_org != NEW.org_id THEN
      RAISE EXCEPTION 'contact_channels.contact_id org mismatch';
    END IF;
  END IF;
  IF NEW.lead_id IS NOT NULL THEN
    SELECT org_id INTO v_ref_org FROM leads WHERE id = NEW.lead_id;
    IF v_ref_org IS NULL OR v_ref_org != NEW.org_id THEN
      RAISE EXCEPTION 'contact_channels.lead_id org mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_channels_org_match
  BEFORE INSERT OR UPDATE ON contact_channels
  FOR EACH ROW EXECUTE FUNCTION enforce_contact_channels_org_match();
