import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  encodeSandboxErrorPayload,
  isSandboxBlockedGraphError,
  resolveOnboardingPhoneNumberId,
} from "./sandbox.ts";

const GRAPH_VERSION = "v24.0";
const REQUIRED_TOKEN_SCOPES = [
  "whatsapp_business_messaging",
  "whatsapp_business_management",
] as const;

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

async function graphGet(path: string, accessToken: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function graphPost(path: string, accessToken: string, payload: unknown) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function parseTemplateCounts(data: any[]) {
  const counts = { approved: 0, pending: 0, rejected: 0 };
  for (const item of data) {
    const status = String(item?.status ?? "").toUpperCase();
    if (status === "APPROVED") counts.approved += 1;
    else if (["PENDING", "IN_REVIEW", "PENDING_DELETION"].includes(status)) counts.pending += 1;
    else if (["REJECTED", "DISABLED", "PAUSED"].includes(status)) counts.rejected += 1;
  }
  return counts;
}

function graphError(payload: unknown, fallback = "Meta Graph request failed") {
  const raw = payload && typeof payload === "object"
    ? ((payload as Record<string, unknown>).error ?? payload)
    : payload;
  const msg = JSON.stringify(raw ?? fallback);
  return msg.slice(0, 500);
}

function readGraphError(payload: unknown) {
  const err = payload && typeof payload === "object"
    ? ((payload as Record<string, unknown>).error as Record<string, unknown> | undefined)
    : undefined;
  const code = typeof err?.code === "number" ? err.code : null;
  const subcode = typeof err?.error_subcode === "number" ? err.error_subcode : null;
  const title = typeof err?.error_user_title === "string" ? err.error_user_title : "";
  const message = typeof err?.error_user_msg === "string"
    ? err.error_user_msg
    : (typeof err?.message === "string" ? err.message : "");
  return { code, subcode, title, message };
}

function isAlreadyVerifiedRequestCodeError(payload: unknown) {
  const { code, subcode, title, message } = readGraphError(payload);
  if (code === 136024 && subcode === 2388366) return true;
  const haystack = `${title} ${message}`.toLowerCase();
  return haystack.includes("already verified");
}

function deriveRegistrationStatus(
  codeVerificationStatus: string | null,
  existingStatus: string | null | undefined,
) {
  const normalized = (codeVerificationStatus ?? "").toUpperCase();
  if (normalized === "VERIFIED") {
    return existingStatus === "registered" ? "registered" : "verified_not_registered";
  }
  if (normalized === "NOT_VERIFIED") return "not_verified";
  if (normalized === "EXPIRED") return "expired";
  return existingStatus ?? "unknown";
}

async function checkTokenScopes(accessToken: string) {
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appId || !appSecret) {
    return {
      ok: false,
      status: 500,
      error: "Missing META_APP_ID or META_APP_SECRET on server. Cannot validate token scopes.",
      scopes: [] as string[],
      missingScopes: [...REQUIRED_TOKEN_SCOPES],
      isValid: false,
    };
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  const res = await fetch(url.toString());
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: 403,
      error: graphError(body, "Failed to inspect token scopes"),
      scopes: [] as string[],
      missingScopes: [...REQUIRED_TOKEN_SCOPES],
      isValid: false,
    };
  }

  const tokenData = body?.data ?? {};
  const scopes = Array.isArray(tokenData?.scopes)
    ? tokenData.scopes.filter((scope: unknown): scope is string => typeof scope === "string")
    : [];
  const isValid = tokenData?.is_valid === true;
  const missingScopes = REQUIRED_TOKEN_SCOPES.filter((scope) => !scopes.includes(scope));
  if (!isValid || missingScopes.length > 0) {
    return {
      ok: false,
      status: 403,
      error: !isValid
        ? "Access token is invalid or expired. Reconnect WhatsApp with Meta Embedded Signup."
        : `Access token missing required scopes: ${missingScopes.join(", ")}.`,
      scopes,
      missingScopes,
      isValid,
    };
  }

  return {
    ok: true,
    status: 200,
    error: null,
    scopes,
    missingScopes: [] as string[],
    isValid,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const merchantId = body?.merchant_id as string | undefined;
    const action = body?.action as
      | "validate_credentials"
      | "connectivity_test_outbound"
      | "check_inbound_marker"
      | "get_registration_status"
      | "request_code"
      | "verify_code"
      | "register"
      | "refresh_status"
      | undefined;

    if (!merchantId || !action) {
      return json({ error: "merchant_id and action are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, org_id, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_verify_token")
      .eq("id", merchantId)
      .single();

    if (merchantError || !merchant) {
      return json({ error: "Merchant not found" }, 404);
    }

    const now = new Date().toISOString();

    const { data: currentSettings } = await supabase
      .from("merchant_settings")
      .select("meta_waba_id, whatsapp_waba_id, whatsapp_business_id, whatsapp_phone_number_id, templates_summary, onboarding_step, whatsapp_is_sandbox, whatsapp_sandbox_waba_id, whatsapp_sandbox_phone_number_id, code_verification_status, phone_registration_status, otp_requested_at, otp_verified_at")
      .eq("merchant_id", merchant.id)
      .maybeSingle();

    const isSandbox = Boolean(currentSettings?.whatsapp_is_sandbox);
    const resolvedPhoneNumberId = resolveOnboardingPhoneNumberId(isSandbox, {
      merchantPhoneNumberId: merchant.whatsapp_phone_number_id,
      settingsPhoneNumberId: currentSettings?.whatsapp_phone_number_id,
      sandboxPhoneNumberId: currentSettings?.whatsapp_sandbox_phone_number_id,
    });
    const resolvedWabaId = isSandbox
      ? (currentSettings?.whatsapp_sandbox_waba_id ?? null)
      : (currentSettings?.whatsapp_waba_id ?? currentSettings?.meta_waba_id ?? null);

    const { data: subscription } = await supabase
      .from("org_subscriptions")
      .select("status, messages_used, trial_ends_at, subscription_plans(message_limit)")
      .eq("org_id", merchant.org_id)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const upsertSettings = async (updates: Record<string, any>) => {
      const { data, error } = await supabase
        .from("merchant_settings")
        .upsert(
          {
            org_id: merchant.org_id,
            merchant_id: merchant.id,
            ...updates,
          },
          { onConflict: "merchant_id" },
        )
        .select("*")
        .single();

      if (error) throw error;
      return data;
    };

    const registrationPrereqError = () => {
      if (isSandbox) {
        return {
          status: 400,
          error: "Phone registration flow is only available for production numbers.",
        };
      }
      if (!resolvedPhoneNumberId || !merchant.whatsapp_access_token) {
        return {
          status: 400,
          error: "Missing merchant WhatsApp credentials. Connect WhatsApp first.",
        };
      }
      return null;
    };

    if (action === "validate_credentials") {
      const verifyToken = merchant.whatsapp_verify_token ?? (Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? null);
      if (!resolvedPhoneNumberId || !merchant.whatsapp_access_token || !verifyToken) {
        return json({
          ok: false,
          error: "Missing merchant credentials. Connect WhatsApp first.",
        }, 400);
      }

      const tokenCheck = await graphGet(
        `${resolvedPhoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status`,
        merchant.whatsapp_access_token,
      );

      const tokenValid = tokenCheck.ok;
      const tokenError = tokenValid ? null : graphError(tokenCheck.body);
      const codeVerificationStatus = tokenValid
        ? String(tokenCheck.body?.code_verification_status ?? "UNKNOWN").toUpperCase()
        : null;
      const phoneRegistrationStatus = deriveRegistrationStatus(
        codeVerificationStatus,
        currentSettings?.phone_registration_status,
      );

      const challenge = "embudex_webhook_test_challenge";
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${challenge}`;

      // Retry webhook challenge up to 2 times to handle cold-start "Forbidden"
      let webhookValid = false;
      let webhookBody = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
        const webhookRes = await fetch(webhookUrl);
        webhookBody = await webhookRes.text();
        webhookValid = webhookRes.ok && webhookBody === challenge;
        if (webhookValid) break;
      }

      const templateInfo = {
        template_approval_state: "unknown",
        template_approved_count: 0,
        template_pending_count: 0,
        template_rejected_count: 0,
      };
      let templatesSummary: Record<string, unknown> | null = null;

      if (tokenValid) {
        // Keep template stats best-effort; do not fail credential validation if WABA id is unavailable.
        const wabaId = (tokenCheck.body?.whatsapp_business_account?.id
          ?? tokenCheck.body?.whatsapp_business_account_id
          ?? resolvedWabaId) as string | undefined;
        if (wabaId && !isSandbox) {
          const tplRes = await graphGet(`${wabaId}/message_templates?fields=name,status,category,language&limit=100`, merchant.whatsapp_access_token);
          if (tplRes.ok) {
            const templates = Array.isArray(tplRes.body?.data) ? tplRes.body.data : [];
            const counts = parseTemplateCounts(templates);
            templateInfo.template_approved_count = counts.approved;
            templateInfo.template_pending_count = counts.pending;
            templateInfo.template_rejected_count = counts.rejected;
            templateInfo.template_approval_state = counts.rejected > 0
              ? "attention_needed"
              : counts.pending > 0
                ? "pending"
                : counts.approved > 0
                  ? "approved"
                  : "unknown";
            templatesSummary = {
              approved_count: counts.approved,
              pending_count: counts.pending,
              rejected_count: counts.rejected,
              templates: templates.map((item: any) => ({
                name: item?.name ?? null,
                status: item?.status ?? null,
                category: item?.category ?? null,
                language: item?.language ?? null,
              })),
            };
          }
        }
      }

      const modeSpecificFields = isSandbox
        ? {
          whatsapp_phone_number_id: null,
          whatsapp_waba_id: null,
          meta_waba_id: null,
          meta_phone_number_id: null,
          meta_access_token_last4: null,
          meta_token_updated_at: null,
          whatsapp_sandbox_phone_number_id: resolvedPhoneNumberId,
          whatsapp_sandbox_waba_id: resolvedWabaId,
        }
        : {
          whatsapp_phone_number_id: resolvedPhoneNumberId,
          whatsapp_waba_id: resolvedWabaId,
          whatsapp_sandbox_phone_number_id: null,
          whatsapp_sandbox_waba_id: null,
        };

      const settings = await upsertSettings({
        whatsapp_is_sandbox: isSandbox,
        onboarding_step: tokenValid && webhookValid ? 2 : 1,
        whatsapp_business_id: currentSettings?.whatsapp_business_id ?? null,
        code_verification_status: codeVerificationStatus,
        phone_registration_status: phoneRegistrationStatus,
        registration_checked_at: now,
        registration_error: tokenError,
        ...modeSpecificFields,
        credentials_valid: tokenValid,
        credentials_last_checked_at: now,
        credentials_error: tokenError,
        creds_status: tokenValid ? "pass" : "fail",
        creds_error: tokenError,
        creds_checked_at: now,
        webhook_challenge_valid: webhookValid,
        webhook_challenge_last_checked_at: now,
        webhook_challenge_error: webhookValid ? null : webhookBody?.slice(0, 500),
        webhook_verify_status: webhookValid ? "pass" : "fail",
        webhook_verify_error: webhookValid ? null : webhookBody?.slice(0, 500),
        webhook_verified_at: webhookValid ? now : null,
        token_valid: tokenValid,
        token_last_checked_at: now,
        token_expires_at: null,
        templates_summary: isSandbox ? null : (templatesSummary ?? currentSettings?.templates_summary ?? null),
        templates_checked_at: now,
        ...templateInfo,
        last_validation_payload: {
          action: "validate_credentials",
          mode: isSandbox ? "sandbox" : "production",
          checked_at: now,
          token_valid: tokenValid,
          webhook_challenge_valid: webhookValid,
          code_verification_status: codeVerificationStatus,
          phone_registration_status: phoneRegistrationStatus,
          error: tokenError ?? (webhookValid ? null : webhookBody?.slice(0, 500)),
        },
        step_progress: {
          onboarding_step: tokenValid && webhookValid ? 2 : 1,
          credentials_valid: tokenValid,
          webhook_verified: webhookValid,
        },
        validation_results: {
          validate_credentials: {
            token_valid: tokenValid,
            webhook_challenge_valid: webhookValid,
            checked_at: now,
          },
        },
      });

      return json({
        ok: tokenValid && webhookValid,
        token_valid: tokenValid,
        webhook_challenge_valid: webhookValid,
        code_verification_status: codeVerificationStatus,
        phone_registration_status: phoneRegistrationStatus,
        settings,
      });
    }

    if (action === "get_registration_status") {
      const prereq = registrationPrereqError();
      if (prereq) return json({ ok: false, error: prereq.error }, prereq.status);

      const statusRes = await graphGet(
        `${resolvedPhoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status`,
        merchant.whatsapp_access_token!,
      );

      if (!statusRes.ok) {
        const error = graphError(statusRes.body);
        const settings = await upsertSettings({
          registration_checked_at: now,
          registration_error: error,
          last_validation_payload: {
            action: "get_registration_status",
            mode: "production",
            checked_at: now,
            error,
          },
        });
        return json({ ok: false, error, details: statusRes.body, settings }, 400);
      }

      const codeVerificationStatus = String(statusRes.body?.code_verification_status ?? "UNKNOWN").toUpperCase();
      const phoneRegistrationStatus = deriveRegistrationStatus(
        codeVerificationStatus,
        currentSettings?.phone_registration_status,
      );

      const settings = await upsertSettings({
        code_verification_status: codeVerificationStatus,
        phone_registration_status: phoneRegistrationStatus,
        registration_checked_at: now,
        registration_error: null,
        last_validation_payload: {
          action: "get_registration_status",
          mode: "production",
          checked_at: now,
          code_verification_status: codeVerificationStatus,
          phone_registration_status: phoneRegistrationStatus,
        },
      });

      return json({
        ok: true,
        code_verification_status: codeVerificationStatus,
        phone_registration_status: phoneRegistrationStatus,
        phone_number: {
          id: statusRes.body?.id ?? null,
          display_phone_number: statusRes.body?.display_phone_number ?? null,
          verified_name: statusRes.body?.verified_name ?? null,
        },
        settings,
      });
    }

    if (action === "request_code") {
      const prereq = registrationPrereqError();
      if (prereq) return json({ ok: false, error: prereq.error }, prereq.status);

      const scopeCheck = await checkTokenScopes(merchant.whatsapp_access_token!);
      if (!scopeCheck.ok) {
        const settings = await upsertSettings({
          token_scope_status: "fail",
          token_scopes: scopeCheck.scopes,
          registration_last_attempt_at: now,
          registration_error: scopeCheck.error,
          last_validation_payload: {
            action: "request_code",
            mode: "production",
            checked_at: now,
            scope_check: "fail",
            missing_scopes: scopeCheck.missingScopes,
            token_valid: scopeCheck.isValid,
            error: scopeCheck.error,
          },
        });
        return json({
          ok: false,
          error: scopeCheck.error,
          missing_scopes: scopeCheck.missingScopes,
          scopes: scopeCheck.scopes,
          settings,
        }, scopeCheck.status);
      }

      const codeMethodRaw = String(body?.code_method ?? "SMS").toUpperCase();
      const codeMethod = codeMethodRaw === "VOICE" ? "VOICE" : "SMS";
      const language = typeof body?.language === "string" && body.language.trim().length > 0
        ? body.language.trim()
        : "en_US";

      const requestRes = await graphPost(
        `${resolvedPhoneNumberId}/request_code`,
        merchant.whatsapp_access_token!,
        { code_method: codeMethod, language },
      );
      if (!requestRes.ok && isAlreadyVerifiedRequestCodeError(requestRes.body)) {
        const statusRes = await graphGet(
          `${resolvedPhoneNumberId}?fields=code_verification_status`,
          merchant.whatsapp_access_token!,
        );
        const codeVerificationStatus = statusRes.ok
          ? String(statusRes.body?.code_verification_status ?? "VERIFIED").toUpperCase()
          : "VERIFIED";
        const phoneRegistrationStatus = currentSettings?.phone_registration_status === "registered"
          ? "registered"
          : "verified_not_registered";
        const settings = await upsertSettings({
          token_scope_status: "pass",
          token_scopes: scopeCheck.scopes,
          code_verification_status: codeVerificationStatus,
          phone_registration_status: phoneRegistrationStatus,
          otp_verified_at: currentSettings?.otp_verified_at ?? now,
          registration_last_attempt_at: now,
          registration_checked_at: now,
          registration_error: null,
          last_validation_payload: {
            action: "request_code",
            mode: "production",
            checked_at: now,
            ok: true,
            already_verified: true,
            code_method: codeMethod,
            language,
            provider_error: requestRes.body,
          },
        });

        return json({
          ok: true,
          already_verified: true,
          next_action: "register",
          response: requestRes.body,
          settings,
        });
      }
      const reqError = requestRes.ok ? null : graphError(requestRes.body);
      const settings = await upsertSettings({
        token_scope_status: "pass",
        token_scopes: scopeCheck.scopes,
        phone_registration_status: requestRes.ok ? "otp_requested" : "otp_request_failed",
        otp_requested_at: requestRes.ok ? now : currentSettings?.otp_requested_at ?? null,
        registration_last_attempt_at: now,
        registration_error: reqError,
        registration_checked_at: now,
        last_validation_payload: {
          action: "request_code",
          mode: "production",
          checked_at: now,
          ok: requestRes.ok,
          code_method: codeMethod,
          language,
          error: reqError,
        },
      });

      return json({
        ok: requestRes.ok,
        error: reqError,
        response: requestRes.body,
        settings,
      }, requestRes.ok ? 200 : 400);
    }

    if (action === "verify_code") {
      const prereq = registrationPrereqError();
      if (prereq) return json({ ok: false, error: prereq.error }, prereq.status);

      const code = typeof body?.code === "string" ? body.code.trim() : "";
      if (!/^\d{4,8}$/.test(code)) {
        return json({ ok: false, error: "code is required and must be 4-8 digits." }, 400);
      }

      const scopeCheck = await checkTokenScopes(merchant.whatsapp_access_token!);
      if (!scopeCheck.ok) {
        const settings = await upsertSettings({
          token_scope_status: "fail",
          token_scopes: scopeCheck.scopes,
          registration_last_attempt_at: now,
          registration_error: scopeCheck.error,
          last_validation_payload: {
            action: "verify_code",
            mode: "production",
            checked_at: now,
            scope_check: "fail",
            missing_scopes: scopeCheck.missingScopes,
            token_valid: scopeCheck.isValid,
            error: scopeCheck.error,
          },
        });
        return json({
          ok: false,
          error: scopeCheck.error,
          missing_scopes: scopeCheck.missingScopes,
          scopes: scopeCheck.scopes,
          settings,
        }, scopeCheck.status);
      }

      const verifyRes = await graphPost(
        `${resolvedPhoneNumberId}/verify_code`,
        merchant.whatsapp_access_token!,
        { code },
      );
      const verifyError = verifyRes.ok ? null : graphError(verifyRes.body);
      let codeVerificationStatus = verifyRes.ok ? "VERIFIED" : (currentSettings?.code_verification_status ?? null);
      if (verifyRes.ok) {
        const statusRes = await graphGet(
          `${resolvedPhoneNumberId}?fields=code_verification_status`,
          merchant.whatsapp_access_token!,
        );
        if (statusRes.ok) {
          codeVerificationStatus = String(statusRes.body?.code_verification_status ?? "VERIFIED").toUpperCase();
        }
      }
      const phoneRegistrationStatus = verifyRes.ok
        ? "otp_verified"
        : "otp_verification_failed";
      const settings = await upsertSettings({
        token_scope_status: "pass",
        token_scopes: scopeCheck.scopes,
        code_verification_status: codeVerificationStatus,
        phone_registration_status: verifyRes.ok
          ? (currentSettings?.phone_registration_status === "registered" ? "registered" : phoneRegistrationStatus)
          : phoneRegistrationStatus,
        otp_verified_at: verifyRes.ok ? now : currentSettings?.otp_verified_at ?? null,
        registration_last_attempt_at: now,
        registration_checked_at: now,
        registration_error: verifyError,
        last_validation_payload: {
          action: "verify_code",
          mode: "production",
          checked_at: now,
          ok: verifyRes.ok,
          code_verification_status: codeVerificationStatus,
          error: verifyError,
        },
      });

      return json({
        ok: verifyRes.ok,
        error: verifyError,
        code_verification_status: codeVerificationStatus,
        response: verifyRes.body,
        settings,
      }, verifyRes.ok ? 200 : 400);
    }

    if (action === "register") {
      const prereq = registrationPrereqError();
      if (prereq) return json({ ok: false, error: prereq.error }, prereq.status);

      const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
      if (!/^\d{6}$/.test(pin)) {
        return json({ ok: false, error: "pin is required and must be 6 digits." }, 400);
      }

      const scopeCheck = await checkTokenScopes(merchant.whatsapp_access_token!);
      if (!scopeCheck.ok) {
        const settings = await upsertSettings({
          token_scope_status: "fail",
          token_scopes: scopeCheck.scopes,
          registration_last_attempt_at: now,
          registration_error: scopeCheck.error,
          last_validation_payload: {
            action: "register",
            mode: "production",
            checked_at: now,
            scope_check: "fail",
            missing_scopes: scopeCheck.missingScopes,
            token_valid: scopeCheck.isValid,
            error: scopeCheck.error,
          },
        });
        return json({
          ok: false,
          error: scopeCheck.error,
          missing_scopes: scopeCheck.missingScopes,
          scopes: scopeCheck.scopes,
          settings,
        }, scopeCheck.status);
      }

      const registerRes = await graphPost(
        `${resolvedPhoneNumberId}/register`,
        merchant.whatsapp_access_token!,
        { messaging_product: "whatsapp", pin },
      );
      const registerError = registerRes.ok ? null : graphError(registerRes.body);
      let codeVerificationStatus = currentSettings?.code_verification_status ?? null;
      if (registerRes.ok) {
        const statusRes = await graphGet(
          `${resolvedPhoneNumberId}?fields=code_verification_status`,
          merchant.whatsapp_access_token!,
        );
        if (statusRes.ok) {
          codeVerificationStatus = String(statusRes.body?.code_verification_status ?? "UNKNOWN").toUpperCase();
        }
      }
      const settings = await upsertSettings({
        token_scope_status: "pass",
        token_scopes: scopeCheck.scopes,
        code_verification_status: codeVerificationStatus,
        phone_registration_status: registerRes.ok ? "registered" : "registration_failed",
        registration_last_attempt_at: now,
        registration_checked_at: now,
        registration_error: registerError,
        last_validation_payload: {
          action: "register",
          mode: "production",
          checked_at: now,
          ok: registerRes.ok,
          code_verification_status: codeVerificationStatus,
          error: registerError,
        },
      });

      return json({
        ok: registerRes.ok,
        error: registerError,
        code_verification_status: codeVerificationStatus,
        phone_registration_status: registerRes.ok ? "registered" : "registration_failed",
        response: registerRes.body,
        settings,
      }, registerRes.ok ? 200 : 400);
    }

    if (action === "connectivity_test_outbound") {
      const testTo = body?.test_to as string | undefined;
      if (!testTo) {
        return json({ ok: false, error: "test_to is required" }, 400);
      }

      const status = subscription?.status ?? "trial";
      const trialExpired = status === "trial" && !!subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime() <= Date.now();
      const plans2 = subscription?.subscription_plans;
      const plan2 = Array.isArray(plans2) ? plans2[0] : plans2;
      const messageLimit = plan2?.message_limit ?? 0;
      const messagesUsed = subscription?.messages_used ?? 0;
      const overQuota = messageLimit > 0 && messagesUsed >= messageLimit;

      if (!["active", "trial"].includes(status) || trialExpired || overQuota) {
        return json({
          ok: false,
          error: overQuota
            ? `Message quota exceeded (${messagesUsed}/${messageLimit}).`
            : trialExpired
              ? "Trial expired."
              : `Subscription status ${status} does not allow outbound tests.`,
          subscription_status: status,
          messages_used: messagesUsed,
          message_limit: messageLimit,
        }, 403);
      }

      if (!resolvedPhoneNumberId || !merchant.whatsapp_access_token) {
        return json({ ok: false, error: "Missing merchant WhatsApp credentials" }, 400);
      }

      const requestedTemplateName = typeof body?.template_name === "string"
        ? body.template_name.trim()
        : "";
      const requestedTemplateLanguage = typeof body?.template_language === "string"
        ? body.template_language.trim()
        : "";

      let templateName = requestedTemplateName || "hello_world";
      let templateLanguage = requestedTemplateLanguage || "en_US";

      const buildTemplatePayload = (name: string, languageCode: string) => ({
        messaging_product: "whatsapp",
        to: testTo,
        type: "template",
        template: {
          name,
          language: { code: languageCode },
        },
      });

      const extractTemplateLanguage = (rawTemplate: any) => {
        const rawLanguage = rawTemplate?.language;
        if (typeof rawLanguage === "string") return rawLanguage.trim();
        if (typeof rawLanguage?.code === "string") return rawLanguage.code.trim();
        return "";
      };

      const matchLanguage = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

      let precheckBlocked = false;
      let sendRes: { ok: boolean; status: number; body: any };
      if (!isSandbox && resolvedWabaId && templateName !== "hello_world") {
        const tplRes = await graphGet(
          `${resolvedWabaId}/message_templates?fields=name,status,language&limit=200`,
          merchant.whatsapp_access_token,
        );
        if (tplRes.ok) {
          const templates = Array.isArray(tplRes.body?.data) ? tplRes.body.data : [];
          const byName = templates.filter((tpl: any) => String(tpl?.name ?? "").trim().toLowerCase() === templateName.toLowerCase());
          if (byName.length === 0) {
            precheckBlocked = true;
            sendRes = {
              ok: false,
              status: 400,
              body: {
                error: {
                  message: `Template '${templateName}' was not found in this WhatsApp Business Account.`,
                  code: "TEMPLATE_NOT_FOUND",
                  error_data: {
                    template_name: templateName,
                    requested_language: templateLanguage,
                  },
                },
              },
            };
          } else {
            const byLanguage = byName.filter((tpl: any) => matchLanguage(extractTemplateLanguage(tpl), templateLanguage));
            if (byLanguage.length === 0) {
              precheckBlocked = true;
              const availableLanguages = [...new Set(byName.map((tpl: any) => extractTemplateLanguage(tpl)).filter(Boolean))];
              sendRes = {
                ok: false,
                status: 400,
                body: {
                  error: {
                    message: `Template '${templateName}' does not have language '${templateLanguage}'.`,
                    code: "TEMPLATE_LANGUAGE_MISMATCH",
                    error_data: {
                      template_name: templateName,
                      requested_language: templateLanguage,
                      available_languages: availableLanguages,
                    },
                  },
                },
              };
            } else {
              const templateStatus = String(byLanguage[0]?.status ?? "UNKNOWN").toUpperCase();
              if (templateStatus !== "APPROVED") {
                precheckBlocked = true;
                sendRes = {
                  ok: false,
                  status: 400,
                  body: {
                    error: {
                      message: `Template '${templateName}' (${templateLanguage}) is ${templateStatus}. Wait until it is APPROVED.`,
                      code: "TEMPLATE_NOT_APPROVED",
                      error_data: {
                        template_name: templateName,
                        requested_language: templateLanguage,
                        template_status: templateStatus,
                      },
                    },
                  },
                };
              } else {
                sendRes = await graphPost(
                  `${resolvedPhoneNumberId}/messages`,
                  merchant.whatsapp_access_token,
                  buildTemplatePayload(templateName, templateLanguage),
                );
              }
            }
          }
        } else {
          // If template catalog query fails, proceed with send attempt and let Graph provide canonical error.
          sendRes = await graphPost(
            `${resolvedPhoneNumberId}/messages`,
            merchant.whatsapp_access_token,
            buildTemplatePayload(templateName, templateLanguage),
          );
        }
      } else {
        sendRes = await graphPost(
          `${resolvedPhoneNumberId}/messages`,
          merchant.whatsapp_access_token,
          buildTemplatePayload(templateName, templateLanguage),
        );
      }

      let fallbackUsed = false;

      const sendErrMeta = readGraphError(sendRes.body);
      if (!sendRes.ok && sendErrMeta.code === 131058 && templateName === "hello_world" && !isSandbox) {
        type CandidateTemplate = { name: string; language: string };
        let fallbackTemplate: CandidateTemplate | null = null;

        const summaryTemplates = Array.isArray((currentSettings?.templates_summary as any)?.templates)
          ? (currentSettings?.templates_summary as any).templates
          : [];
        for (const tpl of summaryTemplates) {
          const status = String(tpl?.status ?? "").toUpperCase();
          const name = typeof tpl?.name === "string" ? tpl.name.trim() : "";
          if (status !== "APPROVED" || !name) continue;
          const rawLanguage = tpl?.language;
          const language = typeof rawLanguage === "string"
            ? rawLanguage
            : (typeof rawLanguage?.code === "string" ? rawLanguage.code : "en_US");
          fallbackTemplate = { name, language };
          break;
        }

        if (!fallbackTemplate && resolvedWabaId) {
          const tplRes = await graphGet(
            `${resolvedWabaId}/message_templates?fields=name,status,language&limit=50`,
            merchant.whatsapp_access_token,
          );
          if (tplRes.ok) {
            const templates = Array.isArray(tplRes.body?.data) ? tplRes.body.data : [];
            for (const tpl of templates) {
              const status = String(tpl?.status ?? "").toUpperCase();
              const name = typeof tpl?.name === "string" ? tpl.name.trim() : "";
              if (status !== "APPROVED" || !name) continue;
              const rawLanguage = tpl?.language;
              const language = typeof rawLanguage === "string"
                ? rawLanguage
                : (typeof rawLanguage?.code === "string" ? rawLanguage.code : "en_US");
              fallbackTemplate = { name, language };
              break;
            }
          }
        }

        if (fallbackTemplate && fallbackTemplate.name !== templateName) {
          templateName = fallbackTemplate.name;
          templateLanguage = fallbackTemplate.language || "en_US";
          sendRes = await graphPost(
            `${resolvedPhoneNumberId}/messages`,
            merchant.whatsapp_access_token,
            buildTemplatePayload(templateName, templateLanguage),
          );
          fallbackUsed = true;
        }
      }

      const sandboxBlocked = isSandbox && !sendRes.ok && isSandboxBlockedGraphError(sendRes.body);
      const finalErrMeta = readGraphError(sendRes.body);
      const templatePolicyBlocked = !sendRes.ok && finalErrMeta.code === 131058;
      const isOk = sendRes.ok || sandboxBlocked;
      const error = sendRes.ok
        ? null
        : precheckBlocked
          ? graphError(sendRes.body)
        : sandboxBlocked
          ? encodeSandboxErrorPayload(sendRes.body, "Blocked by Meta sandbox constraints")
          : templatePolicyBlocked
            ? JSON.stringify({
              message: "The selected template is not allowed for this sender. Use an approved WABA template.",
              code: 131058,
              template_name: templateName,
              template_language: templateLanguage,
              fallback_used: fallbackUsed,
            }).slice(0, 500)
            : graphError(sendRes.body);

      await supabase.from("channel_events").insert({
        org_id: merchant.org_id,
        merchant_id: merchant.id,
        channel: "whatsapp",
        provider: "meta",
        event_type: "onboarding_outbound_test",
        provider_event_id: `onboarding_${Date.now()}`,
        external_contact: testTo,
        severity: isOk ? "info" : "error",
        payload: {
          function_name: "merchant-onboarding-check",
          action,
          template_name: templateName,
          template_language: templateLanguage,
          fallback_used: fallbackUsed,
          response: sendRes.body,
        },
      });

      const settings = await upsertSettings({
        onboarding_step: isOk ? 2 : 2,
        whatsapp_is_sandbox: isSandbox,
        connectivity_outbound_ok: sendRes.ok,
        connectivity_outbound_last_checked_at: now,
        connectivity_outbound_error: error,
        outbound_status: sendRes.ok ? "pass" : sandboxBlocked ? "blocked_sandbox" : "fail",
        last_outbound_error: error,
        last_outbound_success_at: sendRes.ok ? now : undefined,
        last_outbound_failure_at: sendRes.ok ? undefined : now,
        last_validation_payload: {
          action: "connectivity_test_outbound",
          mode: isSandbox ? "sandbox" : "production",
          checked_at: now,
          ok: sendRes.ok,
          sandbox_blocked: sandboxBlocked,
          template_precheck_blocked: precheckBlocked,
          template_name: templateName,
          template_language: templateLanguage,
          fallback_used: fallbackUsed,
          error,
          test_to: testTo,
        },
        step_progress: {
          onboarding_step: 2,
          outbound_ok: isOk,
        },
        validation_results: {
          connectivity_test_outbound: {
            ok: isOk,
            sandbox_blocked: sandboxBlocked,
            checked_at: now,
            test_to: testTo,
            template_precheck_blocked: precheckBlocked,
            template_name: templateName,
            template_language: templateLanguage,
            fallback_used: fallbackUsed,
            provider_message_id: sendRes.body?.messages?.[0]?.id ?? null,
          },
        },
      });

      return json({
        ok: isOk,
        send_response: sendRes.body,
        settings,
        error,
        sandbox_blocked: sandboxBlocked,
        precheck_blocked: precheckBlocked,
        fallback_used: fallbackUsed,
        template_name: templateName,
        template_language: templateLanguage,
      });
    }

    if (action === "check_inbound_marker") {
      const expectedFrom = body?.expected_from as string | undefined;

      let query = supabase
        .from("channel_events")
        .select("id, provider_event_id, created_at, external_contact")
        .eq("merchant_id", merchant.id)
        .eq("channel", "whatsapp")
        .eq("event_type", "message")
        .order("created_at", { ascending: false })
        .limit(1);

      if (expectedFrom) {
        query = query.eq("external_contact", expectedFrom);
      }

      const { data: inboundRows, error: inboundError } = await query;
      if (inboundError) return json({ ok: false, error: inboundError.message }, 500);

      const latest = inboundRows?.[0] ?? null;
      const inboundOk = !!latest;
      const sandboxBlocked = isSandbox && !inboundOk;

      const settings = await upsertSettings({
        onboarding_step: inboundOk || sandboxBlocked ? 3 : 2,
        whatsapp_is_sandbox: isSandbox,
        connectivity_inbound_ok: inboundOk,
        connectivity_inbound_last_checked_at: now,
        connectivity_inbound_marker: latest?.provider_event_id ?? null,
        last_inbound_at: latest?.created_at ?? null,
        last_inbound_event_id: latest?.id ?? null,
        inbound_status: inboundOk ? "pass" : sandboxBlocked ? "blocked_sandbox" : "fail",
        inbound_error: inboundOk ? null : sandboxBlocked
          ? JSON.stringify({ message: "Blocked by Meta sandbox constraints; no inbound marker yet", sandbox_blocked: true, mode: "sandbox" })
          : "No inbound marker found yet",
        last_webhook_received_at: latest?.created_at ?? null,
        last_validation_payload: {
          action: "check_inbound_marker",
          mode: isSandbox ? "sandbox" : "production",
          checked_at: now,
          ok: inboundOk,
          sandbox_blocked: sandboxBlocked,
          marker: latest?.provider_event_id ?? null,
          channel_event_id: latest?.id ?? null,
          external_contact: latest?.external_contact ?? null,
        },
        step_progress: {
          onboarding_step: inboundOk || sandboxBlocked ? 3 : 2,
          inbound_ok: inboundOk,
        },
        validation_results: {
          check_inbound_marker: {
            ok: inboundOk,
            sandbox_blocked: sandboxBlocked,
            checked_at: now,
            marker: latest?.provider_event_id ?? null,
            external_contact: latest?.external_contact ?? null,
          },
        },
      });

      return json({ ok: inboundOk || sandboxBlocked, marker: latest, settings, sandbox_blocked: sandboxBlocked });
    }

    // refresh_status
    const { data: latestWebhook } = await supabase
      .from("channel_events")
      .select("created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestInbound } = await supabase
      .from("channel_events")
      .select("id, created_at")
      .eq("merchant_id", merchant.id)
      .eq("channel", "whatsapp")
      .eq("event_type", "message")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: convRows } = await supabase
      .from("conversations")
      .select("id")
      .eq("merchant_id", merchant.id)
      .limit(500);

    const conversationIds = (convRows ?? []).map((row) => row.id);

    let lastOutboundSuccessAt: string | null = null;
    let lastOutboundFailureAt: string | null = null;

    if (conversationIds.length > 0) {
      const { data: outboundRows } = await supabase
        .from("messages")
        .select("created_at, send_status, send_error")
        .in("conversation_id", conversationIds)
        .eq("direction", "outbound")
        .in("send_status", ["sent", "failed"])
        .order("created_at", { ascending: false })
        .limit(300);

      let latestOutboundError: string | null = null;

      for (const row of outboundRows ?? []) {
        if (!lastOutboundSuccessAt && row.send_status === "sent") lastOutboundSuccessAt = row.created_at;
        if (!lastOutboundFailureAt && row.send_status === "failed") {
          lastOutboundFailureAt = row.created_at;
          latestOutboundError = row.send_error ?? null;
        }
        if (lastOutboundSuccessAt && lastOutboundFailureAt) break;
      }

      const outboundStatus = lastOutboundFailureAt
        ? (!lastOutboundSuccessAt || new Date(lastOutboundFailureAt).getTime() >= new Date(lastOutboundSuccessAt).getTime() ? "fail" : "pass")
        : (lastOutboundSuccessAt ? "pass" : isSandbox ? "blocked_sandbox" : "unknown");
      const inboundStatus = latestInbound ? "pass" : isSandbox ? "blocked_sandbox" : "unknown";

      const refreshedSettings = await upsertSettings({
        whatsapp_is_sandbox: isSandbox,
        last_webhook_received_at: latestWebhook?.created_at ?? null,
        last_inbound_at: latestInbound?.created_at ?? null,
        last_inbound_event_id: latestInbound?.id ?? null,
        inbound_status: inboundStatus,
        inbound_error: latestInbound
          ? null
          : isSandbox
            ? JSON.stringify({ message: "Blocked by Meta sandbox constraints; no inbound marker yet", sandbox_blocked: true, mode: "sandbox" })
            : "No inbound marker found yet",
        last_outbound_success_at: lastOutboundSuccessAt,
        last_outbound_failure_at: lastOutboundFailureAt,
        last_outbound_error: latestOutboundError,
        outbound_status: outboundStatus,
        last_validation_payload: {
          action: "refresh_status",
          mode: isSandbox ? "sandbox" : "production",
          checked_at: now,
          inbound_status: inboundStatus,
          outbound_status: outboundStatus,
        },
        step_progress: {
          onboarding_step: currentSettings?.onboarding_step ?? 1,
          inbound_ok: !!latestInbound,
          outbound_status: outboundStatus,
        },
      });

      return json({
        ok: true,
        last_webhook_received_at: latestWebhook?.created_at ?? null,
        last_inbound_at: latestInbound?.created_at ?? null,
        last_outbound_success_at: lastOutboundSuccessAt,
        last_outbound_failure_at: lastOutboundFailureAt,
        outbound_status: outboundStatus,
        inbound_status: inboundStatus,
        settings: refreshedSettings,
      });
    }

    const outboundStatus = isSandbox ? "blocked_sandbox" : "unknown";
    const inboundStatus = latestInbound ? "pass" : isSandbox ? "blocked_sandbox" : "unknown";

    const settings = await upsertSettings({
      whatsapp_is_sandbox: isSandbox,
      last_webhook_received_at: latestWebhook?.created_at ?? null,
      last_inbound_at: latestInbound?.created_at ?? null,
      last_inbound_event_id: latestInbound?.id ?? null,
      inbound_status: inboundStatus,
      inbound_error: latestInbound
        ? null
        : isSandbox
          ? JSON.stringify({ message: "Blocked by Meta sandbox constraints; no inbound marker yet", sandbox_blocked: true, mode: "sandbox" })
          : "No inbound marker found yet",
      outbound_status: outboundStatus,
      last_validation_payload: {
        action: "refresh_status",
        mode: isSandbox ? "sandbox" : "production",
        checked_at: now,
        inbound_status: inboundStatus,
        outbound_status: outboundStatus,
      },
      step_progress: {
        onboarding_step: currentSettings?.onboarding_step ?? 1,
        inbound_ok: !!latestInbound,
        outbound_status: outboundStatus,
      },
    });

    return json({
      ok: true,
      last_webhook_received_at: latestWebhook?.created_at ?? null,
      last_inbound_at: latestInbound?.created_at ?? null,
      outbound_status: outboundStatus,
      inbound_status: inboundStatus,
      settings,
    });
  } catch (error) {
    console.error("merchant-onboarding-check error", error);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
