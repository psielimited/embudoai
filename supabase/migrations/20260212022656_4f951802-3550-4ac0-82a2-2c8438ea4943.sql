
-- ============================================================
-- Phase 8: Leads, Contacts, Dedupe, Import Jobs
-- ============================================================

-- 1. LEADS
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'manual',
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id uuid NULL,
  stage_id uuid NULL REFERENCES public.stages(id),
  status text NOT NULL DEFAULT 'open',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  converted_contact_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('open','converted','disqualified'));

CREATE INDEX idx_leads_org_owner ON public.leads(org_id, owner_user_id);
CREATE INDEX idx_leads_org_status ON public.leads(org_id, status);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org sees leads" ON public.leads FOR SELECT
  USING (
    org_id = get_active_org_id()
    AND (
      get_org_role(org_id) IN ('org_admin','analyst')
      OR owner_user_id = auth.uid()
      OR (get_org_role(org_id) = 'manager' AND owner_user_id IN (SELECT get_team_user_ids(org_id)))
    )
  );

CREATE POLICY "Org insert leads" ON public.leads FOR INSERT
  WITH CHECK (
    org_id = get_active_org_id()
    AND get_org_role(org_id) IN ('org_admin','manager','rep')
  );

CREATE POLICY "Org update leads" ON public.leads FOR UPDATE
  USING (
    org_id = get_active_org_id()
    AND (
      get_org_role(org_id) = 'org_admin'
      OR owner_user_id = auth.uid()
      OR (get_org_role(org_id) = 'manager' AND owner_user_id IN (SELECT get_team_user_ids(org_id)))
    )
  );

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. CONTACTS
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  doc_id text NULL,
  addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_org ON public.contacts(org_id);
CREATE INDEX idx_contacts_org_doc ON public.contacts(org_id, doc_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org sees contacts" ON public.contacts FOR SELECT
  USING (
    org_id = get_active_org_id()
    AND (
      get_org_role(org_id) IN ('org_admin','analyst')
      OR owner_user_id = auth.uid()
      OR (get_org_role(org_id) = 'manager' AND owner_user_id IN (SELECT get_team_user_ids(org_id)))
    )
  );

CREATE POLICY "Org insert contacts" ON public.contacts FOR INSERT
  WITH CHECK (
    org_id = get_active_org_id()
    AND get_org_role(org_id) IN ('org_admin','manager','rep')
  );

CREATE POLICY "Org update contacts" ON public.contacts FOR UPDATE
  USING (
    org_id = get_active_org_id()
    AND (
      get_org_role(org_id) = 'org_admin'
      OR owner_user_id = auth.uid()
      OR (get_org_role(org_id) = 'manager' AND owner_user_id IN (SELECT get_team_user_ids(org_id)))
    )
  );

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. LEAD_MATCHES
CREATE TABLE public.lead_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  matched_entity_type text NOT NULL,
  matched_entity_id uuid NOT NULL,
  match_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_matches ADD CONSTRAINT lead_matches_entity_type_check
  CHECK (matched_entity_type IN ('lead','contact'));

ALTER TABLE public.lead_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org sees lead_matches" ON public.lead_matches FOR SELECT
  USING (org_id = get_active_org_id());

CREATE POLICY "Service role insert lead_matches" ON public.lead_matches FOR INSERT
  WITH CHECK (true);

-- 4. DEDUPE_RULES
CREATE TABLE public.dedupe_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  keys jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dedupe_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org reads dedupe_rules" ON public.dedupe_rules FOR SELECT
  USING (org_id = get_active_org_id());

CREATE POLICY "Org admin manages dedupe_rules" ON public.dedupe_rules FOR INSERT
  WITH CHECK (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin');

CREATE POLICY "Org admin updates dedupe_rules" ON public.dedupe_rules FOR UPDATE
  USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin');

CREATE POLICY "Org admin deletes dedupe_rules" ON public.dedupe_rules FOR DELETE
  USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin');

-- 5. IMPORT_JOBS
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_report_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_jobs ADD CONSTRAINT import_jobs_type_check
  CHECK (type IN ('leads_csv'));

ALTER TABLE public.import_jobs ADD CONSTRAINT import_jobs_status_check
  CHECK (status IN ('queued','running','completed','failed'));

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own or admin sees import_jobs" ON public.import_jobs FOR SELECT
  USING (
    org_id = get_active_org_id()
    AND (
      created_by = auth.uid()
      OR get_org_role(org_id) IN ('org_admin','manager')
    )
  );

CREATE POLICY "Org insert import_jobs" ON public.import_jobs FOR INSERT
  WITH CHECK (
    org_id = get_active_org_id()
    AND created_by = auth.uid()
    AND get_org_role(org_id) IN ('org_admin','manager','rep')
  );

CREATE POLICY "Service role update import_jobs" ON public.import_jobs FOR UPDATE
  USING (true);

CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. STORAGE BUCKET for imports
INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload to own folder in imports" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own imports" ON storage.objects FOR SELECT
  USING (bucket_id = 'imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role full access imports" ON storage.objects FOR ALL
  USING (bucket_id = 'imports')
  WITH CHECK (bucket_id = 'imports');

-- 7. ADD leads/contacts to FK on converted_contact_id
ALTER TABLE public.leads
  ADD CONSTRAINT leads_converted_contact_id_fkey
  FOREIGN KEY (converted_contact_id) REFERENCES public.contacts(id);

-- 8. Extend audit_events to support lead entity type
-- (audit_events already has entity-agnostic columns; we just use opportunity_id loosely or add entity columns)
-- Add generic entity columns to audit_events for non-opportunity events
ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'opportunity',
  ADD COLUMN IF NOT EXISTS entity_id uuid NULL;

-- Make opportunity_id nullable for non-opportunity audit events
ALTER TABLE public.audit_events ALTER COLUMN opportunity_id DROP NOT NULL;
