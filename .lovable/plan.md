

# Fix Onboarding-to-Merchant-Settings Infinite Loop (Revised)

## Problem
After completing the onboarding form, the app enters an infinite redirect loop between `/onboarding` and `/merchants/{id}/settings` because `SubscriptionGuard` reads stale cached data.

## Key Insight
The route wrapper (`ProtectedOnboarding` vs `ProtectedDashboard`) is NOT the cause. The loop is caused by stale React Query cache. The `/merchants/:merchantId/settings` route should stay wrapped in `ProtectedOnboarding` to keep the sidebar hidden until setup is done.

## Solution

### Only file changed: `src/pages/Onboarding.tsx`

1. **Invalidate stale queries after provisioning** -- Before navigating to merchant settings, remove the cached query keys that `SubscriptionGuard` depends on:
   - `onboarding-merchant-count`
   - `merchant-onboarding-guard`
   - `active-org`

2. **Await fresh data before navigating** -- After invalidation, refetch the critical queries and only call `navigate()` once the data confirms the merchant exists. This prevents the guard from seeing stale `merchantCount=0` and bouncing back to `/onboarding`.

3. **Show a transitional loading step** -- Add a final provisioning step ("Preparing your workspace...") in the progress modal so the user sees smooth progress rather than a flash of redirects.

### No changes to `src/App.tsx`
The `/merchants/:merchantId/settings` route stays wrapped in `ProtectedOnboarding` -- no sidebar access until merchant setup is complete.

### No changes to `SubscriptionGuard.tsx`
The fix is upstream in the onboarding page's navigation logic.

## Expected Behavior After Fix
1. User fills out onboarding form and submits
2. Progress modal shows provisioning steps
3. After success, queries are invalidated and refetched
4. Final step "Preparing your workspace..." displays briefly
5. Navigation to `/merchants/{id}/settings` occurs only after cache is fresh
6. No redirect loop -- merchant settings page renders without sidebar

