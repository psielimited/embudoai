

# Deploy AI Sales Agent Migration and Edge Functions

## 1. Database Migration

Run the migration file `supabase/migrations/20260220100000_ai_sales_agent.sql` using the database migration tool. This will apply any schema changes required for the AI sales agent feature.

## 2. Deploy Edge Functions

Deploy the following three edge functions with their latest code:

- **ai-sales-agent** -- the core autonomous AI sales agent
- **generate-ai-reply** -- compatibility shim that delegates to ai-sales-agent
- **ingest-message** -- message ingestion with identity resolution and AI trigger

## 3. Verify config.toml

Confirm that `supabase/config.toml` has the correct `verify_jwt = false` entries for all three functions (already present based on current file).

## Execution Order

1. Apply the database migration first (schema must exist before functions reference it)
2. Deploy all three edge functions in parallel
3. Verify deployment by checking edge function logs

## Technical Details

- The migration file path: `supabase/migrations/20260220100000_ai_sales_agent.sql`
- Edge function paths:
  - `supabase/functions/ai-sales-agent/index.ts`
  - `supabase/functions/generate-ai-reply/index.ts`
  - `supabase/functions/ingest-message/index.ts`

