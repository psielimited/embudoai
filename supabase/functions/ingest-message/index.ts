/**
 * Edge Function: ingest-message
 * 
 * Endpoint: POST /functions/v1/ingest-message
 * 
 * Request body (JSON):
 *   Required:
 *     - merchant_id (uuid)
 *     - external_contact (string)
 *     - content (string)
 *   Optional:
 *     - sender (string; default "user"; allowed: user|ai|human)
 * 
 * org_id is derived from the merchant record automatically.
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
  external_message_id?: string;
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

    // Derive org_id from merchant
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, org_id")
      .eq("id", body.merchant_id)
      .single();

    if (merchantError || !merchant) {
      console.error("Merchant lookup error:", merchantError);
      return new Response(
        JSON.stringify({ error: "Merchant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = merchant.org_id;

    // Look up existing conversation
    const { data: existingConversation, error: queryError } = await supabase
      .from("conversations")
      .select("id")
      .eq("merchant_id", body.merchant_id)
      .eq("external_contact", body.external_contact)
      .maybeSingle();

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query conversations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let conversationId: string;

    if (existingConversation) {
      const { error: updateError } = await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existingConversation.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update conversation timestamp" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      conversationId = existingConversation.id;
    } else {
      const { data: newConversation, error: createError } = await supabase
        .from("conversations")
        .insert({
          merchant_id: body.merchant_id,
          external_contact: body.external_contact,
          status: "open",
          org_id: orgId,
        })
        .select("id")
        .single();

      if (createError || !newConversation) {
        console.error("Create error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create conversation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      conversationId = newConversation.id;
    }

    // Insert message with org_id
    const { data: newMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender: sender,
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

    return new Response(
      JSON.stringify({
        conversation_id: conversationId,
        message_id: newMessage.id,
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
