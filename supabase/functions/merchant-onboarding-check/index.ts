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
      if (!merchant.whatsapp_phone_number_id || !merchant.whatsapp_access_token || !merchant.whatsapp_verify_token) {
        return json({
          ok: false,
          error: "Missing merchant credentials. Save phone_number_id, access_token and verify_token first.",
        }, 400);
      }

      const tokenCheck = await graphGet(
        `${merchant.whatsapp_phone_number_id}?fields=id,display_phone_number,verified_name,whatsapp_business_account`,
        merchant.whatsapp_access_token,
      );

      const tokenValid = tokenCheck.ok;
      const tokenError = tokenValid ? null : JSON.stringify(tokenCheck.body?.error ?? tokenCheck.body).slice(0, 500);

      const challenge = "embudex_webhook_test_challenge";
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(merchant.whatsapp_verify_token)}&hub.challenge=${challenge}`;
      const webhookRes = await fetch(webhookUrl);
      const webhookBody = await webhookRes.text();
      const webhookValid = webhookRes.ok && webhookBody === challenge;

      const templateInfo = {
        template_approval_state: "unknown",
        template_approved_count: 0,
        template_pending_count: 0,
        template_rejected_count: 0,
      };

      if (tokenValid) {
        const wabaId = tokenCheck.body?.whatsapp_business_account?.id as string | undefined;
        if (wabaId) {
          const tplRes = await graphGet(`${wabaId}/message_templates?fields=name,status&limit=100`, merchant.whatsapp_access_token);
          if (tplRes.ok) {
            const counts = parseTemplateCounts(Array.isArray(tplRes.body?.data) ? tplRes.body.data : []);
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
          }
        }
      }

      const settings = await upsertSettings({
        onboarding_step: tokenValid && webhookValid ? 2 : 1,
        credentials_valid: tokenValid,
        credentials_last_checked_at: now,
        credentials_error: tokenError,
        webhook_challenge_valid: webhookValid,
        webhook_challenge_last_checked_at: now,
        webhook_challenge_error: webhookValid ? null : webhookBody?.slice(0, 500),
        token_valid: tokenValid,
        token_last_checked_at: now,
        token_expires_at: null,
        ...templateInfo,
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

      if (!merchant.whatsapp_phone_number_id || !merchant.whatsapp_access_token) {
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

      const sendRes = await graphPost(`${merchant.whatsapp_phone_number_id}/messages`, merchant.whatsapp_access_token, testPayload);
      const isOk = sendRes.ok;
      const error = isOk ? null : JSON.stringify(sendRes.body?.error ?? sendRes.body).slice(0, 500);

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
        connectivity_outbound_ok: isOk,
        connectivity_outbound_last_checked_at: now,
        connectivity_outbound_error: error,
        last_outbound_success_at: isOk ? now : undefined,
        last_outbound_failure_at: isOk ? undefined : now,
        validation_results: {
          connectivity_test_outbound: {
            ok: isOk,
            checked_at: now,
            test_to: testTo,
            provider_message_id: sendRes.body?.messages?.[0]?.id ?? null,
          },
        },
      });

      return json({ ok: isOk, send_response: sendRes.body, settings, error });
    }

    if (action === "check_inbound_marker") {
      const expectedFrom = body?.expected_from as string | undefined;

      let query = supabase
        .from("channel_events")
        .select("provider_event_id, created_at, external_contact")
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

      const settings = await upsertSettings({
        onboarding_step: inboundOk ? 3 : 2,
        connectivity_inbound_ok: inboundOk,
        connectivity_inbound_last_checked_at: now,
        connectivity_inbound_marker: latest?.provider_event_id ?? null,
        last_webhook_received_at: latest?.created_at ?? null,
        validation_results: {
          check_inbound_marker: {
            ok: inboundOk,
            checked_at: now,
            marker: latest?.provider_event_id ?? null,
            external_contact: latest?.external_contact ?? null,
          },
        },
      });

      return json({ ok: inboundOk, marker: latest, settings });
    }

    // refresh_status
    const { data: latestWebhook } = await supabase
      .from("channel_events")
      .select("created_at")
      .eq("merchant_id", merchant.id)
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
        .select("created_at, send_status")
        .in("conversation_id", conversationIds)
        .eq("direction", "outbound")
        .in("send_status", ["sent", "failed"])
        .order("created_at", { ascending: false })
        .limit(300);

      for (const row of outboundRows ?? []) {
        if (!lastOutboundSuccessAt && row.send_status === "sent") lastOutboundSuccessAt = row.created_at;
        if (!lastOutboundFailureAt && row.send_status === "failed") lastOutboundFailureAt = row.created_at;
        if (lastOutboundSuccessAt && lastOutboundFailureAt) break;
      }
    }

    const settings = await upsertSettings({
      last_webhook_received_at: latestWebhook?.created_at ?? null,
      last_outbound_success_at: lastOutboundSuccessAt,
      last_outbound_failure_at: lastOutboundFailureAt,
    });

    return json({
      ok: true,
      last_webhook_received_at: latestWebhook?.created_at ?? null,
      last_outbound_success_at: lastOutboundSuccessAt,
      last_outbound_failure_at: lastOutboundFailureAt,
      settings,
    });
  } catch (error) {
    console.error("merchant-onboarding-check error", error);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
