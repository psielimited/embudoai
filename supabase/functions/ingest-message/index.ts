/**
 * Edge Function: ingest-message
 * 
 * POST /functions/v1/ingest-message
 * 
 * Identity resolution: resolves external_contact to a CRM lead/contact
 * via contact_channels. Creates a lead if no mapping exists.
 * Optionally links a single open opportunity from the default pipeline.
 * 
 * Response: { conversation_id, message_id, lead_id, contact_id }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface IngestRequest {
  merchant_id: string;
  external_contact: string;
  content: string;
  sender?: "user" | "ai" | "human";
}

function normalizeContact(raw: string): string {
  let s = raw.trim().replace(/\s+/g, "");
  // Keep leading + if present
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: IngestRequest = await req.json();

    if (!body.merchant_id || !body.external_contact || !body.content) {
      return new Response(
        JSON.stringify({ error: "merchant_id, external_contact, content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validSenders = ["user", "ai", "human"];
    const sender = body.sender || "user";
    if (!validSenders.includes(sender)) {
      return new Response(
        JSON.stringify({ error: "sender must be one of: user, ai, human" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Derive org_id from merchant
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, org_id")
      .eq("id", body.merchant_id)
      .single();

    if (merchantError || !merchant) {
      return new Response(
        JSON.stringify({ error: "Merchant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId: string = merchant.org_id;
    const extNorm = normalizeContact(body.external_contact);

    // 2. Identity resolution via contact_channels
    let contactId: string | null = null;
    let leadId: string | null = null;

    const { data: channel } = await supabase
      .from("contact_channels")
      .select("id, contact_id, lead_id")
      .eq("org_id", orgId)
      .eq("channel", "whatsapp")
      .eq("external_contact", extNorm)
      .maybeSingle();

    if (channel) {
      contactId = channel.contact_id ?? null;
      leadId = channel.lead_id ?? null;
    } else {
      // Create a new lead
      const { data: newLead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          org_id: orgId,
          full_name: extNorm,
          phones: [extNorm],
          source: "whatsapp",
          status: "open",
        })
        .select("id")
        .single();

      if (leadErr || !newLead) {
        console.error("Lead creation error:", leadErr);
        return new Response(
          JSON.stringify({ error: "Failed to create lead for identity resolution" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      leadId = newLead.id;

      // Create contact_channels mapping
      const { error: ccErr } = await supabase
        .from("contact_channels")
        .insert({
          org_id: orgId,
          channel: "whatsapp",
          external_contact: extNorm,
          lead_id: leadId,
        });

      if (ccErr) {
        console.error("contact_channels insert error:", ccErr);
        // Non-fatal: lead was created, continue
      }
    }

    // 3. Upsert conversation
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id, contact_id, lead_id, opportunity_id")
      .eq("merchant_id", body.merchant_id)
      .eq("external_contact", body.external_contact)
      .maybeSingle();

    let conversationId: string;
    let opportunityId: string | null = null;

    if (existingConv) {
      conversationId = existingConv.id;

      // Backfill linkage if missing
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (!existingConv.contact_id && !existingConv.lead_id) {
        if (contactId) updates.contact_id = contactId;
        else if (leadId) updates.lead_id = leadId;
      }

      // Use existing linkage for response
      contactId = contactId ?? existingConv.contact_id;
      leadId = leadId ?? existingConv.lead_id;
      opportunityId = existingConv.opportunity_id;

      await supabase
        .from("conversations")
        .update(updates)
        .eq("id", existingConv.id);
    } else {
      const insertData: Record<string, unknown> = {
        merchant_id: body.merchant_id,
        external_contact: body.external_contact,
        status: "open",
        org_id: orgId,
      };
      if (contactId) insertData.contact_id = contactId;
      else if (leadId) insertData.lead_id = leadId;

      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert(insertData)
        .select("id")
        .single();

      if (convErr || !newConv) {
        console.error("Conversation create error:", convErr);
        return new Response(
          JSON.stringify({ error: "Failed to create conversation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      conversationId = newConv.id;
    }

    // 4. Optional: attach single open opportunity from default pipeline
    if (!opportunityId) {
      const personId = contactId || leadId;
      if (personId) {
        // Find default pipeline for this org
        const { data: defPipeline } = await supabase
          .from("pipelines")
          .select("id")
          .eq("org_id", orgId)
          .eq("is_default", true)
          .maybeSingle();

        if (defPipeline) {
          // Check for exactly one open opportunity for this person
          const personCol = contactId ? "contact_id" : "lead_id";
          // Opportunities don't have contact_id/lead_id columns directly,
          // so we skip this for now — would need a join table or column addition
          // This is a no-op until opportunities have person linkage
        }
      }
    }

    // 5. Insert message
    const { data: newMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender,
        content: body.content,
        org_id: orgId,
      })
      .select("id")
      .single();

    if (messageError || !newMessage) {
      console.error("Message error:", messageError);
      return new Response(
        JSON.stringify({ error: "Failed to insert message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Trigger AI draft generation if sender is 'user'
    let aiQueued = false;
    if (sender === "user") {
      try {
        await supabase
          .from("conversations")
          .update({ ai_status: "queued" })
          .eq("id", conversationId);

        // Fire-and-forget call to generate-ai-reply
        const fnUrl = `${supabaseUrl}/functions/v1/generate-ai-reply`;
        fetch(fnUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            trigger_message_id: newMessage.id,
          }),
        }).catch((e) => console.error("generate-ai-reply fire-and-forget error:", e));

        aiQueued = true;
      } catch (e) {
        console.error("Failed to queue AI generation:", e);
      }
    }

    return new Response(
      JSON.stringify({
        conversation_id: conversationId,
        message_id: newMessage.id,
        lead_id: leadId,
        contact_id: contactId,
        ai_queued: aiQueued,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
