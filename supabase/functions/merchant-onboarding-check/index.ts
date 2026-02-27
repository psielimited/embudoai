import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  encodeSandboxErrorPayload,
  isSandboxBlockedGraphError,
  resolveOnboardingPhoneNumberId,
} from "./sandbox.ts";

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
  const res = await fetch(`https://graph.facebook.com/v24.0/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function graphPost(path: string, accessToken: string, payload: unknown) {
  const res = await fetch(`https://graph.facebook.com/v24.0/${path}`, {
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
      .select("meta_waba_id, whatsapp_waba_id, whatsapp_business_id, whatsapp_phone_number_id, templates_summary, onboarding_step, whatsapp_is_sandbox, whatsapp_sandbox_waba_id, whatsapp_sandbox_phone_number_id")
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

    if (action === "validate_credentials") {
      const verifyToken = merchant.whatsapp_verify_token ?? (Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? null);
      if (!resolvedPhoneNumberId || !merchant.whatsapp_access_token || !verifyToken) {
        return json({
          ok: false,
          error: "Missing merchant credentials. Connect WhatsApp first.",
        }, 400);
      }

      const tokenCheck = await graphGet(
        `${resolvedPhoneNumberId}?fields=id,display_phone_number,verified_name`,
        merchant.whatsapp_access_token,
      );

      const tokenValid = tokenCheck.ok;
      const tokenError = tokenValid ? null : JSON.stringify(tokenCheck.body?.error ?? tokenCheck.body).slice(0, 500);

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
        settings,
      });
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

      const testPayload = {
        messaging_product: "whatsapp",
        to: testTo,
        type: "template",
        template: {
          name: "hello_world",
          language: { code: "en_US" },
        },
      };

      const sendRes = await graphPost(`${resolvedPhoneNumberId}/messages`, merchant.whatsapp_access_token, testPayload);
      const sandboxBlocked = isSandbox && !sendRes.ok && isSandboxBlockedGraphError(sendRes.body);
      const isOk = sendRes.ok || sandboxBlocked;
      const error = sendRes.ok
        ? null
        : sandboxBlocked
          ? encodeSandboxErrorPayload(sendRes.body, "Blocked by Meta sandbox constraints")
          : JSON.stringify(sendRes.body?.error ?? sendRes.body).slice(0, 500);

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
            provider_message_id: sendRes.body?.messages?.[0]?.id ?? null,
          },
        },
      });

      return json({ ok: isOk, send_response: sendRes.body, settings, error, sandbox_blocked: sandboxBlocked });
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
