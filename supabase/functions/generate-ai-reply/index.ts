/**
 * Compatibility shim: generate-ai-reply now delegates to ai-sales-agent.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Server misconfigured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const payload = await req.json();
    if (!payload?.conversation_id || typeof payload.conversation_id !== "string") {
      return json({ error: "conversation_id is required" }, 400);
    }

    const [{ data: profile }, { data: conversation }] = await Promise.all([
      serviceClient
        .from("profiles")
        .select("active_org_id")
        .eq("user_id", userId)
        .maybeSingle(),
      serviceClient
        .from("conversations")
        .select("id,org_id")
        .eq("id", payload.conversation_id)
        .maybeSingle(),
    ]);

    if (!conversation) return json({ error: "Conversation not found" }, 404);
    if (!profile?.active_org_id || profile.active_org_id !== conversation.org_id) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: membership } = await serviceClient
      .from("org_members")
      .select("user_id")
      .eq("org_id", conversation.org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    const res = await fetch(`${supabaseUrl}/functions/v1/ai-sales-agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 204) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
