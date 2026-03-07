

## Current State

- The nightly cron job for `nightly-analytics-rollup` already exists (job #2, schedule `30 2 * * *` — 2:30 AM daily). It calls the edge function with the anon key.
- The `nightly-analytics-rollup` function already has code to check `DEMO_NIGHTLY_RESET` env var and chain-call `demo-nightly-reset` when true.
- The `demo-nightly-reset` function validates requests using `DEMO_RESET_CRON_SECRET`.
- Neither `DEMO_RESET_CRON_SECRET` nor `DEMO_NIGHTLY_RESET` are currently set as secrets.

## Plan

### 1. Add two secrets

Use the secrets tool to add:
- **`DEMO_RESET_CRON_SECRET`** — a strong secret string (user provides or we generate one). Used by `demo-nightly-reset` to authenticate system-level calls.
- **`DEMO_NIGHTLY_RESET`** — value `true`. Read by `nightly-analytics-rollup` to decide whether to chain the demo reset.

### 2. No code or cron changes needed

- The cron job already invokes `nightly-analytics-rollup` nightly at 2:30 AM.
- The function already reads `DEMO_NIGHTLY_RESET` and calls `demo-nightly-reset` with `DEMO_RESET_CRON_SECRET` as the bearer token.
- No edge function code changes required.

### 3. Redeploy affected functions

Redeploy `nightly-analytics-rollup` and `demo-nightly-reset` to ensure they pick up the new secrets at runtime. (Edge functions read secrets via `Deno.env.get()` at invocation time, so redeployment may not be strictly necessary, but is good practice.)

