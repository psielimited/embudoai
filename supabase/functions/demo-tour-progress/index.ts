import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Action = "get_progress" | "complete_step" | "reset_progress";

const ALLOWED_STEPS = new Set([
  "dashboard",
  "conversations",
  "pipeline",
  "merchant_settings",
  "reports",
]);

const DEMO_ORG_NAME_PATTERN = /demo/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = (body?.action as Action | undefined) ?? "get_progress";
    if (!["get_progress", "complete_step", "reset_progress"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    const { data: profile } = await service
      .from("profiles")
      .select("active_org_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const orgId = profile?.active_org_id ?? null;
    if (!orgId) return json({ error: "No active organization" }, 400);

    const { data: orgRow } = await service
      .from("orgs")
      .select("id,name")
      .eq("id", orgId)
      .maybeSingle();
    const orgName = orgRow?.name ?? "";
    if (!DEMO_ORG_NAME_PATTERN.test(orgName)) {
      return json({ error: "Demo tour is available for demo organizations only" }, 403);
    }

    const { data: currentRow } = await service
      .from("demo_tour_progress")
      .select("id,completed_steps,last_completed_step,completed_at")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    const currentSteps = Array.isArray(currentRow?.completed_steps)
      ? (currentRow?.completed_steps as string[])
      : [];

    if (action === "get_progress") {
      return json({
        ok: true,
        action,
        org_id: orgId,
        org_name: orgName,
        completed_steps: currentSteps,
        last_completed_step: currentRow?.last_completed_step ?? null,
        completed_at: currentRow?.completed_at ?? null,
      });
    }

    if (action === "reset_progress") {
      await service
        .from("demo_tour_progress")
        .upsert(
          {
            org_id: orgId,
            user_id: user.id,
            completed_steps: [],
            last_completed_step: null,
            completed_at: null,
          },
          { onConflict: "org_id,user_id" },
        );

      return json({
        ok: true,
        action,
        org_id: orgId,
        org_name: orgName,
        completed_steps: [],
      });
    }

    const step = (body?.step as string | undefined)?.trim();
    if (!step || !ALLOWED_STEPS.has(step)) {
      return json({ error: "Invalid step" }, 400);
    }

    const nextSteps = Array.from(new Set([...currentSteps, step]));
    const allComplete = nextSteps.length >= ALLOWED_STEPS.size;

    await service
      .from("demo_tour_progress")
      .upsert(
        {
          org_id: orgId,
          user_id: user.id,
          completed_steps: nextSteps,
          last_completed_step: step,
          completed_at: allComplete ? new Date().toISOString() : null,
        },
        { onConflict: "org_id,user_id" },
      );

    return json({
      ok: true,
      action,
      org_id: orgId,
      org_name: orgName,
      completed_steps: nextSteps,
      last_completed_step: step,
      completed_at: allComplete ? new Date().toISOString() : null,
      all_complete: allComplete,
    });
  } catch (error) {
    console.error("demo-tour-progress error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

