-- Org-level settings for timezone and default conversation SLA thresholds
CREATE TABLE IF NOT EXISTS public.org_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.orgs(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  sla_first_response_minutes int NOT NULL DEFAULT 15 CHECK (sla_first_response_minutes > 0),
  sla_next_response_minutes int NOT NULL DEFAULT 60 CHECK (sla_next_response_minutes > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill defaults for existing orgs
INSERT INTO public.org_settings (org_id)
SELECT o.id
FROM public.orgs o
ON CONFLICT (org_id) DO NOTHING;

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read org_settings"
ON public.org_settings FOR SELECT
USING (org_id = get_active_org_id());

CREATE POLICY "Org admin insert org_settings"
ON public.org_settings FOR INSERT
WITH CHECK (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin'::text);

CREATE POLICY "Org admin update org_settings"
ON public.org_settings FOR UPDATE
USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin'::text);

CREATE POLICY "Org admin delete org_settings"
ON public.org_settings FOR DELETE
USING (org_id = get_active_org_id() AND get_org_role(org_id) = 'org_admin'::text);

CREATE POLICY "Service role full org_settings"
ON public.org_settings FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE TRIGGER update_org_settings_updated_at
BEFORE UPDATE ON public.org_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
