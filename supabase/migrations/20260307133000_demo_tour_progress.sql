CREATE TABLE IF NOT EXISTS public.demo_tour_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_steps text[] NOT NULL DEFAULT ARRAY[]::text[],
  last_completed_step text NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_demo_tour_progress_org_user
ON public.demo_tour_progress (org_id, user_id);

ALTER TABLE public.demo_tour_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own demo_tour_progress" ON public.demo_tour_progress;
CREATE POLICY "Users read own demo_tour_progress"
ON public.demo_tour_progress
FOR SELECT
USING (user_id = auth.uid() AND org_id = get_active_org_id());

DROP POLICY IF EXISTS "Users insert own demo_tour_progress" ON public.demo_tour_progress;
CREATE POLICY "Users insert own demo_tour_progress"
ON public.demo_tour_progress
FOR INSERT
WITH CHECK (user_id = auth.uid() AND org_id = get_active_org_id());

DROP POLICY IF EXISTS "Users update own demo_tour_progress" ON public.demo_tour_progress;
CREATE POLICY "Users update own demo_tour_progress"
ON public.demo_tour_progress
FOR UPDATE
USING (user_id = auth.uid() AND org_id = get_active_org_id())
WITH CHECK (user_id = auth.uid() AND org_id = get_active_org_id());

DROP POLICY IF EXISTS "Service role full demo_tour_progress" ON public.demo_tour_progress;
CREATE POLICY "Service role full demo_tour_progress"
ON public.demo_tour_progress
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_demo_tour_progress_updated_at ON public.demo_tour_progress;
CREATE TRIGGER update_demo_tour_progress_updated_at
BEFORE UPDATE ON public.demo_tour_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

