/**
 * Edge Function: whatsapp-webhook
 *
 * GET  → Meta verify-token handshake
 * POST → Ingest inbound messages + status updates with signature verification
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ─────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return expected === signatureHeader;
}

// ── Message normalization ───────────────────────────────────────────

interface NormalizedMessage {
  content: string;
  metadata: Record<string, unknown>;
}

function normalizeWhatsAppMessage(raw: Record<string, unknown>): NormalizedMessage {
  const type = raw.type as string;

  if (type === "text") {
    const text = raw.text as { body: string } | undefined;
    return { content: text?.body ?? "", metadata: { wa_type: "text" } };
  }

  if (type === "interactive") {
    const interactive = raw.interactive as Record<string, unknown> | undefined;
    if (interactive) {
      const interactiveType = interactive.type as string;
      if (interactiveType === "button_reply") {
        const reply = interactive.button_reply as { id: string; title: string };
        return {
          content: reply?.title ?? "[button reply]",
          metadata: { wa_type: "interactive", interactive: { type: "button", id: reply?.id, title: reply?.title } },
        };
      }
      if (interactiveType === "list_reply") {
        const reply = interactive.list_reply as { id: string; title: string; description?: string };
        return {
          content: reply?.title ?? "[list reply]",
          metadata: { wa_type: "interactive", interactive: { type: "list", id: reply?.id, title: reply?.title, description: reply?.description } },
        };
      }
    }
    return { content: "[interactive]", metadata: { wa_type: "interactive", raw_interactive: interactive } };
  }

  if (type === "button") {
    const button = raw.button as { text: string; payload: string } | undefined;
    return {
      content: button?.text ?? "[button]",
      metadata: { wa_type: "button", payload: button?.payload },
    };
  }

  // image/video/document/audio/sticker/location/contacts – store type + metadata
  if (["image", "video", "document", "audio", "sticker", "location", "contacts"].includes(type)) {
    const mediaPayload = raw[type] as Record<string, unknown> | undefined;
    const caption = (mediaPayload?.caption as string) ?? undefined;
    return {
      content: caption ?? `[${type}]`,
      metadata: { wa_type: type, [type]: mediaPayload },
    };
  }

  return { content: `[${type ?? "unknown"}]`, metadata: { wa_type: type, raw: raw } };
}

// ── Main ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── GET: Webhook verification ───────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode !== "subscribe" || !token || !challenge) {
      return json({ error: "Missing verification params" }, 400);
    }

    // Look up merchant by verify token
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id")
      .eq("whatsapp_verify_token", token)
      .maybeSingle();

    if (!merchant) {
      return new Response("Forbidden", { status: 403 });
    }

    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // ── POST: Event processing ──────────────────────────────────────
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const rawBody = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    // Navigate Meta webhook structure
    const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
    const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
    const value = changes?.value as Record<string, unknown> | undefined;

    if (!value) {
      return json({ ok: true, skipped: true }, 200);
    }

    const metadata = value.metadata as { phone_number_id?: string } | undefined;
    const phoneNumberId = metadata?.phone_number_id;

    if (!phoneNumberId) {
      return json({ ok: true, skipped: true }, 200);
    }

    // Look up merchant
    const { data: merchant, error: merchantErr } = await supabase
      .from("merchants")
      .select("id, org_id, whatsapp_app_secret")
      .eq("whatsapp_phone_number_id", phoneNumberId)
      .maybeSingle();

    if (merchantErr || !merchant) {
      console.error("Merchant not found for phone_number_id:", phoneNumberId);
      return json({ ok: true, skipped: true }, 200);
    }

    // Signature verification
    const appSecret = merchant.whatsapp_app_secret;
    if (appSecret) {
      const sigHeader = req.headers.get("x-hub-signature-256");
      const valid = await verifySignature(appSecret, rawBody, sigHeader);
      if (!valid) {
        console.error("Invalid signature for merchant:", merchant.id);
        return new Response("Forbidden", { status: 403 });
      }
    }

    const orgId = merchant.org_id;
    const results = { messages_processed: 0, statuses_processed: 0, skipped: 0 };

    // ── Process inbound messages ────────────────────────────────
    const messages = (value.messages as Array<Record<string, unknown>>) ?? [];
    for (const rawMsg of messages) {
      const providerMessageId = rawMsg.id as string;
      const from = rawMsg.from as string;

      if (!providerMessageId || !from) {
        results.skipped++;
        continue;
      }

      // Insert channel_event (idempotent)
      const { error: ceErr } = await supabase
        .from("channel_events")
        .insert({
          org_id: orgId,
          merchant_id: merchant.id,
          channel: "whatsapp",
          provider: "meta",
          event_type: "message",
          provider_event_id: providerMessageId,
          external_contact: from,
          payload: rawMsg,
        });

      if (ceErr) {
        if (ceErr.code === "23505") {
          // Duplicate – already processed
          results.skipped++;
          continue;
        }
        console.error("channel_events insert error:", ceErr);
        results.skipped++;
        continue;
      }

      // Normalize message
      const { content, metadata: msgMeta } = normalizeWhatsAppMessage(rawMsg);

      // Call ingest-message
      const ingestUrl = `${supabaseUrl}/functions/v1/ingest-message`;
      try {
        const ingestRes = await fetch(ingestUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            merchant_id: merchant.id,
            external_contact: from,
            content,
            sender: "user",
            channel: "whatsapp",
            provider: "meta",
            provider_message_id: providerMessageId,
            metadata: msgMeta,
          }),
        });

        if (ingestRes.ok) {
          // Mark processed
          await supabase
            .from("channel_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("org_id", orgId)
            .eq("channel", "whatsapp")
            .eq("provider", "meta")
            .eq("event_type", "message")
            .eq("provider_event_id", providerMessageId);

          results.messages_processed++;
        } else {
          const err = await ingestRes.text();
          console.error("ingest-message failed:", err);
          results.skipped++;
        }
      } catch (e) {
        console.error("ingest-message call error:", e);
        results.skipped++;
      }
    }

    // ── Process status events ───────────────────────────────────
    const statuses = (value.statuses as Array<Record<string, unknown>>) ?? [];
    for (const status of statuses) {
      const providerMessageId = status.id as string;
      const deliveryStatus = status.status as string;
      const recipientId = status.recipient_id as string;
      const timestamp = status.timestamp as string | undefined;

      if (!providerMessageId || !deliveryStatus) {
        results.skipped++;
        continue;
      }

      // Insert channel_event (idempotent)
      const { error: ceErr } = await supabase
        .from("channel_events")
        .insert({
          org_id: orgId,
          merchant_id: merchant.id,
          channel: "whatsapp",
          provider: "meta",
          event_type: "status",
          provider_event_id: `${providerMessageId}_${deliveryStatus}`,
          external_contact: recipientId ?? null,
          payload: status,
        });

      if (ceErr) {
        if (ceErr.code === "23505") {
          results.skipped++;
          continue;
        }
        console.error("channel_events status insert error:", ceErr);
      }

      // Update the message row
      const updates: Record<string, unknown> = { delivery_status: deliveryStatus };
      const ts = timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString();

      if (deliveryStatus === "delivered") updates.delivered_at = ts;
      if (deliveryStatus === "read") {
        updates.read_at = ts;
        if (!updates.delivered_at) updates.delivered_at = ts;
      }
      if (deliveryStatus === "failed") updates.failed_at = ts;

      const { error: msgErr } = await supabase
        .from("messages")
        .update(updates)
        .eq("org_id", orgId)
        .eq("channel", "whatsapp")
        .eq("provider", "meta")
        .eq("provider_message_id", providerMessageId);

      if (msgErr) {
        console.error("Message status update error:", msgErr);
      } else {
        results.statuses_processed++;
      }
    }

    return json({ ok: true, ...results }, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
