/**
 * Edge Function: manage-merchant-credentials
 *
 * Endpoint for reading and updating WhatsApp API credentials on merchants.
 * Access rules:
 * - org_admin can always read/update
 * - during onboarding (wizard not complete), any org member can read/update
 *
 * GET-like (action: "read"):  Returns masked credentials for the merchant
 * POST-like (action: "update"): Updates credentials
 */

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Not authenticated" }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Not authenticated" }, 401);
    }

    const body = await req.json();
    const merchantId = body?.merchant_id as string | undefined;
    const action = body?.action as "read" | "update" | undefined;

    if (!merchantId || !action) {
      return json({ error: "merchant_id and action are required" }, 400);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get merchant to verify org
    const { data: merchant, error: merchantError } = await serviceClient
      .from("merchants")
      .select("id, org_id")
      .eq("id", merchantId)
      .single();

    if (merchantError || !merchant) {
      return json({ error: "Merchant not found" }, 404);
    }

    // Verify caller has org membership
    const { data: membership } = await serviceClient
      .from("org_members")
      .select("role")
      .eq("org_id", merchant.org_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return json({ error: "Not authorized for this organization" }, 403);
    }

    let canManageCredentials = membership.role === "org_admin";
    if (!canManageCredentials) {
      const { data: settings } = await serviceClient
        .from("merchant_settings")
        .select("onboarding_step,credentials_valid,webhook_challenge_valid,connectivity_outbound_ok,connectivity_inbound_ok,outbound_status,inbound_status,whatsapp_is_sandbox,phone_registration_status")
        .eq("merchant_id", merchant.id)
        .eq("org_id", merchant.org_id)
        .maybeSingle();

      const outboundReady = settings?.connectivity_outbound_ok || settings?.outbound_status === "blocked_sandbox";
      const inboundReady = settings?.connectivity_inbound_ok || settings?.inbound_status === "blocked_sandbox";
      const registrationReady = settings?.whatsapp_is_sandbox || settings?.phone_registration_status === "registered";
      const onboardingComplete = Boolean(
        settings
          && settings.onboarding_step >= 3
          && settings.credentials_valid
          && settings.webhook_challenge_valid
          && outboundReady
          && inboundReady
          && registrationReady,
      );

      canManageCredentials = !onboardingComplete;
    }

    if (!canManageCredentials) {
      return json({ error: "Only organization administrators can manage credentials after onboarding is complete" }, 403);
    }

    if (action === "read") {
      const { data, error } = await serviceClient
        .from("merchants")
        .select("whatsapp_phone_number_id, whatsapp_verify_token, whatsapp_app_secret, whatsapp_access_token")
        .eq("id", merchantId)
        .single();

      if (error) {
        return json({ error: "Failed to read credentials" }, 500);
      }

      return json({ ok: true, credentials: data });
    }

    if (action === "update") {
      const credentials = body?.credentials as Record<string, string | null> | undefined;
      if (!credentials) {
        return json({ error: "credentials object is required" }, 400);
      }

      // Only allow specific credential fields
      const allowedFields = [
        "whatsapp_phone_number_id",
        "whatsapp_verify_token",
        "whatsapp_app_secret",
        "whatsapp_access_token",
      ];

      const updates: Record<string, string | null> = {};
      for (const key of allowedFields) {
        if (key in credentials) {
          const val = credentials[key];
          updates[key] = typeof val === "string" && val.trim() !== "" ? val.trim() : null;
        }
      }

      if (Object.keys(updates).length === 0) {
        return json({ error: "No valid credential fields provided" }, 400);
      }

      const { error } = await serviceClient
        .from("merchants")
        .update(updates)
        .eq("id", merchantId);

      if (error) {
        console.error("Credential update error:", error);
        return json({ error: "Failed to update credentials" }, 500);
      }

      return json({ ok: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("manage-merchant-credentials error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
