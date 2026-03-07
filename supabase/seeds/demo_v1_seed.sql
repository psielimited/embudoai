-- Embudex Demo V1 Seed Skeleton
-- Purpose:
--   1) create/refresh a deterministic demo org baseline
--   2) support repeatable sales demos with resettable data
--
-- Notes:
--   - This is a scaffold script. The production reset flow is currently implemented via
--     the `demo-reset` edge function, which delegates to `dev-validation-seed`.
--   - Keep all generated names prefixed with "DEMO" for safe targeting.

DO $$
DECLARE
  v_demo_org_name text := 'Embudex Demo Org';
  v_demo_merchant_primary text := 'DEMO Northstar Dental';
  v_demo_merchant_secondary text := 'DEMO Apex Home Services';
BEGIN
  RAISE NOTICE 'Demo V1 seed scaffold loaded for org: %', v_demo_org_name;
  RAISE NOTICE 'Primary merchant target: %', v_demo_merchant_primary;
  RAISE NOTICE 'Secondary merchant target: %', v_demo_merchant_secondary;

  -- TODO(v1):
  -- 1) Ensure demo org and org_settings baseline.
  -- 2) Ensure two merchants and merchant_settings health snapshot.
  -- 3) Seed deterministic leads/contacts/channels.
  -- 4) Seed 25-40 conversations with mixed statuses.
  -- 5) Seed 6-10 opportunities distributed across pipeline stages.
  -- 6) Seed tasks, activities, and one handoff scenario.
  -- 7) Tag seeded rows for selective cleanup where possible.
END $$;

