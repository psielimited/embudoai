import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-flash-preview";

type AgentRequest = { conversation_id: string; trigger_message_id?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function noContent(status = 204) {
  return new Response(null, { status, headers: corsHeaders });
}
function truncate(v: unknown, max = 500) {
  try {
    return (typeof v === "string" ? v : JSON.stringify(v)).slice(0, max);
  } catch {
    return String(v).slice(0, max);
  }
}
function parseOutput(content: string) {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return JSON.parse(trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, ""));
  }
}
function normalizeIntent(input?: string) {
  const allowed = new Set(["new_lead", "pricing", "product_question", "availability", "booking", "support", "complaint", "refund", "other"]);
  return allowed.has(input ?? "") ? (input as string) : "other";
}
function normalizeStatus(status?: string | null) {
  const allowed = new Set(["open", "waiting_on_customer", "needs_handoff", "resolved", "closed"]);
  return status && allowed.has(status) ? status : null;
}
function detectPolicyRisk(text: string) {
  const t = text.toLowerCase();
  return ["refund", "chargeback", "cancel", "legal", "lawyer", "demanda", "reembolso", "cancelar"].some((k) => t.includes(k));
}

async function setAiState(supabase: any, conversationId: string, ai_status: string, ai_last_error: string | null) {
  await supabase.from("conversations").update({ ai_status, ai_last_error }).eq("id", conversationId);
}

async function markActionStatus(
  supabase: any,
  actionId: string,
  status: "executed" | "failed" | "skipped",
  error?: string,
) {
  await supabase
    .from("ai_agent_actions")
    .update({
      status,
      error: error ?? null,
      executed_at: status === "executed" ? new Date().toISOString() : null,
    })
    .eq("id", actionId);
}

async function findStageByKey(
  supabase: any,
  orgId: string,
  merchantId: string,
  stageKey: string | undefined,
) {
  if (!stageKey) return null;

  const { data: settings } = await supabase
    .from("merchant_agent_settings")
    .select("stage_mapping")
    .eq("merchant_id", merchantId)
    .eq("org_id", orgId)
    .maybeSingle();

  const mapping = (settings?.stage_mapping ?? {}) as Record<string, string>;
  if (mapping[stageKey]) return mapping[stageKey];

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .maybeSingle();
  if (!pipeline) return null;

  const candidates: Record<string, string[]> = {
    qualified: ["qualified", "contacted"],
    proposal: ["proposal", "quoted"],
    won: ["won"],
    lost: ["lost"],
    needs_follow_up: ["follow up", "follow-up", "followup"],
  };
  const names = candidates[stageKey] ?? [];
  if (!names.length) return null;

  const { data: stages } = await supabase
    .from("stages")
    .select("id,name,position")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });
  const matched = (stages ?? []).find((s: any) => names.some((name) => String(s.name).toLowerCase().includes(name)));
  return matched?.id ?? null;
}

