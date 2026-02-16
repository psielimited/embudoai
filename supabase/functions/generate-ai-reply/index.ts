/**
 * Edge Function: generate-ai-reply
 *
 * POST /functions/v1/generate-ai-reply
 * Body: { conversation_id, trigger_message_id }
 *
 * Loads conversation context, calls Lovable AI gateway,
 * stores the AI draft as messages(sender='ai').
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  conversation_id: string;
  trigger_message_id?: string;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: GenerateRequest = await req.json();

    if (!body.conversation_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Load conversation
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, org_id, merchant_id, external_contact, ai_enabled, ai_status, ai_paused, status")
      .eq("id", body.conversation_id)
      .single();

    if (convErr || !conv) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI governance: skip if disabled, paused, or needs_handoff
    if (!conv.ai_enabled || conv.ai_paused || conv.status === "needs_handoff") {
      console.log(`AI skipped for conversation ${conv.id}: enabled=${conv.ai_enabled}, paused=${conv.ai_paused}, status=${conv.status}`);
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!lovableApiKey) {
      await supabase
        .from("conversations")
        .update({ ai_status: "failed", ai_last_error: "LOVABLE_API_KEY not configured" })
        .eq("id", conv.id);
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set status to generating
    await supabase
      .from("conversations")
      .update({ ai_status: "generating" })
      .eq("id", conv.id);

    // 2. Load merchant name
    const { data: merchant } = await supabase
      .from("merchants")
      .select("name")
      .eq("id", conv.merchant_id)
      .single();

    const merchantName = merchant?.name ?? "the business";

    // 3. Load last 20 messages
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender, content, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // 4. Build prompt
    const systemPrompt = `You are Embudex, an AI customer service assistant for "${merchantName}". Rules:
- Be concise and helpful.
- Ask at most 1 clarifying question per reply.
- If information is missing, politely request it.
- Do not make up information about products, prices, or policies.
- Respond in the same language the customer is using.`;

    const chatMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of messages) {
      const role = msg.sender === "user" ? "user" : "assistant";
      chatMessages.push({ role, content: msg.content });
    }

    // 5. Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      await supabase
        .from("conversations")
        .update({
          ai_status: "failed",
          ai_last_error: `AI gateway ${aiResponse.status}: ${errText.slice(0, 200)}`,
        })
        .eq("id", conv.id);
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      await supabase
        .from("conversations")
        .update({ ai_status: "failed", ai_last_error: "Empty AI response" })
        .eq("id", conv.id);
      return new Response(
        JSON.stringify({ error: "Empty AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Insert AI message
    const now = new Date().toISOString();
    const metadata = {
      model: "google/gemini-3-flash-preview",
      generated_at: now,
      trigger: "ingest",
      usage: aiData.usage ?? null,
    };

    const insertData: Record<string, unknown> = {
      conversation_id: conv.id,
      sender: "ai",
      content: aiContent,
      org_id: conv.org_id,
      metadata,
    };
    if (body.trigger_message_id) {
      insertData.reply_to_message_id = body.trigger_message_id;
    }

    const { data: newMsg, error: msgErr } = await supabase
      .from("messages")
      .insert(insertData)
      .select("id")
      .single();

    if (msgErr || !newMsg) {
      console.error("Message insert error:", msgErr);
      await supabase
        .from("conversations")
        .update({ ai_status: "failed", ai_last_error: "Failed to store AI message" })
        .eq("id", conv.id);
      return new Response(
        JSON.stringify({ error: "Failed to store AI message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Update conversation status
    await supabase
      .from("conversations")
      .update({
        ai_status: "ready",
        ai_last_generated_at: now,
        ai_last_error: null,
        updated_at: now,
      })
      .eq("id", conv.id);

    return new Response(
      JSON.stringify({
        ok: true,
        message_id: newMsg.id,
        conversation_id: conv.id,
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
