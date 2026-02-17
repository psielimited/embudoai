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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const orgName = String(body?.org_name ?? "").trim();
    const merchantName = String(body?.merchant_name ?? "").trim();
    const country = String(body?.country ?? "").trim();
    const timezone = String(body?.timezone ?? "UTC").trim();
    const planInputRaw = String(body?.plan ?? "free").trim();
    const planInput = planInputRaw.toLowerCase();

    if (!orgName || !merchantName || !country) {
      return json({ error: "org_name, merchant_name and country are required" }, 400);
    }

    const { data: existingMembership } = await serviceClient
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (existingMembership?.org_id) {
      const existingOrgId = existingMembership.org_id;
      await serviceClient.from("profiles").update({ active_org_id: existingOrgId }).eq("user_id", userId);

      const { data: existingMerchant } = await serviceClient
        .from("merchants")
        .select("id")
        .eq("org_id", existingOrgId)
        .limit(1)
        .maybeSingle();

      if (!existingMerchant) {
        const { data: createdMerchant, error: createMerchantError } = await serviceClient
          .from("merchants")
          .insert({ org_id: existingOrgId, name: merchantName, status: "active" })
          .select("id")
          .single();
        if (createMerchantError) return json({ error: createMerchantError.message }, 500);

        await serviceClient.from("merchant_settings").upsert(
          { org_id: existingOrgId, merchant_id: createdMerchant.id, onboarding_step: 3 },
          { onConflict: "merchant_id" },
        );
      }

      await serviceClient.from("org_settings").upsert(
        { org_id: existingOrgId, timezone },
        { onConflict: "org_id" },
      );

      return json({ ok: true, existing: true, org_id: existingOrgId });
    }

    let planQuery = serviceClient.from("subscription_plans").select("id,name").limit(1);
    if (isUuid(planInputRaw)) {
      planQuery = planQuery.eq("id", planInputRaw);
    } else {
      planQuery = planQuery.ilike("name", `${planInput}%`);
    }
    const { data: plan, error: planError } = await planQuery.maybeSingle();
    if (planError || !plan) return json({ error: "Selected plan not found" }, 400);

    const { data: org, error: orgError } = await serviceClient
      .from("orgs")
      .insert({ name: orgName })
      .select("id")
      .single();
    if (orgError || !org) return json({ error: orgError?.message ?? "Failed to create org" }, 500);
    const orgId = org.id;

    const { error: memberError } = await serviceClient
      .from("org_members")
      .insert({ org_id: orgId, user_id: userId, role: "org_admin" });
    if (memberError) return json({ error: memberError.message }, 500);

    await serviceClient.from("profiles").update({ active_org_id: orgId }).eq("user_id", userId);

    const { data: merchant, error: merchantError } = await serviceClient
      .from("merchants")
      .insert({ org_id: orgId, name: merchantName, status: "active" })
      .select("id")
      .single();
    if (merchantError || !merchant) return json({ error: merchantError?.message ?? "Failed to create merchant" }, 500);

    const now = new Date();
    const cycleEnd = new Date(now);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    const isFree = String(plan.name).toLowerCase().startsWith("free");
    const subscriptionStatus = isFree ? "active" : "trial";
    const trialEndsAt = isFree ? null : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: subscriptionError } = await serviceClient.from("org_subscriptions").insert({
      org_id: orgId,
      plan_id: plan.id,
      status: subscriptionStatus,
      billing_cycle_start: now.toISOString(),
      billing_cycle_end: cycleEnd.toISOString(),
      messages_used: 0,
      trial_ends_at: trialEndsAt,
    });
    if (subscriptionError) return json({ error: subscriptionError.message }, 500);

    const { error: orgSettingsError } = await serviceClient.from("org_settings").upsert(
      { org_id: orgId, timezone },
      { onConflict: "org_id" },
    );
    if (orgSettingsError) return json({ error: orgSettingsError.message }, 500);

    const { error: merchantSettingsError } = await serviceClient.from("merchant_settings").upsert(
      { org_id: orgId, merchant_id: merchant.id, onboarding_step: 3 },
      { onConflict: "merchant_id" },
    );
    if (merchantSettingsError) return json({ error: merchantSettingsError.message }, 500);

    return json({
      ok: true,
      org_id: orgId,
      merchant_id: merchant.id,
      plan_id: plan.id,
      status: subscriptionStatus,
      trial_ends_at: trialEndsAt,
    });
  } catch (error) {
    console.error("provision-org-and-merchant failed", error);
    return json({ error: "Internal error" }, 500);
  }
});
