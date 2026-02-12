
-- Create the trigger to auto-create profiles on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fix INSERT policy: INSERT uses WITH CHECK, not USING
DROP POLICY IF EXISTS "Admin can insert automation_rules" ON public.automation_rules;
CREATE POLICY "Admin can insert automation_rules"
  ON public.automation_rules FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin'::app_role);

-- Recreate other policies with explicit TO authenticated
DROP POLICY IF EXISTS "Admin can read automation_rules" ON public.automation_rules;
CREATE POLICY "Admin can read automation_rules"
  ON public.automation_rules FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin'::app_role);

DROP POLICY IF EXISTS "Admin can update automation_rules" ON public.automation_rules;
CREATE POLICY "Admin can update automation_rules"
  ON public.automation_rules FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin'::app_role);

DROP POLICY IF EXISTS "Admin can delete automation_rules" ON public.automation_rules;
CREATE POLICY "Admin can delete automation_rules"
  ON public.automation_rules FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin'::app_role);
