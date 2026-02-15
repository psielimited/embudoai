-- Optional stage-level SLA threshold for opportunity time-in-stage monitoring
ALTER TABLE public.stage_gates
ADD COLUMN IF NOT EXISTS max_days_in_stage int NULL CHECK (max_days_in_stage > 0);
