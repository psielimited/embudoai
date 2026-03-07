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

const DEMO_ORG_NAME_PATTERN = /demo/i;

async function callDevValidationSeed(
  supabaseUrl: string,
  supabaseAnonKey: string,
  cronSecret: string,
  orgId: string,
  action: "seed" | "cleanup",
) {
  const res = await fetch(`${supabaseUrl}/functions/v1/dev-validation-seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "x-demo-cron-secret": cronSecret,
    },
    body: JSON.stringify({ action, org_id: orgId }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error ?? `dev-validation-seed ${action} failed (${res.status})`);
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronSecret = Deno.env.get("DEMO_RESET_CRON_SECRET") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey || !cronSecret) {
      return json({ error: "Server misconfigured" }, 500);
    }
    if (bearer !== cronSecret && bearer !== serviceKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const service = createClient(supabaseUrl, serviceKey);
    const { data: demoOrgs, error: orgErr } = await service
      .from("orgs")
      .select("id,name");
    if (orgErr) return json({ error: "Failed to load orgs" }, 500);

    const targets = (demoOrgs ?? []).filter((org) => DEMO_ORG_NAME_PATTERN.test(org.name ?? ""));
    const results: Array<{ org_id: string; org_name: string; ok: boolean; error?: string }> = [];

    for (const org of targets) {
      try {
        await callDevValidationSeed(supabaseUrl, supabaseAnonKey, cronSecret, org.id, "cleanup");
        await callDevValidationSeed(supabaseUrl, supabaseAnonKey, cronSecret, org.id, "seed");
        results.push({ org_id: org.id, org_name: org.name ?? "", ok: true });
      } catch (error) {
        results.push({
          org_id: org.id,
          org_name: org.name ?? "",
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    return json({
      ok: true,
      processed: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results,
      reset_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("demo-nightly-reset error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

