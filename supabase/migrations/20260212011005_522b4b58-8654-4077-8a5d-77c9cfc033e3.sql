
-- Fix infinite recursion: replace direct profiles subquery with get_my_role()
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (get_my_role() = 'admin'::app_role);
