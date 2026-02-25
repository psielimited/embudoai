import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-flash-preview";

type AssistRequest = {
  conversation_id: string;
  handoff_id?: string;
  trigger?: "manual" | "auto";
  reason_code?: string;
  reason_text?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function truncate(value: unknown, max = 500) {
  let raw = "";
  try {
    raw = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    raw = String(value);
  }
  return raw.slice(0, max);
}

function normalizeLanguage(languageHint: unknown) {
  if (typeof languageHint !== "string" || !languageHint.trim()) return "es";
  return languageHint.toLowerCase().slice(0, 12);
}

function parseOutput(content: string) {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const noFence = trimmed.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    return JSON.parse(noFence);
  }
}

function buildSummary(messages: Array<{ sender: string; content: string }>) {
  const recentUser = [...messages].reverse().find((m) => m.sender === "user");
  const previous = [...messages].reverse().slice(0, 4).map((m) => m.content).join(" | ");
  const focus = recentUser?.content ?? "No user message yet.";
  return `${focus} Context: ${previous}`.slice(0, 700);
}

async function isOrgMemberForConversation(userClient: ReturnType<typeof createClient>, conversationId: string) {
  const { data: conv, error: convErr } = await userClient
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr) return false;
  return !!conv?.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey || !lovableApiKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const body = (await req.json()) as AssistRequest;
    if (!body.conversation_id) return json({ error: "conversation_id is required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const service = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (token !== serviceKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: userErr,
      } = await userClient.auth.getUser();
      if (userErr || !user) return json({ error: "Unauthorized" }, 401);

      const member = await isOrgMemberForConversation(userClient, body.conversation_id);
      if (!member) return json({ error: "Forbidden" }, 403);
    }

    const [{ data: conv }, { data: messages }] = await Promise.all([
      service
        .from("conversations")
        .select(
          "id,org_id,merchant_id,external_contact,status,last_intent,last_entities,lead_score,lead_score_reason,opportunity_id",
        )
        .eq("id", body.conversation_id)
        .maybeSingle(),
      service
        .from("messages")
        .select("id,sender,direction,content,created_at")
        .eq("conversation_id", body.conversation_id)
        .order("created_at", { ascending: true })
        .limit(40),
    ]);

    if (!conv) return json({ error: "Conversation not found" }, 404);

    const [merchantRes, opportunityRes] = await Promise.all([
      service.from("merchants").select("id,name").eq("id", conv.merchant_id).maybeSingle(),
      conv.opportunity_id
        ? service
          .from("opportunities")
          .select("id,name,stage_id,stages(name),pipeline_id,pipelines(name)")
          .eq("id", conv.opportunity_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const merchantName = merchantRes.data?.name ?? "Merchant";
    const messageRows = (messages ?? []).map((m) => ({
      id: m.id,
      sender: m.sender,
      direction: m.direction,
      created_at: m.created_at,
      content: m.content,
    }));
    const summary = buildSummary(messageRows);

    const languageHint = normalizeLanguage(
      (conv.last_entities as Record<string, unknown> | null)?.language ??
        (conv.last_entities as Record<string, unknown> | null)?.lang ??
        conv.last_intent,
    );

    const packet = {
      customer_summary: summary,
      last_messages: messageRows.slice(-20),
      extracted: {
        intent: conv.last_intent,
        entities: conv.last_entities ?? {},
        lead_score: conv.lead_score,
        lead_score_reason: conv.lead_score_reason ?? {},
      },
      opportunity: opportunityRes.data
        ? {
          id: opportunityRes.data.id,
          name: opportunityRes.data.name,
          stage: (opportunityRes.data as any)?.stages?.name ?? null,
          pipeline: (opportunityRes.data as any)?.pipelines?.name ?? null,
        }
        : null,
      suggested_questions: [],
      constraints: ["Do not invent prices/policies", "Human review required"],
    };

    const aiPrompt = `
You are Embudex human-assist generator for merchant "${merchantName}".
Return ONLY valid JSON with this schema:
{
  "language":"es|en|...",
  "replies":[
    {"text":"...", "tone":"professional|friendly|firm", "intent":"clarify|quote_request|deescalate|apology|handoff_ack", "confidence":0.0}
  ],
  "next_steps":[
    {"title":"...", "details":"...", "priority":"high|medium|low"}
  ],
  "questions":["..."],
  "risks":["..."]
}
Rules:
- Never auto-send. These are suggestions for a human agent.
- Replies must be ready to send in WhatsApp.
- Max 5 replies, max 6 next_steps.
- If abuse/legal threats, include firm boundary-setting reply.
- Never invent pricing/refund/policy details; ask for missing info when needed.
- Use same language as customer.
`.trim();

    const historyExcerpt = messageRows.slice(-12).map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content,
    }));

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: aiPrompt },
          {
            role: "user",
            content: JSON.stringify({
              reason_code: body.reason_code ?? null,
              reason_text: body.reason_text ?? null,
              handoff_packet: packet,
              history: historyExcerpt,
              customer_language_hint: languageHint,
            }),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      return json({ error: "AI generation failed", details: truncate(err, 300) }, 502);
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return json({ error: "AI response empty" }, 502);
    }

    const parsed = parseOutput(content) as Record<string, unknown>;
    const replies = Array.isArray(parsed.replies) ? parsed.replies.slice(0, 5) : [];
    const nextSteps = Array.isArray(parsed.next_steps) ? parsed.next_steps.slice(0, 6) : [];
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const risks = Array.isArray(parsed.risks) ? parsed.risks : [];
    const language = normalizeLanguage(parsed.language ?? languageHint);

    await service
      .from("conversation_suggestions")
      .update({ status: "expired" })
      .eq("org_id", conv.org_id)
      .eq("conversation_id", conv.id)
      .eq("status", "active");

    const { data: suggestion, error: suggestionErr } = await service
      .from("conversation_suggestions")
      .insert({
        org_id: conv.org_id,
        merchant_id: conv.merchant_id,
        conversation_id: conv.id,
        handoff_id: body.handoff_id ?? null,
        status: "active",
        language,
        suggestions: {
          replies,
          next_steps: nextSteps,
          questions,
          risks,
        },
      })
      .select("id")
      .single();

    if (suggestionErr || !suggestion) {
      return json({ error: "Failed to persist suggestions", details: truncate(suggestionErr) }, 500);
    }

    await service.from("channel_events").insert({
      org_id: conv.org_id,
      merchant_id: conv.merchant_id,
      channel: "whatsapp",
      provider: "meta",
      event_type: "suggestions_generated",
      provider_event_id: `suggestions_${conv.id}_${Date.now()}`,
      external_contact: conv.external_contact,
      severity: "info",
      payload: {
        function_name: "ai-handoff-assist",
        suggestion_id: suggestion.id,
        handoff_id: body.handoff_id ?? null,
        trigger: body.trigger ?? "manual",
      },
    });

    return json({
      ok: true,
      suggestion_id: suggestion.id,
      handoff_id: body.handoff_id ?? null,
    });
  } catch (error) {
    console.error("ai-handoff-assist error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
