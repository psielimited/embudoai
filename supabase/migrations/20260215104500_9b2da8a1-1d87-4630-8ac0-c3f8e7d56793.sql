-- Allow org admins/managers to manage pipeline stages and stage gates

-- STAGES write policies
DROP POLICY IF EXISTS "Org manage stages insert" ON public.stages;
DROP POLICY IF EXISTS "Org manage stages update" ON public.stages;
DROP POLICY IF EXISTS "Org manage stages delete" ON public.stages;

CREATE POLICY "Org manage stages insert"
ON public.stages
FOR INSERT TO authenticated
WITH CHECK (
  org_id = get_active_org_id()
  AND get_org_role(org_id) IN ('org_admin', 'manager')
);

CREATE POLICY "Org manage stages update"
ON public.stages
FOR UPDATE TO authenticated
USING (
  org_id = get_active_org_id()
  AND get_org_role(org_id) IN ('org_admin', 'manager')
)
WITH CHECK (
  org_id = get_active_org_id()
  AND get_org_role(org_id) IN ('org_admin', 'manager')
);

CREATE POLICY "Org manage stages delete"
ON public.stages
FOR DELETE TO authenticated
USING (
  org_id = get_active_org_id()
  AND get_org_role(org_id) IN ('org_admin', 'manager')
);

-- STAGE_GATES write policies
DROP POLICY IF EXISTS "Org manage stage_gates insert" ON public.stage_gates;
DROP POLICY IF EXISTS "Org manage stage_gates update" ON public.stage_gates;
DROP POLICY IF EXISTS "Org manage stage_gates delete" ON public.stage_gates;

CREATE POLICY "Org manage stage_gates insert"
ON public.stage_gates
FOR INSERT TO authenticated
WITH CHECK (
  org_id = get_active_org_id()
  AND get_org_role(org_id) IN ('org_admin', 'manager')
);

CREATE POLICY "Org manage stage_gates update"
ON public.stage_gates
FOR UPDATE TO authenticated
USING (
  org_id = get_active_org_id()
  AND get_org_role(org_id) IN ('org_admin', 'manager')
)
WITH CHECK (
  org_id = get_active_org_id()
  AND get_org_role(org_id) IN ('org_admin', 'manager')
);

CREATE POLICY "Org manage stage_gates delete"
ON public.stage_gates
FOR DELETE TO authenticated
USING (
  org_id = get_active_org_id()
  AND get_org_role(org_id) IN ('org_admin', 'manager')
);
