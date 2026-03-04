
-- Step 1: Revoke all current grants on merchants for authenticated role
REVOKE ALL ON public.merchants FROM authenticated;

-- Step 2: Grant SELECT only on non-sensitive columns
GRANT SELECT (id, org_id, name, status, created_at, whatsapp_phone_number_id) ON public.merchants TO authenticated;

-- Step 3: Restore INSERT, UPDATE, DELETE (RLS policies still apply)
GRANT INSERT, UPDATE, DELETE ON public.merchants TO authenticated;

-- Step 4: Ensure anon role also cannot read sensitive columns
REVOKE ALL ON public.merchants FROM anon;
GRANT SELECT (id, org_id, name, status, created_at, whatsapp_phone_number_id) ON public.merchants TO anon;
