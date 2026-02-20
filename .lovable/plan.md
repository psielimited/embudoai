
# Deploy Edge Functions, Fix Build Errors, and Configure Secrets

## 1. Fix Build Errors

### `supabase/functions/ai-sales-agent/index.ts` (line 154)
- Add explicit type annotation to the `.find()` callback parameter `s` to fix `TS7006`:
  ```typescript
  const match = (stages ?? []).find((s: any) =>
  ```

### `src/pages/MerchantSettings.tsx` -- three missing references

**Missing imports (add to top of file):**
- `callEdge` from `@/lib/edge`
- `useQueryClient` from `@tanstack/react-query`

**Missing state variable:**
- Add `const [appSecret, setAppSecret] = useState("");` alongside the other credential state variables (after line 97)

**Missing queryClient instance:**
- Add `const queryClient = useQueryClient();` inside the component body (after line 93)

**Credential initializer:**
- In the `useEffect` that populates credential fields (line 102-108), also set `appSecret` from `credentials.whatsapp_app_secret`

## 2. Deploy Edge Functions

After fixing the build errors, deploy the following three functions:
- `meta-embedded-signup-init`
- `meta-embedded-signup-exchange`
- `merchant-onboarding-check`

## 3. Set Secrets

The project needs these secrets added. Some are public values, others need user input:

| Secret | Value | Action |
|--------|-------|--------|
| `META_APP_ID` | `1622842462247348` | Set directly (public) |
| `META_GRAPH_VERSION` | `v24.0` | Set directly (public config) |
| `META_REDIRECT_URI` | `https://embudex.com/auth/meta/callback` | Set directly (public config) |
| `META_APP_SECRET` | User must provide | Prompt user to enter |
| `META_WEBHOOK_VERIFY_TOKEN` | User must provide | Prompt user to enter |

## 4. Frontend Environment Variable

Set `VITE_META_REDIRECT_URI=https://embudex.com/auth/meta/callback` in the `.env` file -- however since `.env` is auto-managed, this will need to be added via the Lovable Cloud secrets/env configuration. Alternatively, the existing `getMetaRedirectUri()` fallback in `src/lib/meta/constants.ts` already constructs this from `window.location.origin`, so if the production domain is `embudex.com`, it will resolve correctly without an explicit env var.

## 5. Database Prerequisite

The `meta_signup_nonces` table must exist (referenced by the edge functions). If it doesn't already exist, a migration will be needed to create it with columns: `id`, `org_id`, `merchant_id`, `user_id`, `state`, `redirect_uri`, `expires_at`, `consumed_at`.

## Execution Order
1. Fix build errors in both files (parallel edits)
2. Verify `meta_signup_nonces` table exists; create migration if needed
3. Deploy the three edge functions
4. Set public secrets (`META_APP_ID`, `META_GRAPH_VERSION`, `META_REDIRECT_URI`)
5. Prompt user for `META_APP_SECRET` and `META_WEBHOOK_VERIFY_TOKEN`
