
DROP POLICY IF EXISTS "Admin can delete automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Admin can insert automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Admin can read automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Admin can update automation_rules" ON public.automation_rules;

CREATE POLICY "Admin can read automation_rules" ON public.automation_rules FOR SELECT USING (get_my_role() = 'admin'::app_role);
CREATE POLICY "Admin can insert automation_rules" ON public.automation_rules FOR INSERT WITH CHECK (get_my_role() = 'admin'::app_role);
CREATE POLICY "Admin can update automation_rules" ON public.automation_rules FOR UPDATE USING (get_my_role() = 'admin'::app_role);
CREATE POLICY "Admin can delete automation_rules" ON public.automation_rules FOR DELETE USING (get_my_role() = 'admin'::app_role);
