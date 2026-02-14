/**
 * Edge Function: send-whatsapp-message
 *
 * Sends an outbound WhatsApp message via the Cloud API.
 * Input: { message_id }
 * Validates direction=outbound, send_status in (unsent, failed), channel=whatsapp.
 * Uses outbound_jobs for idempotency.
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
    const { message_id } = await req.json();
    if (!message_id) {
      return json({ error: "message_id is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Load message
    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .select("id, conversation_id, org_id, content, sender, channel, direction, send_status, metadata")
      .eq("id", message_id)
      .single();

    if (msgErr || !message) {
      return json({ error: "Message not found" }, 404);
    }

    // Validate
    if (message.direction !== "outbound") {
      return json({ error: "Message is not outbound" }, 400);
    }
    if (!["unsent", "failed"].includes(message.send_status)) {
      return json({ error: `Message already in state: ${message.send_status}` }, 400);
    }

    // 2. Load conversation
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, merchant_id, external_contact, org_id")
      .eq("id", message.conversation_id)
      .single();

    if (convErr || !conv) {
      return json({ error: "Conversation not found" }, 404);
    }

    // Org check
    if (conv.org_id !== message.org_id) {
      return json({ error: "Org mismatch" }, 403);
    }

    // 3. Load merchant config
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

    // 4. Upsert outbound_job for idempotency
    const { data: existingJob } = await supabase
      .from("outbound_jobs")
      .select("id, status")
      .eq("org_id", message.org_id)
      .eq("message_id", message_id)
      .maybeSingle();

    if (existingJob && existingJob.status === "sent") {
      return json({ ok: true, message_id, send_status: "sent", note: "Already sent" });
    }

    if (existingJob && existingJob.status === "sending") {
      return json({ ok: false, error: "Send already in progress" }, 409);
    }

    let jobId: string;
    if (existingJob) {
      // Update existing failed job
      await supabase
        .from("outbound_jobs")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", existingJob.id);
      jobId = existingJob.id;
    } else {
      const { data: newJob, error: jobErr } = await supabase
        .from("outbound_jobs")
        .insert({
          org_id: message.org_id,
          merchant_id: merchant.id,
          conversation_id: conv.id,
          message_id: message_id,
          channel: "whatsapp",
          provider: "meta",
          status: "sending",
        })
        .select("id")
        .single();

      if (jobErr) {
        // Unique conflict = another request beat us
        if (jobErr.code === "23505") {
          return json({ ok: false, error: "Duplicate send request" }, 409);
        }
        console.error("outbound_jobs insert error:", jobErr);
        return json({ error: "Failed to create send job" }, 500);
      }
      jobId = newJob!.id;
    }

    // 5. Update message to sending
    await supabase.from("messages").update({ send_status: "sending", send_error: null }).eq("id", message_id);

    // 6. Call WhatsApp Cloud API
    const waUrl = `https://graph.facebook.com/v24.0/${merchant.whatsapp_phone_number_id}/messages`;

    // Build payload — text for now, metadata can carry template info later
    const waPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: conv.external_contact,
      type: "text",
      text: { body: message.content },
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
        // Success
        const providerMessageId = waBody?.messages?.[0]?.id ?? null;

        await supabase
          .from("messages")
          .update({
            send_status: "sent",
            sent_at: new Date().toISOString(),
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
          .update({ status: "sent", updated_at: new Date().toISOString() })
          .eq("id", jobId);

        return json({
          ok: true,
          message_id,
          provider_message_id: providerMessageId,
          send_status: "sent",
        });
      } else {
        // WhatsApp API error
        const errorMsg = JSON.stringify(waBody?.error ?? waBody).slice(0, 500);
        console.error("WhatsApp API error:", errorMsg);

        await supabase
          .from("messages")
          .update({
            send_status: "failed",
            send_error: errorMsg,
            metadata: {
              ...(typeof message.metadata === "object" && message.metadata ? message.metadata : {}),
              outbound: { send_error: waBody },
            },
          })
          .eq("id", message_id);

        const attempts = (existingJob?.status ? 1 : 0) + 1;
        await supabase
          .from("outbound_jobs")
          .update({
            status: "failed",
            attempts,
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return json({ ok: false, error: errorMsg, send_status: "failed" }, 502);
      }
    } catch (fetchErr) {
      const errorMsg = String(fetchErr).slice(0, 500);
      console.error("WhatsApp API fetch error:", errorMsg);

      await supabase.from("messages").update({ send_status: "failed", send_error: errorMsg }).eq("id", message_id);

      await supabase
        .from("outbound_jobs")
        .update({
          status: "failed",
          last_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return json({ ok: false, error: errorMsg, send_status: "failed" }, 502);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
