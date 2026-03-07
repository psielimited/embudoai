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

type Action = "preview" | "seed" | "cleanup" | "reset";

const DEMO_ORG_NAME_PATTERN = /demo/i;

async function invokeDevValidationSeed(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string,
  action: "seed" | "cleanup",
) {
  const res = await fetch(`${supabaseUrl}/functions/v1/dev-validation-seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
      "apikey": supabaseAnonKey,
    },
    body: JSON.stringify({ action }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `dev-validation-seed ${action} failed: ${payload?.error ?? `status ${res.status}`}`,
    );
  }
  return payload;
}

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
    const action = (body?.action as Action | undefined) ?? "preview";
    if (!["preview", "seed", "cleanup", "reset"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    const { data: profile } = await service
      .from("profiles")
      .select("active_org_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    const orgId = profile?.active_org_id ?? null;
    if (!orgId) return json({ error: "No active organization" }, 400);

    const { data: membership } = await service
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = profile?.role === "admin" || membership?.role === "org_admin" || membership?.role === "admin";
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const { data: orgRow } = await service
      .from("orgs")
      .select("id,name")
      .eq("id", orgId)
      .maybeSingle();

    const orgName = orgRow?.name ?? "";
    if (!DEMO_ORG_NAME_PATTERN.test(orgName)) {
      return json({
        error: "This action is restricted to demo organizations only",
        org_id: orgId,
        org_name: orgName,
      }, 403);
    }

    if (action === "preview") {
      const countFor = async (table: string) => {
        const { count, error } = await service
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);
        if (error) return null;
        return count ?? 0;
      };

      const [merchantCount, conversationCount, messageCount, opportunityCount, taskCount] = await Promise.all([
        countFor("merchants"),
        countFor("conversations"),
        countFor("messages"),
        countFor("opportunities"),
        countFor("tasks"),
      ]);

      return json({
        ok: true,
        action,
        org_id: orgId,
        org_name: orgName,
        counts: {
          merchants: merchantCount,
          conversations: conversationCount,
          messages: messageCount,
          opportunities: opportunityCount,
          tasks: taskCount,
        },
      });
    }

    if (action === "seed") {
      const seeded = await invokeDevValidationSeed(supabaseUrl, supabaseAnonKey, authHeader, "seed");
      return json({ ok: true, action, org_id: orgId, org_name: orgName, seeded });
    }

    if (action === "cleanup") {
      const cleaned = await invokeDevValidationSeed(supabaseUrl, supabaseAnonKey, authHeader, "cleanup");
      return json({ ok: true, action, org_id: orgId, org_name: orgName, cleaned });
    }

    const cleaned = await invokeDevValidationSeed(supabaseUrl, supabaseAnonKey, authHeader, "cleanup");
    const seeded = await invokeDevValidationSeed(supabaseUrl, supabaseAnonKey, authHeader, "seed");
    return json({
      ok: true,
      action: "reset",
      org_id: orgId,
      org_name: orgName,
      cleaned,
      seeded,
    });
  } catch (error) {
    console.error("demo-reset error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

