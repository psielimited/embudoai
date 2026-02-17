/**
 * Edge Function: automation-worker
 *
 * Scheduled worker scaffold for automation enrollments.
 * Enforces plan gating before any automation processing.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const result = { ok: true, processed_orgs: 0, skipped_orgs: 0, processed_rules: 0 };

  try {
    const { data: orgs } = await client.from("orgs").select("id");
    for (const org of orgs ?? []) {
      const { data: subscription } = await client
        .from("org_subscriptions")
        .select("status, trial_ends_at, subscription_plans(automation_enabled)")
        .eq("org_id", org.id)
        .maybeSingle();

      const trialExpired = subscription?.status === "trial"
        && !!subscription?.trial_ends_at
        && new Date(subscription.trial_ends_at).getTime() <= Date.now();
      const plans = subscription?.subscription_plans;
      const plan = Array.isArray(plans) ? plans[0] : plans;
      const enabledByPlan = plan?.automation_enabled ?? false;
      const activeState = ["active", "trial"].includes(subscription?.status ?? "trial") && !trialExpired;

      if (!enabledByPlan || !activeState) {
        result.skipped_orgs += 1;
        continue;
      }

      result.processed_orgs += 1;

      // Placeholder: automation enrollments currently execute inline during stage transitions.
      // Worker remains in place for future queued automation processing.
      const { count } = await client
        .from("automation_rules")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id)
        .eq("is_active", true);

      result.processed_rules += count ?? 0;
    }

    return json(result, 200);
  } catch (error) {
    console.error("automation-worker error", error);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
