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
 * Response:
 *   Success (200): { "conversation_id": "<uuid>", "message_id": "<uuid>" }
 *   Error (400/500): { "error": "<message>" }
 * 
 * Sample curl:
 *   curl -X POST "https://aieeppwgsmjigvwoeaar.supabase.co/functions/v1/ingest-message" \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *       "merchant_id":"00000000-0000-0000-0000-000000000000",
 *       "external_contact":"+18095551212",
 *       "content":"Hola, quiero informacion"
 *     }'
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse request body
    const body: IngestRequest = await req.json();

    // Validate required fields
    if (!body.merchant_id || !body.external_contact || !body.content) {
      return new Response(
        JSON.stringify({ error: "merchant_id, external_contact, content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate sender if provided
    const validSenders = ["user", "ai", "human"];
    const sender = body.sender || "user";
    if (!validSenders.includes(sender)) {
      return new Response(
        JSON.stringify({ error: "sender must be one of: user, ai, human" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      // Update existing conversation timestamp
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
      // Create new conversation
      const { data: newConversation, error: createError } = await supabase
        .from("conversations")
        .insert({
          merchant_id: body.merchant_id,
          external_contact: body.external_contact,
          status: "open",
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

    // Insert message
    const { data: newMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender: sender,
        content: body.content,
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

    // Return success
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
