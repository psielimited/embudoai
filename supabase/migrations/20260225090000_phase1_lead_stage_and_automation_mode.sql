DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'lead_stage'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.lead_stage AS ENUM (
      'new',
      'contacted',
      'qualified',
      'negotiating',
      'won',
      'lost'
    );
  END IF;
END
$$;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_stage public.lead_stage NOT NULL DEFAULT 'new';

-- Legacy status mapping
UPDATE public.leads
SET lead_stage = 'won'
WHERE status = 'converted';

UPDATE public.leads
SET lead_stage = 'lost'
WHERE status = 'disqualified';

-- Legacy boolean mapping if those columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'converted'
  ) THEN
    EXECUTE 'UPDATE public.leads SET lead_stage = ''won'' WHERE converted = true';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'disqualified'
  ) THEN
    EXECUTE 'UPDATE public.leads SET lead_stage = ''lost'' WHERE disqualified = true';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'automation_mode'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.automation_mode AS ENUM (
      'ai',
      'human',
      'hybrid'
    );
  END IF;
END
$$;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS automation_mode public.automation_mode NOT NULL DEFAULT 'ai';

-- Existing columns in current schema
UPDATE public.conversations
SET automation_mode = 'human'
WHERE ai_paused = true
   OR ai_enabled = false;

-- Legacy boolean mapping if those columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'ai_disabled'
  ) THEN
    EXECUTE 'UPDATE public.conversations SET automation_mode = ''human'' WHERE ai_disabled = true';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'paused_by_user'
  ) THEN
    EXECUTE 'UPDATE public.conversations SET automation_mode = ''human'' WHERE paused_by_user = true';
  END IF;
END
$$;
