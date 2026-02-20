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

function randomState() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const merchantId = body?.merchant_id as string | undefined;
    const redirectUri = body?.redirect_uri as string | undefined;
    if (!merchantId || !redirectUri) return json({ error: "merchant_id and redirect_uri are required" }, 400);

    const service = createClient(supabaseUrl, serviceKey);
    const { data: merchant } = await service
      .from("merchants")
      .select("id,org_id")
      .eq("id", merchantId)
      .maybeSingle();
    if (!merchant) return json({ error: "Merchant not found" }, 404);

    const { data: member } = await service
      .from("org_members")
      .select("user_id")
      .eq("org_id", merchant.org_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return json({ error: "Not authorized for this organization" }, 403);

    const state = randomState();
    const { error: insertErr } = await service.from("meta_signup_nonces").insert({
      org_id: merchant.org_id,
      merchant_id: merchantId,
      user_id: user.id,
      state,
      redirect_uri: redirectUri,
    });
    if (insertErr) return json({ error: "Failed to initialize embedded signup state" }, 500);

    return json({ ok: true, state });
  } catch (error) {
    console.error("meta-embedded-signup-init error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