async function createHandoff(
  supabase: any,
  conv: any,
  runId: string | null,
  reasonCode: string,
  reasonText: string,
  extracted: Record<string, unknown>,
  triggerMessageId?: string,
) {
  const [{ data: messages }, { data: opp }] = await Promise.all([
    supabase.from("messages").select("id,direction,sender,created_at,content").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(20),
    conv.opportunity_id
      ? supabase.from("opportunities").select("id,name,stages(name),pipelines(name)").eq("id", conv.opportunity_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const sorted = [...(messages ?? [])].reverse();
  const latestUser = [...sorted].reverse().find((m: any) => m.sender === "user");
  const packet = {
    customer_summary: latestUser?.content?.slice(0, 240) ?? "Human review required.",
    last_messages: sorted,
    extracted,
    opportunity: opp ? { id: opp.id, name: opp.name, stage: (opp as any).stages?.name ?? null, pipeline: (opp as any).pipelines?.name ?? null } : null,
    suggested_questions: [],
    constraints: ["Do not invent prices/policies", "Human review required"],
  };

  const { data: handoff, error } = await supabase
    .from("conversation_handoffs")
    .insert({
      org_id: conv.org_id,
      merchant_id: conv.merchant_id,
      conversation_id: conv.id,
      run_id: runId,
      created_by_user_id: conv.owner_user_id,
      reason_code: reasonCode,
      reason_text: reasonText,
      packet,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !handoff) throw new Error(`handoff failed: ${truncate(error)}`);

  await supabase.from("conversations").update({
    status: "needs_handoff",
    handoff_active: true,
    handoff_reason_code: reasonCode,
    handoff_reason_text: reasonText,
    ai_paused: true,
  }).eq("id", conv.id);

  if (runId) {
    await supabase.from("ai_agent_actions").insert({
      org_id: conv.org_id,
      run_id: runId,
      action_type: "set_handoff",
      payload: { reason_code: reasonCode, reason_text: reasonText },
      status: "executed",
      executed_at: new Date().toISOString(),
    });
  }

  await supabase.from("channel_events").insert({
    org_id: conv.org_id,
    merchant_id: conv.merchant_id,
    channel: "whatsapp",
    provider: "meta",
    event_type: "handoff_created",
    provider_event_id: `handoff_${conv.id}_${Date.now()}`,
    external_contact: conv.external_contact,
    severity: "warning",
    payload: { function_name: "ai-sales-agent", handoff_id: handoff.id, reason_code: reasonCode, reason_text: reasonText, trigger_message_id: triggerMessageId ?? null },
  });

  return handoff.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 500);
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, serviceKey);
  let runId: string | null = null;
  let convForError: any = null;
  try {
    const body = (await req.json()) as AgentRequest;
    if (!body.conversation_id) return json({ error: "conversation_id is required" }, 400);

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id,org_id,merchant_id,external_contact,ai_enabled,ai_paused,status,owner_user_id,opportunity_id,last_intent,last_entities")
      .eq("id", body.conversation_id)
      .maybeSingle();
    if (convErr || !conv) return json({ error: "Conversation not found" }, 404);
    convForError = conv;
    await setAiState(supabase, conv.id, "generating", null);

    const { data: sub } = await supabase
      .from("org_subscriptions")
      .select("status,trial_ends_at,subscription_plans(ai_enabled)")
      .eq("org_id", conv.org_id)
      .maybeSingle();
    const p = Array.isArray(sub?.subscription_plans) ? sub?.subscription_plans[0] : sub?.subscription_plans;
    const trialExpired = sub?.status === "trial" && !!sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() <= Date.now();
    if (!(p?.ai_enabled ?? true) || !["active", "trial"].includes(sub?.status ?? "trial") || trialExpired) {
      await setAiState(supabase, conv.id, "failed", "AI blocked by plan");
      return noContent();
    }
    if (!conv.ai_enabled || conv.ai_paused || conv.status === "needs_handoff") {
      await setAiState(supabase, conv.id, "ready", null);
      return noContent();
    }
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const runInsert = await supabase.from("ai_agent_runs").insert({
      org_id: conv.org_id,
      merchant_id: conv.merchant_id,
      conversation_id: conv.id,
      trigger_message_id: body.trigger_message_id ?? null,
      model: MODEL,
      status: "started",
      input_summary: {},
      output: {},
    }).select("id").maybeSingle();
    if (runInsert.error?.code === "23505") return json({ ok: true, dedup: true, conversation_id: conv.id }, 200);
    if (runInsert.error || !runInsert.data) throw new Error(`run create failed: ${truncate(runInsert.error)}`);
    runId = runInsert.data.id;

    const [merchantRes, msgRes] = await Promise.all([
      supabase.from("merchants").select("name").eq("id", conv.merchant_id).maybeSingle(),
      supabase.from("messages").select("id,sender,content,created_at").eq("conversation_id", conv.id).order("created_at", { ascending: true }).limit(30),
    ]);
    const messages = msgRes.data ?? [];
    const lastUserText = [...messages].reverse().find((m: any) => m.sender === "user")?.content ?? "";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: `You are Embudex autonomous sales agent for merchant \"${merchantRes.data?.name ?? "Merchant"}\". Output JSON only.` },
          ...messages.map((m: any) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.content })),
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) throw new Error(`AI gateway ${aiRes.status}: ${truncate(await aiRes.text(), 250)}`);
    const aiContent = (await aiRes.json())?.choices?.[0]?.message?.content;
    if (!aiContent) throw new Error("Empty AI response");
    const parsed = parseOutput(aiContent) as any;

    const intent = normalizeIntent(parsed?.extracted?.intent);
    const leadScore = Math.max(0, Math.min(100, Number(parsed?.extracted?.lead_score ?? 0)));
    const entities = parsed?.extracted?.entities ?? {};
    const leadScoreReason = parsed?.extracted?.lead_score_reason ?? {};
    const handoffRequested = !!parsed?.reply?.handoff || parsed?.reply?.set_status === "needs_handoff";
    const lowConfidence = intent === "other" && leadScore < 35;
    const policyUnknown = detectPolicyRisk(lastUserText);
    const shouldHandoff = handoffRequested || lowConfidence || policyUnknown;

    await supabase.from("ai_agent_runs").update({ output: parsed, input_summary: { message_count: messages.length } }).eq("id", runId);
    await supabase.from("conversations").update({
      last_intent: intent,
      intent,
      last_entities: entities,
      lead_score: leadScore,
      lead_score_reason: leadScoreReason,
      ai_last_generated_at: new Date().toISOString(),
    }).eq("id", conv.id);

    if (shouldHandoff) {
      const reasonCode = handoffRequested ? "manual_request" : policyUnknown ? "policy_unknown" : "low_confidence";
      const reasonText = handoffRequested ? "AI requested human review" : policyUnknown ? "Policy-sensitive request" : "Low confidence response";
      const handoffId = await createHandoff(
        supabase,
        conv,
        runId,
        reasonCode,
        reasonText,
        { intent, entities, lead_score: leadScore, lead_score_reason: leadScoreReason },
        body.trigger_message_id,
      );
      await fetch(`${supabaseUrl}/functions/v1/ai-handoff-assist`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conv.id,
          handoff_id: handoffId,
          trigger: "auto",
          reason_code: reasonCode,
          reason_text: reasonText,
        }),
      }).catch(() => undefined);
      await supabase.from("ai_agent_runs").update({ status: "completed" }).eq("id", runId);
      await setAiState(supabase, conv.id, "ready", null);
      return json({ ok: true, run_id: runId, conversation_id: conv.id, handoff_id: handoffId }, 200);
    }

    const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
    const shouldSend = parsed?.reply?.should_send !== false;
    const defaultText = String(parsed?.reply?.text ?? "").trim();
    if (!actions.some((a: any) => a?.type === "send_message") && defaultText) actions.push({ type: "send_message", text: defaultText });
    let outboundMessageId: string | null = null;
    const nowIso = new Date().toISOString();

    const actionRows: Array<{ id: string; action_type: string; payload: Record<string, unknown> }> = [];
    for (const action of actions) {
      const { data: inserted } = await supabase
        .from("ai_agent_actions")
        .insert({
          org_id: conv.org_id,
          run_id: runId,
          action_type: String(action?.type ?? "unknown"),
          payload: action,
          status: "pending",
        })
        .select("id,action_type,payload")
        .single();
      if (inserted) actionRows.push(inserted);
    }

    for (const action of actionRows) {
      try {
        if (action.action_type === "move_stage") {
          if (!opportunityId) throw new Error("Missing opportunity_id for move_stage");
          const stageKey = String((action.payload as any)?.stage_key ?? "");
          const stageId = await findStageByKey(supabase, conv.org_id, conv.merchant_id, stageKey);
          if (!stageId) {
            await markActionStatus(supabase, action.id, "skipped", "No matching stage found");
            continue;
          }

          const { data: opp } = await supabase
            .from("opportunities")
            .select("id,version,stage_id,owner_user_id")
            .eq("id", opportunityId)
            .single();
          if (!opp) throw new Error("Opportunity not found");
          if (opp.stage_id === stageId) {
            await markActionStatus(supabase, action.id, "skipped", "Already in target stage");
            continue;
          }

          const actorUserId = ownerUserId ?? opp.owner_user_id;
          if (!actorUserId) throw new Error("Missing actor user for stage move");
          const rpc = await supabase.rpc("rpc_move_opportunity_stage", {
            p_opportunity_id: opportunityId,
            p_to_stage_id: stageId,
            p_expected_version: opp.version,
            p_actor_user_id: actorUserId,
          });
          const rpcData = typeof rpc.data === "string" ? JSON.parse(rpc.data) : rpc.data;
          if (rpc.error || !rpcData?.ok) throw new Error(truncate(rpc.error ?? rpcData?.error ?? "move stage failed"));
          await markActionStatus(supabase, action.id, "executed");
          continue;
        }

        if (action.action_type === "create_task") {
          if (!opportunityId) throw new Error("Missing opportunity_id for create_task");
          if (!ownerUserId) throw new Error("Missing owner user for task");
          const title = String((action.payload as any)?.title ?? "Follow up customer");
          const dueInHoursRaw = Number((action.payload as any)?.due_in_hours ?? 24);
          const dueInHours = Number.isFinite(dueInHoursRaw) ? Math.max(1, Math.round(dueInHoursRaw)) : 24;
          const dueAt = new Date(Date.now() + dueInHours * 3600_000).toISOString();
          const notes = String((action.payload as any)?.notes ?? "");

          const { error: taskErr } = await supabase.from("tasks").insert({
            org_id: conv.org_id,
            opportunity_id: opportunityId,
            title,
            due_at: dueAt,
            assigned_to: ownerUserId,
            created_by: ownerUserId,
          });
          if (taskErr) throw new Error(truncate(taskErr));

          if (notes.trim()) {
            await supabase.from("activities").insert({
              org_id: conv.org_id,
              entity_type: "opportunity",
              entity_id: opportunityId,
              activity_type: "note",
              description: `AI task note: ${notes.trim()}`,
              created_by: ownerUserId,
            });
          }
          await markActionStatus(supabase, action.id, "executed");
          continue;
        }

        if (action.action_type === "send_message") {
          if (!shouldSend) {
            await markActionStatus(supabase, action.id, "skipped", "reply.should_send=false");
            continue;
          }
          const text = String((action.payload as any)?.text ?? defaultText).trim();
          if (!text) {
            await markActionStatus(supabase, action.id, "skipped", "No message text");
            continue;
          }
          const { data: msg } = await supabase
            .from("messages")
            .insert({
              org_id: conv.org_id,
              conversation_id: conv.id,
              sender: "ai",
              direction: "outbound",
              channel: "whatsapp",
              provider: "meta",
              content: text,
              send_status: "queued",
              delivery_status: "unknown",
              metadata: { agent_run_id: runId, model: MODEL, generated_at: nowIso },
            })
            .select("id")
            .single();
          if (!msg?.id) throw new Error("Failed to create outbound message");

          outboundMessageId = msg.id;
          await supabase.from("outbound_jobs").insert({
            org_id: conv.org_id,
            merchant_id: conv.merchant_id,
            conversation_id: conv.id,
            message_id: msg.id,
            channel: "whatsapp",
            provider: "meta",
            status: "queued",
            retry_count: 0,
            max_retries: 5,
            next_retry_at: nowIso,
            idempotency_key: `agent:${conv.id}:${body.trigger_message_id ?? msg.id}`,
            attempts: 0,
          });
          await supabase.from("conversations").update({ last_outbound_at: nowIso, last_ai_outbound_at: nowIso }).eq("id", conv.id);
          await markActionStatus(supabase, action.id, "executed");
          continue;
        }

        await markActionStatus(supabase, action.id, "skipped", "Unsupported action type");
      } catch (err) {
        await markActionStatus(supabase, action.id, "failed", truncate(err));
      }
    }

    const requested = normalizeStatus(parsed?.reply?.set_status ?? null);
    if (requested) await supabase.from("conversations").update({ status: requested }).eq("id", conv.id);

    await supabase.from("ai_agent_runs").update({ status: "completed" }).eq("id", runId);
    await setAiState(supabase, conv.id, "ready", null);
    return json({ ok: true, run_id: runId, conversation_id: conv.id, outbound_message_id: outboundMessageId }, 200);
  } catch (e) {
    const err = truncate(e);
    try {
      if (runId) await supabase.from("ai_agent_runs").update({ status: "failed", error: err }).eq("id", runId);
      if (convForError) {
        await setAiState(supabase, convForError.id, "failed", err);
        const handoffId = await createHandoff(
          supabase,
          convForError,
          runId,
          "ai_error",
          err,
          { intent: convForError.last_intent, entities: convForError.last_entities ?? {}, lead_score: null, lead_score_reason: {} },
        );
        await fetch(`${supabaseUrl}/functions/v1/ai-handoff-assist`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: convForError.id, handoff_id: handoffId, trigger: "auto", reason_code: "ai_error", reason_text: err }),
        }).catch(() => undefined);
      }
    } catch {
      // no-op
    }
    return json({ ok: false, error: err }, 500);
  }
});
