/**
 * Edge Function: send-whatsapp-message
 *
 * Sends an outbound WhatsApp message via the Cloud API.
 * Input: { message_id, idempotency_key? }
 * Reliability:
 * - Idempotency via outbound_jobs.idempotency_key
 * - Retries on provider 5xx/network failures with exponential backoff
 * - Emits channel_event severity=error when retries are exhausted
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

function computeBackoffSeconds(retryCount: number) {
  const base = 30;
  const cap = 15 * 60;
  return Math.min(cap, base * 2 ** Math.max(0, retryCount - 1));
}

function nowIso() {
  return new Date().toISOString();
}

function truncateError(payload: unknown) {
  if (typeof payload === "string") return payload.slice(0, 500);
  return JSON.stringify(payload).slice(0, 500);
}

// deno-lint-ignore no-explicit-any
async function emitRetryExhaustedEvent(
  supabase: any,
  params: {
    orgId: string;
    merchantId: string;
    externalContact: string;
    messageId: string;
    idempotencyKey: string;
    retryCount: number;
    maxRetries: number;
    error: string;
  },
) {
  await supabase.from("channel_events").insert({
    org_id: params.orgId,
    merchant_id: params.merchantId,
    channel: "whatsapp",
    provider: "meta",
    event_type: "outbound_retry_exhausted",
    provider_event_id: `${params.messageId}_${params.retryCount}_exhausted`,
    external_contact: params.externalContact,
    severity: "error",
    payload: {
      function_name: "send-whatsapp-message",
      message_id: params.messageId,
      idempotency_key: params.idempotencyKey,
      retry_count: params.retryCount,
      max_retries: params.maxRetries,
      error: params.error,
    },
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
    const { message_id, idempotency_key } = await req.json();
    if (!message_id) {
      return json({ error: "message_id is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .select("id, conversation_id, org_id, content, sender, channel, direction, send_status, metadata")
      .eq("id", message_id)
      .single();

    if (msgErr || !message) {
      return json({ error: "Message not found" }, 404);
    }

    if (message.direction !== "outbound") {
      return json({ error: "Message is not outbound" }, 400);
    }
    if (!["unsent", "failed", "queued"].includes(message.send_status)) {
      return json({ error: `Message already in state: ${message.send_status}` }, 400);
    }

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, merchant_id, external_contact, org_id")
      .eq("id", message.conversation_id)
      .single();

    if (convErr || !conv) {
      return json({ error: "Conversation not found" }, 404);
    }
    if (conv.org_id !== message.org_id) {
      return json({ error: "Org mismatch" }, 403);
    }

    const { data: merchant, error: merchErr } = await supabase
      .from("merchants")
      .select("id, org_id, whatsapp_phone_number_id, whatsapp_access_token")
      .eq("id", conv.merchant_id)
      .single();

    if (merchErr || !merchant) {
      return json({ error: "Merchant not found" }, 404);
    }

    if (!merchant.whatsapp_phone_number_id || !merchant.whatsapp_access_token) {
      return json({ error: "Merchant WhatsApp not configured (missing phone_number_id or access_token)" }, 400);
    }

    const { data: subscription } = await supabase
      .from("org_subscriptions")
      .select("status,messages_used,trial_ends_at,subscription_plans(message_limit)")
      .eq("org_id", message.org_id)
      .maybeSingle();

    const subStatus = subscription?.status ?? "trial";
    const trialExpired = subStatus === "trial" &&
      !!subscription?.trial_ends_at &&
      new Date(subscription.trial_ends_at).getTime() <= Date.now();
    const messageLimit = subscription?.subscription_plans?.message_limit ?? 0;
    const messagesUsed = subscription?.messages_used ?? 0;
    const overQuota = messageLimit > 0 && messagesUsed >= messageLimit;

    if (!["active", "trial"].includes(subStatus) || trialExpired || overQuota) {
      const blockReason = overQuota
        ? `Message quota exceeded (${messagesUsed}/${messageLimit})`
        : trialExpired
          ? "Trial expired"
          : `Subscription status ${subStatus} blocks outbound sends`;

      await supabase.from("channel_events").insert({
        org_id: message.org_id,
        merchant_id: merchant.id,
        channel: "whatsapp",
        provider: "meta",
        event_type: "quota_block",
        provider_event_id: `quota_block_${message_id}_${Date.now()}`,
        external_contact: conv.external_contact,
        severity: "warning",
        payload: {
          function_name: "send-whatsapp-message",
          message_id,
          status: subStatus,
          trial_expired: trialExpired,
          messages_used: messagesUsed,
          message_limit: messageLimit,
          reason: blockReason,
        },
      });

      await supabase
        .from("messages")
        .update({ send_status: "failed", send_error: blockReason })
        .eq("id", message_id);

      return json({
        ok: false,
        error: blockReason,
        send_status: "failed",
      }, 402);
    }

    const resolvedIdempotencyKey = idempotency_key ?? `msg:${message_id}`;

    const { data: existingJob, error: existingJobError } = await supabase
      .from("outbound_jobs")
      .select("id, org_id, message_id, status, retry_count, max_retries, attempts")
      .eq("idempotency_key", resolvedIdempotencyKey)
      .maybeSingle();

    if (existingJobError) {
      console.error("outbound_jobs lookup error:", existingJobError);
      return json({ error: "Failed to load outbound job" }, 500);
    }

    if (existingJob?.message_id && existingJob.message_id !== message_id) {
      return json({ error: "Idempotency key already used for another message" }, 409);
    }

    if (existingJob?.status === "sent") {
      return json({ ok: true, message_id, send_status: "sent", note: "Already sent" });
    }

    if (existingJob?.status === "sending") {
      return json({ ok: false, error: "Send already in progress" }, 409);
    }

    let jobId: string;
    let retryCount = existingJob?.retry_count ?? 0;
    const maxRetries = existingJob?.max_retries ?? 5;

    if (existingJob) {
      const { error: updateJobError } = await supabase
        .from("outbound_jobs")
        .update({
          status: "sending",
          message_id,
          conversation_id: conv.id,
          merchant_id: merchant.id,
          channel: "whatsapp",
          provider: "meta",
          last_error: null,
          next_retry_at: null,
          updated_at: nowIso(),
        })
        .eq("id", existingJob.id);

      if (updateJobError) {
        console.error("outbound_jobs update error:", updateJobError);
        return json({ error: "Failed to update send job" }, 500);
      }

      jobId = existingJob.id;
    } else {
      const { data: newJob, error: jobErr } = await supabase
        .from("outbound_jobs")
        .insert({
          org_id: message.org_id,
          merchant_id: merchant.id,
          conversation_id: conv.id,
          message_id,
          channel: "whatsapp",
          provider: "meta",
          status: "sending",
          retry_count: 0,
          max_retries: 5,
          next_retry_at: nowIso(),
          idempotency_key: resolvedIdempotencyKey,
          attempts: 0,
        })
        .select("id, retry_count, max_retries")
        .single();

      if (jobErr) {
        if (jobErr.code === "23505") {
          return json({ ok: false, error: "Duplicate send request" }, 409);
        }
        console.error("outbound_jobs insert error:", jobErr);
        return json({ error: "Failed to create send job" }, 500);
      }

      jobId = newJob.id;
      retryCount = newJob.retry_count ?? 0;
    }

    await supabase
      .from("messages")
      .update({ send_status: "sending", send_error: null })
      .eq("id", message_id);

    const waUrl = `https://graph.facebook.com/v24.0/${merchant.whatsapp_phone_number_id}/messages`;
    const waPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: conv.external_contact,
      type: "text",
      text: { body: message.content },
    };

    const queueRetry = async (reason: string, isRetriable: boolean) => {
      if (!isRetriable) {
        await supabase
          .from("messages")
          .update({
            send_status: "failed",
            send_error: reason,
            metadata: {
              ...(typeof message.metadata === "object" && message.metadata ? message.metadata : {}),
              outbound: { send_error: reason },
            },
          })
          .eq("id", message_id);

        await supabase
          .from("outbound_jobs")
          .update({
            status: "failed",
            last_error: reason,
            attempts: (existingJob?.attempts ?? 0) + 1,
            updated_at: nowIso(),
          })
          .eq("id", jobId);

        return json({ ok: false, error: reason, send_status: "failed", retriable: false }, 502);
      }

      const nextRetryCount = retryCount + 1;
      const exceeded = nextRetryCount > maxRetries;

      if (exceeded) {
        await supabase
          .from("messages")
          .update({
            send_status: "failed",
            send_error: reason,
            metadata: {
              ...(typeof message.metadata === "object" && message.metadata ? message.metadata : {}),
              outbound: { send_error: reason, retry_exhausted: true },
            },
          })
          .eq("id", message_id);

        await supabase
          .from("outbound_jobs")
          .update({
            status: "failed",
            retry_count: nextRetryCount,
            attempts: (existingJob?.attempts ?? 0) + 1,
            last_error: reason,
            next_retry_at: null,
            updated_at: nowIso(),
          })
          .eq("id", jobId);

        await emitRetryExhaustedEvent(supabase, {
          orgId: message.org_id,
          merchantId: merchant.id,
          externalContact: conv.external_contact,
          messageId: message_id,
          idempotencyKey: resolvedIdempotencyKey,
          retryCount: nextRetryCount,
          maxRetries,
          error: reason,
        });

        return json(
          { ok: false, error: reason, send_status: "failed", retry_count: nextRetryCount, max_retries: maxRetries },
          502,
        );
      }

      const backoffSeconds = computeBackoffSeconds(nextRetryCount);
      const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      await supabase
        .from("messages")
        .update({
          send_status: "queued",
          send_error: reason,
          metadata: {
            ...(typeof message.metadata === "object" && message.metadata ? message.metadata : {}),
            outbound: {
              send_error: reason,
              retry_count: nextRetryCount,
              max_retries: maxRetries,
              next_retry_at: nextRetryAt,
            },
          },
        })
        .eq("id", message_id);

      await supabase
        .from("outbound_jobs")
        .update({
          status: "queued",
          retry_count: nextRetryCount,
          attempts: (existingJob?.attempts ?? 0) + 1,
          last_error: reason,
          next_retry_at: nextRetryAt,
          updated_at: nowIso(),
        })
        .eq("id", jobId);

      return json(
        {
          ok: false,
          error: reason,
          send_status: "queued",
          retry_count: nextRetryCount,
          max_retries: maxRetries,
          next_retry_at: nextRetryAt,
        },
        202,
      );
    };

    try {
      const waRes = await fetch(waUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${merchant.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(waPayload),
      });

      const waBody = await waRes.json();

      if (waRes.ok) {
        const providerMessageId = waBody?.messages?.[0]?.id ?? null;

        await supabase
          .from("messages")
          .update({
            send_status: "sent",
            sent_at: nowIso(),
            provider: "meta",
            provider_message_id: providerMessageId,
            channel: "whatsapp",
            delivery_status: "sent",
            metadata: {
              ...(typeof message.metadata === "object" && message.metadata ? message.metadata : {}),
              outbound: { send_response: waBody },
            },
          })
          .eq("id", message_id);

        await supabase
          .from("outbound_jobs")
          .update({
            status: "sent",
            last_error: null,
            next_retry_at: null,
            attempts: (existingJob?.attempts ?? 0) + 1,
            updated_at: nowIso(),
          })
          .eq("id", jobId);

        await supabase.rpc("increment_org_messages_used", {
          p_org_id: message.org_id,
          p_message_id: message_id,
        });

        return json({
          ok: true,
          message_id,
          provider_message_id: providerMessageId,
          send_status: "sent",
        });
      }

      const metaError = waBody?.error ?? waBody;
      const metaCode = typeof metaError?.code === "number" ? metaError.code : undefined;
      const metaDetails = metaError?.error_data?.details ?? metaError?.message ?? "Unknown provider error";
      const errorMsg = truncateError(metaError);
      const retriable = waRes.status >= 500;

      if (metaCode === 131030) {
        return await queueRetry(
          "Recipient phone number not in allowed list. Add the phone number in your Meta app test recipient list and retry.",
          false,
        );
      }

      const retryResponse = await queueRetry(errorMsg, retriable);

      if (retryResponse.status === 202 || retryResponse.status === 502) {
        const payload = await retryResponse.clone().json();
        return json({ ...payload, meta_code: metaCode, meta_details: metaDetails }, retryResponse.status);
      }

      return retryResponse;
    } catch (fetchErr) {
      const errorMsg = truncateError(String(fetchErr));
      return await queueRetry(errorMsg, true);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
