CREATE POLICY "Org admin can update org"
ON public.orgs FOR UPDATE
USING (get_org_role(id) = 'org_admin'::text)
WITH CHECK (get_org_role(id) = 'org_admin'::text);