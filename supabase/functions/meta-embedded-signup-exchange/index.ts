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

async function graphGet(version: string, path: string, accessToken: string) {
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function truncate(value: unknown, max = 500) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return raw.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAppId = Deno.env.get("META_APP_ID")!;
    const metaAppSecret = Deno.env.get("META_APP_SECRET")!;
    const graphVersion = Deno.env.get("META_GRAPH_VERSION") ?? "v24.0";
    const configuredRedirectUri = Deno.env.get("META_REDIRECT_URI")!;
    const defaultVerifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "embudex_meta_verify";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const merchantId = body?.merchant_id as string | undefined;
    const code = body?.code as string | undefined;
    const state = body?.state as string | undefined;
    const redirectUri = body?.redirect_uri as string | undefined;
    const hintedWabaId = body?.waba_id as string | undefined;
    const hintedPhoneId = body?.phone_number_id as string | undefined;

    if (!merchantId || !code || !state || !redirectUri) {
      return json({ error: "merchant_id, code, state, redirect_uri are required" }, 400);
    }

    if (redirectUri !== configuredRedirectUri) {
      console.error("redirect_uri mismatch before exchange", {
        merchant_id: merchantId,
        client_redirect_uri: redirectUri,
        server_redirect_uri: configuredRedirectUri,
      });
      return json({
        error: "Redirect URI mismatch",
        details: "The redirect_uri sent by client does not match META_REDIRECT_URI configured on server. They must be identical for code exchange.",
      }, 400);
    }

    const service = createClient(supabaseUrl, serviceKey);
    const { data: merchant } = await service
      .from("merchants")
      .select("id,org_id")
      .eq("id", merchantId)
      .maybeSingle();
    if (!merchant) return json({ error: "Merchant not found" }, 404);

    const { data: member } = await service
      .from("org_members")
      .select("role")
      .eq("org_id", merchant.org_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return json({ error: "Not authorized for this organization" }, 403);

    // Validate and consume nonce
    const { data: nonce } = await service
      .from("meta_signup_nonces")
      .select("id,expires_at,consumed_at,redirect_uri")
      .eq("state", state)
      .eq("merchant_id", merchantId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!nonce) return json({ error: "Invalid state. Please retry connection." }, 400);
    if (nonce.consumed_at) return json({ error: "State already consumed. Please retry connection." }, 400);
    if (new Date(nonce.expires_at).getTime() <= Date.now()) return json({ error: "State expired. Please retry connection." }, 400);
    if (nonce.redirect_uri !== redirectUri) {
      return json({ error: "State redirect mismatch. Please retry connection." }, 400);
    }

    const exchangeWithRedirect = async (candidateRedirectUri: string) => {
      const exchangeUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
      exchangeUrl.searchParams.set("client_id", metaAppId);
      exchangeUrl.searchParams.set("client_secret", metaAppSecret);
      exchangeUrl.searchParams.set("redirect_uri", candidateRedirectUri);
      exchangeUrl.searchParams.set("code", code);
      const res = await fetch(exchangeUrl.toString());
      const body = await res.json().catch(() => ({}));
      return { res, body, redirectUri: candidateRedirectUri };
    };

    console.log("meta exchange attempt", {
      merchant_id: merchantId,
      graph_version: graphVersion,
      redirect_uri: redirectUri,
      app_id_suffix: metaAppId.slice(-6),
      has_code: !!code,
      code_prefix: code.slice(0, 12),
      state_prefix: state.slice(0, 12),
    });

    const popupDefaultRedirect = "https://www.facebook.com/connect/login_success.html";
    const redirectCandidates = Array.from(new Set([redirectUri, popupDefaultRedirect]));
    let tokenAttempt: { res: Response; body: any; redirectUri: string } | null = null;
    const attemptErrors: Array<Record<string, unknown>> = [];

    for (const candidate of redirectCandidates) {
      const attempt = await exchangeWithRedirect(candidate);
      if (attempt.res.ok && attempt.body?.access_token) {
        tokenAttempt = attempt;
        break;
      }
      const err = attempt.body?.error ?? attempt.body;
      attemptErrors.push({
        redirect_uri: candidate,
        status: attempt.res.status,
        error: err,
      });
      console.warn("meta exchange candidate failed", {
        merchant_id: merchantId,
        redirect_uri: candidate,
        status: attempt.res.status,
        graph_error: err,
      });
    }

    if (!tokenAttempt) {
      const lastAttempt = attemptErrors[attemptErrors.length - 1] ?? {};
      const message = JSON.stringify((lastAttempt as any)?.error ?? lastAttempt);
      console.error("meta exchange failed", {
        merchant_id: merchantId,
        configured_redirect_uri: configuredRedirectUri,
        attempts: attemptErrors,
      });
      const maybeRedirectMismatch = message.includes("redirect_uri");
      return json({
        error: "Failed to exchange authorization code",
        details: maybeRedirectMismatch
          ? "Error validating verification code. Ensure redirect_uri in client and server exactly matches Meta Login configuration."
          : truncate((lastAttempt as any)?.error ?? lastAttempt),
      }, 400);
    }

    const accessToken = tokenAttempt.body.access_token as string;
    console.log("meta exchange succeeded", {
      merchant_id: merchantId,
      expires_in: tokenAttempt.body?.expires_in ?? null,
      token_last4: accessToken.slice(-4),
      exchange_redirect_uri: tokenAttempt.redirectUri,
    });

    // Try to discover WABA + phone ids; accept frontend hints if discovery fails.
    let resolvedWabaId: string | null = hintedWabaId ?? null;
    let resolvedPhoneId: string | null = hintedPhoneId ?? null;
    let discoveryPayload: Record<string, unknown> = {};

    if (!resolvedPhoneId) {
      const meBusinesses = await graphGet(
        graphVersion,
        "me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&limit=25",
        accessToken,
      );
      discoveryPayload.me_businesses = meBusinesses.body;

      const businessList = Array.isArray((meBusinesses.body as any)?.data) ? (meBusinesses.body as any).data : [];
      for (const biz of businessList) {
        const wabas = Array.isArray(biz?.owned_whatsapp_business_accounts?.data)
          ? biz.owned_whatsapp_business_accounts.data
          : [];
        for (const waba of wabas) {
          if (!resolvedWabaId && waba?.id) resolvedWabaId = waba.id;
          const phones = Array.isArray(waba?.phone_numbers?.data) ? waba.phone_numbers.data : [];
          if (!resolvedPhoneId && phones[0]?.id) resolvedPhoneId = phones[0].id;
          if (resolvedWabaId && resolvedPhoneId) break;
        }
        if (resolvedWabaId && resolvedPhoneId) break;
      }
    }

    if (!resolvedWabaId && resolvedPhoneId) {
      const phoneLookup = await graphGet(graphVersion, `${resolvedPhoneId}?fields=id,verified_name,display_phone_number,whatsapp_business_account`, accessToken);
      discoveryPayload.phone_lookup = phoneLookup.body;
      resolvedWabaId = (phoneLookup.body as any)?.whatsapp_business_account?.id ?? null;
    }

    if (!resolvedPhoneId || !resolvedWabaId) {
      console.error("meta asset resolution failed", {
        merchant_id: merchantId,
        resolved_waba_id: resolvedWabaId,
        resolved_phone_id: resolvedPhoneId,
        hint_waba_id: hintedWabaId ?? null,
        hint_phone_id: hintedPhoneId ?? null,
      });
      await service
        .from("merchant_settings")
        .upsert({
          org_id: merchant.org_id,
          merchant_id: merchant.id,
          embedded_signup_status: "failed",
          embedded_signup_error: "Could not resolve WhatsApp business assets from embedded signup response",
          embedded_signup_payload: discoveryPayload,
        }, { onConflict: "merchant_id" });
      return json({
        ok: false,
        error: "Could not resolve WhatsApp assets",
        details: "Embedded signup completed but WABA/Phone Number IDs were not returned. Retry and ensure WhatsApp assets are selected.",
      }, 400);
    }

    const tokenLast4 = accessToken.slice(-4);
    const now = new Date().toISOString();

    const merchantUpdate = await service
      .from("merchants")
      .update({
        whatsapp_access_token: accessToken,
        whatsapp_phone_number_id: resolvedPhoneId,
        whatsapp_verify_token: defaultVerifyToken,
      })
      .eq("id", merchant.id);
    if (merchantUpdate.error) {
      console.error("failed to persist merchant embedded credentials", {
        merchant_id: merchant.id,
        error: merchantUpdate.error,
      });
      return json({ error: "Failed to persist merchant credentials" }, 500);
    }

    await service
      .from("merchant_settings")
      .upsert({
        org_id: merchant.org_id,
        merchant_id: merchant.id,
        meta_waba_id: resolvedWabaId,
        meta_phone_number_id: resolvedPhoneId,
        meta_access_token_last4: tokenLast4,
        meta_token_updated_at: now,
        embedded_signup_status: "connected",
        embedded_signup_error: null,
        embedded_signup_payload: {
          graph_version: graphVersion,
          discovery: discoveryPayload,
        },
      }, { onConflict: "merchant_id" });

    console.log("embedded signup persistence complete", {
      merchant_id: merchant.id,
      waba_id: resolvedWabaId,
      phone_number_id: resolvedPhoneId,
      token_last4: tokenLast4,
    });

    await service
      .from("meta_signup_nonces")
      .update({ consumed_at: now })
      .eq("id", nonce.id);

    const checks: Record<string, string> = {
      validate_credentials: "fail",
      connectivity_test_outbound: "fail",
      check_inbound_marker: "fail",
    };

    const runCheck = async (action: string, payload: Record<string, unknown> = {}) => {
      const resp = await fetch(`${supabaseUrl}/functions/v1/merchant-onboarding-check`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          merchant_id: merchant.id,
          action,
          ...payload,
        }),
      });
      const bodyJson = await resp.json().catch(() => ({}));
      checks[action] = resp.ok && bodyJson?.ok ? "pass" : "fail";
      return bodyJson;
    };

    await runCheck("validate_credentials");
    // outbound check requires a test number; keep as soft-fail until user provides it.
    checks.connectivity_test_outbound = "fail";
    await runCheck("check_inbound_marker");

    return json({
      ok: true,
      merchant_id: merchant.id,
      waba_id: resolvedWabaId,
      phone_number_id: resolvedPhoneId,
      status: checks,
    });
  } catch (error) {
    console.error("meta-embedded-signup-exchange error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
