-- Align commercial defaults to USD pricing and 7-day trials

UPDATE public.subscription_plans
SET monthly_price = CASE lower(name)
  WHEN 'free' THEN 0
  WHEN 'starter' THEN 20
  WHEN 'growth' THEN 50
  WHEN 'pro' THEN 100
  ELSE monthly_price
END
WHERE lower(name) IN ('free', 'starter', 'growth', 'pro');

-- For currently active trials with a future trial end, cap remaining time to 7 days from now.
UPDATE public.org_subscriptions
SET trial_ends_at = LEAST(
  COALESCE(trial_ends_at, now() + interval '7 day'),
  now() + interval '7 day'
),
updated_at = now()
WHERE status = 'trial'
  AND (trial_ends_at IS NULL OR trial_ends_at > now());
