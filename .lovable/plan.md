

## Add Google Sign-In to Signup Page

### Problem
The Signup page only offers email/password registration. Users arriving from the pricing flow have no way to sign up with Google, even though the OAuth flow naturally handles account creation.

### What Changes

**File: `src/pages/Signup.tsx`**
- Import the `lovable` auth module and necessary UI components (Separator)
- Add a "Continue with Google" button above the email form (matching the Login page pattern)
- Include a visual divider ("Or continue with email") between the Google button and the form
- Pass the selected `plan` parameter through Google OAuth so it's preserved after redirect:
  - Set `redirect_uri` to `/auth/callback?plan={planParam}` so the plan is captured post-OAuth
  - Store the plan in `localStorage` before initiating OAuth (same as the email flow)

### Technical Details
- Reuses the same `lovable.auth.signInWithOAuth("google", ...)` pattern from Login.tsx
- The `AuthCallback` page already reads the `plan` query param and stores it in localStorage, so plan selection is preserved through the OAuth redirect
- No backend or database changes needed — OAuth signup creates the user automatically
