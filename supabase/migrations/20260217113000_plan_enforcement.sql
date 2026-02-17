-- Plan-aware monetization enforcement

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  monthly_price numeric(12,2) NOT NULL DEFAULT 0,
  message_limit int NOT NULL DEFAULT 0,
  ai_enabled boolean NOT NULL DEFAULT true,
  automation_enabled boolean NOT NULL DEFAULT false,
  sla_monitoring_enabled boolean NOT NULL DEFAULT false,
  catalog_enabled boolean NOT NULL DEFAULT false,
  multi_user_enabled boolean NOT NULL DEFAULT false,
  support_level text NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_plans' AND policyname = 'Authenticated read subscription_plans'
  ) THEN
    CREATE POLICY "Authenticated read subscription_plans"
    ON public.subscription_plans FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_plans' AND policyname = 'Service role full subscription_plans'
  ) THEN
    CREATE POLICY "Service role full subscription_plans"
    ON public.subscription_plans FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;

INSERT INTO public.subscription_plans (name, monthly_price, message_limit, ai_enabled, automation_enabled, sla_monitoring_enabled, catalog_enabled, multi_user_enabled, support_level)
VALUES
  ('Free', 0, 200, true, false, false, false, false, 'community'),
  ('Starter', 1200, 500, true, false, false, false, false, 'standard'),
  ('Growth', 2800, 3000, true, true, true, false, true, 'priority'),
  ('Pro', 5500, 10000, true, true, true, true, true, 'premium')
ON CONFLICT (name) DO UPDATE SET
  monthly_price = EXCLUDED.monthly_price,
  message_limit = EXCLUDED.message_limit,
  ai_enabled = EXCLUDED.ai_enabled,
  automation_enabled = EXCLUDED.automation_enabled,
  sla_monitoring_enabled = EXCLUDED.sla_monitoring_enabled,
  catalog_enabled = EXCLUDED.catalog_enabled,
  multi_user_enabled = EXCLUDED.multi_user_enabled,
  support_level = EXCLUDED.support_level;

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.orgs(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active','trial','canceled','past_due')),
  billing_cycle_start timestamptz NOT NULL DEFAULT now(),
  billing_cycle_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  messages_used int NOT NULL DEFAULT 0,
  trial_ends_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON public.org_subscriptions(org_id, status);

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_subscriptions' AND policyname = 'Org members read org_subscriptions'
  ) THEN
    CREATE POLICY "Org members read org_subscriptions"
    ON public.org_subscriptions FOR SELECT
    USING (org_id = get_active_org_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_subscriptions' AND policyname = 'Service role full org_subscriptions'
  ) THEN
    CREATE POLICY "Service role full org_subscriptions"
    ON public.org_subscriptions FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_org_subscriptions_updated_at ON public.org_subscriptions;
CREATE TRIGGER update_org_subscriptions_updated_at
BEFORE UPDATE ON public.org_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.org_subscriptions (org_id, plan_id, status, billing_cycle_start, billing_cycle_end, messages_used, trial_ends_at)
SELECT
  o.id,
  p.id,
  'trial',
  now(),
  now() + interval '1 month',
  0,
  now() + interval '14 day'
FROM public.orgs o
CROSS JOIN LATERAL (
  SELECT id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1
) p
WHERE NOT EXISTS (
  SELECT 1 FROM public.org_subscriptions os WHERE os.org_id = o.id
);

CREATE TABLE IF NOT EXISTS public.org_message_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  message_id uuid NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_message_usage_ledger_org ON public.org_message_usage_ledger(org_id, created_at DESC);

ALTER TABLE public.org_message_usage_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_message_usage_ledger' AND policyname = 'Service role full org_message_usage_ledger'
  ) THEN
    CREATE POLICY "Service role full org_message_usage_ledger"
    ON public.org_message_usage_ledger FOR ALL
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.increment_org_messages_used(
  p_org_id uuid,
  p_message_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count int := 1;
BEGIN
  IF p_message_id IS NOT NULL THEN
    INSERT INTO public.org_message_usage_ledger (org_id, message_id)
    VALUES (p_org_id, p_message_id)
    ON CONFLICT (message_id) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    IF inserted_count = 0 THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.org_subscriptions os
  SET messages_used = os.messages_used + 1,
      updated_at = now()
  WHERE os.org_id = p_org_id
    AND os.status IN ('active', 'trial');

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_outbound_message_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'outbound'
     AND NEW.send_status = 'sent'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.send_status, '') <> 'sent') THEN
    PERFORM public.increment_org_messages_used(NEW.org_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_outbound_usage_insert ON public.messages;
CREATE TRIGGER trg_messages_outbound_usage_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_outbound_message_usage();

DROP TRIGGER IF EXISTS trg_messages_outbound_usage_update ON public.messages;
CREATE TRIGGER trg_messages_outbound_usage_update
AFTER UPDATE OF send_status ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_outbound_message_usage();

CREATE OR REPLACE FUNCTION public.reset_subscription_message_usage()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows int := 0;
BEGIN
  UPDATE public.org_subscriptions
  SET messages_used = 0,
      billing_cycle_start = billing_cycle_end,
      billing_cycle_end = billing_cycle_end + interval '1 month',
      updated_at = now()
  WHERE billing_cycle_end <= now()
    AND status IN ('active', 'trial');

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows;
END;
$$;
