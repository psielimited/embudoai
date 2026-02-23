import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-flash-preview";

type AgentRequest = {
  conversation_id: string;
  trigger_message_id?: string;
};

type AgentOutput = {
  reply?: {
    text?: string;
    should_send?: boolean;
    handoff?: boolean;
    set_status?: "open" | "waiting_on_customer" | "needs_handoff" | "resolved" | "closed" | null;
  };
  extracted?: {
    language?: string;
    intent?: string;
    entities?: Record<string, unknown>;
    lead_score?: number;
    lead_score_reason?: Record<string, unknown>;
  };
  actions?: Array<{
    type?: string;
    stage_key?: string;
    reason?: string;
    title?: string;
    due_in_hours?: number;
    notes?: string;
    text?: string;
  }>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function noContent(status = 204) {
  return new Response(null, { status, headers: corsHeaders });
}

function truncate(v: unknown, max = 500) {
  let raw: string;
  if (typeof v === "string") {
    raw = v;
  } else {
    try {
      raw = JSON.stringify(v);
    } catch {
      raw = String(v);
    }
  }
  return raw.slice(0, max);
}

function parseJsonOutput(content: string): AgentOutput {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const noFences = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(noFences);
  }
}

function normalizeIntent(input?: string): string {
  const allowed = new Set([
    "new_lead",
    "pricing",
    "product_question",
    "availability",
    "booking",
    "support",
    "complaint",
    "refund",
    "other",
  ]);
  return allowed.has(input ?? "") ? (input as string) : "other";
}

function normalizeLeadScore(score: unknown) {
  const n = typeof score === "number" ? score : Number(score ?? 0);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeConversationStatus(status?: string | null) {
  const allowed = new Set(["open", "waiting_on_customer", "needs_handoff", "resolved", "closed"]);
  if (!status || !allowed.has(status)) return null;
  return status as "open" | "waiting_on_customer" | "needs_handoff" | "resolved" | "closed";
}

// deno-lint-ignore no-explicit-any
async function setConversationAiState(
  supabase: any,
  conversationId: string,
  aiStatus: "queued" | "generating" | "ready" | "failed" | "idle",
  aiLastError: string | null,
) {
  await supabase
    .from("conversations")
    .update({ ai_status: aiStatus, ai_last_error: aiLastError })
    .eq("id", conversationId);
}

// deno-lint-ignore no-explicit-any
async function createSkippedRun(
  supabase: any,
  params: {
    org_id: string;
    merchant_id: string;
    conversation_id: string;
    trigger_message_id?: string;
    reason: string;
    details?: Record<string, unknown>;
  },
) {
  const result = await supabase
    .from("ai_agent_runs")
    .insert({
      org_id: params.org_id,
      merchant_id: params.merchant_id,
      conversation_id: params.conversation_id,
      trigger_message_id: params.trigger_message_id ?? null,
      model: MODEL,
      status: "skipped",
      input_summary: {
        reason: params.reason,
        ...(params.details ?? {}),
      },
      output: {},
    })
    .select("id")
    .maybeSingle();

  if (result.error?.code === "23505") {
    return { dedup: true, runId: null as string | null };
  }
  if (result.error) {
    throw new Error(`Failed to create skipped run: ${truncate(result.error)}`);
  }
  return { dedup: false, runId: result.data?.id ?? null };
}

// deno-lint-ignore no-explicit-any
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

// deno-lint-ignore no-explicit-any
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
  if (mapping[stageKey]) {
    return mapping[stageKey];
  }

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
  if (names.length === 0) return null;

  const { data: stages } = await supabase
    .from("stages")
    .select("id,name,position")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  const match = (stages ?? []).find((s: any) =>
    names.some((n) => s.name.toLowerCase().includes(n))
  );
  return match?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${serviceKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let runId: string | null = null;
  let conversationIdForError: string | null = null;
  try {
    const body = await req.json() as AgentRequest;
    if (!body.conversation_id) return json({ error: "conversation_id is required" }, 400);
    conversationIdForError = body.conversation_id;

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("id,org_id,merchant_id,external_contact,ai_enabled,ai_paused,status,owner_user_id,opportunity_id,last_intent,last_entities")
      .eq("id", body.conversation_id)
      .maybeSingle();
    if (convError || !conv) return json({ error: "Conversation not found" }, 404);

    const nowIso = new Date().toISOString();
    await setConversationAiState(supabase, conv.id, "generating", null);

    // plan gating
    const { data: subscription } = await supabase
      .from("org_subscriptions")
      .select("status, trial_ends_at, subscription_plans(ai_enabled)")
      .eq("org_id", conv.org_id)
      .maybeSingle();
    const plans = subscription?.subscription_plans;
    const plan = Array.isArray(plans) ? plans[0] : plans;
    const aiEnabledByPlan = plan?.ai_enabled ?? true;
    const trialExpired = subscription?.status === "trial"
      && !!subscription?.trial_ends_at
      && new Date(subscription.trial_ends_at).getTime() <= Date.now();
    const activeSubState = ["active", "trial"].includes(subscription?.status ?? "trial") && !trialExpired;
    if (!aiEnabledByPlan || !activeSubState) {
      await supabase.from("channel_events").insert({
        org_id: conv.org_id,
        merchant_id: conv.merchant_id,
        channel: "whatsapp",
        provider: "meta",
        event_type: "ai_blocked_by_plan",
        provider_event_id: `ai_blocked_${conv.id}_${Date.now()}`,
        external_contact: conv.external_contact,
        severity: "warning",
        payload: {
          function_name: "ai-sales-agent",
          conversation_id: conv.id,
          subscription_status: subscription?.status ?? "unknown",
          ai_enabled: aiEnabledByPlan,
          trial_expired: trialExpired,
        },
      });
      await createSkippedRun(supabase, {
        org_id: conv.org_id,
        merchant_id: conv.merchant_id,
        conversation_id: conv.id,
        trigger_message_id: body.trigger_message_id,
        reason: "plan_blocked",
        details: {
          subscription_status: subscription?.status ?? "unknown",
          ai_enabled: aiEnabledByPlan,
          trial_expired: trialExpired,
        },
      });
      await setConversationAiState(supabase, conv.id, "failed", "AI blocked by plan");
      return noContent();
    }

    // governance
    if (!conv.ai_enabled || conv.ai_paused || conv.status === "needs_handoff") {
      await createSkippedRun(supabase, {
        org_id: conv.org_id,
        merchant_id: conv.merchant_id,
        conversation_id: conv.id,
        trigger_message_id: body.trigger_message_id,
        reason: "governance_block",
        details: {
          ai_enabled: conv.ai_enabled,
          ai_paused: conv.ai_paused,
          status: conv.status,
        },
      });
      await setConversationAiState(supabase, conv.id, "ready", null);
      return noContent();
    }

    if (!lovableApiKey) {
      await setConversationAiState(supabase, conv.id, "failed", "LOVABLE_API_KEY not configured");
      return json({ error: "AI not configured" }, 500);
    }

    // idempotency + run creation
    const runInsert = await supabase
      .from("ai_agent_runs")
      .insert({
        org_id: conv.org_id,
        merchant_id: conv.merchant_id,
        conversation_id: conv.id,
        trigger_message_id: body.trigger_message_id ?? null,
        model: MODEL,
        status: "started",
        input_summary: {},
        output: {},
      })
      .select("id")
      .maybeSingle();

    if (runInsert.error && runInsert.error.code === "23505" && body.trigger_message_id) {
      const { data: existingRun } = await supabase
        .from("ai_agent_runs")
        .select("id,status")
        .eq("org_id", conv.org_id)
        .eq("conversation_id", conv.id)
        .eq("trigger_message_id", body.trigger_message_id)
        .maybeSingle();

      if (existingRun?.status === "failed") {
        await setConversationAiState(supabase, conv.id, "failed", "Duplicate trigger already failed");
      } else if (existingRun?.status === "started") {
        await setConversationAiState(supabase, conv.id, "generating", null);
      } else {
        await setConversationAiState(supabase, conv.id, "ready", null);
      }

      return json({ ok: true, dedup: true, run_id: existingRun?.id ?? null, conversation_id: conv.id }, 200);
    }
    if (runInsert.error || !runInsert.data) {
      await setConversationAiState(supabase, conv.id, "failed", "Failed to create agent run");
      return json({ error: "Failed to create agent run" }, 500);
    }
    runId = runInsert.data.id;

    // ensure opportunity
    let opportunityId = conv.opportunity_id;
    let ownerUserId = conv.owner_user_id;
    if (!ownerUserId) {
      const { data: admins } = await supabase
        .from("org_members")
        .select("user_id, role")
        .eq("org_id", conv.org_id)
        .in("role", ["org_admin", "admin"])
        .limit(1);
      ownerUserId = admins?.[0]?.user_id ?? null;
    }
    if (!ownerUserId) {
      const { data: anyMember } = await supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", conv.org_id)
        .limit(1);
      ownerUserId = anyMember?.[0]?.user_id ?? null;
    }

    if (!opportunityId) {
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("org_id", conv.org_id)
        .eq("is_default", true)
        .maybeSingle();
      if (!pipeline) throw new Error("Default pipeline not configured");

      const { data: firstStage } = await supabase
        .from("stages")
        .select("id")
        .eq("pipeline_id", pipeline.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!firstStage) throw new Error("No stages configured in default pipeline");

      if (!ownerUserId) throw new Error("No owner user found for organization");

      const { data: opp, error: oppErr } = await supabase
        .from("opportunities")
        .insert({
          org_id: conv.org_id,
          pipeline_id: pipeline.id,
          stage_id: firstStage.id,
          owner_user_id: ownerUserId,
          name: `WhatsApp: ${conv.external_contact}`,
          status: "open",
        })
        .select("id")
        .single();
      if (oppErr || !opp) throw new Error(`Failed creating opportunity: ${truncate(oppErr)}`);
      opportunityId = opp.id;

      await supabase.from("conversations").update({
        opportunity_id: opportunityId,
        owner_user_id: conv.owner_user_id ?? ownerUserId,
      }).eq("id", conv.id);
    }

    // load context
    const [{ data: merchant }, { data: messages }, { data: oppCtx }] = await Promise.all([
      supabase.from("merchants").select("name").eq("id", conv.merchant_id).maybeSingle(),
      supabase
        .from("messages")
        .select("id,sender,content,created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(30),
      opportunityId
        ? supabase
          .from("opportunities")
          .select("id,version,stage_id,stages(name),pipeline_id,pipelines(name)")
          .eq("id", opportunityId)
          .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const systemPrompt = `
You are Embudex autonomous sales agent for merchant "${merchant?.name ?? "Merchant"}".
Return ONLY valid JSON matching this schema:
{
  "reply": { "text": "string", "should_send": true, "handoff": false, "set_status": "open|waiting_on_customer|needs_handoff|resolved|closed|null" },
  "extracted": {
    "language": "string",
    "intent": "new_lead|pricing|product_question|availability|booking|support|complaint|refund|other",
    "entities": { "product": "string|null", "quantity": "string|null", "budget": "string|null", "location": "string|null", "timeframe": "string|null" },
    "lead_score": 0,
    "lead_score_reason": { "signals": ["..."], "notes": "string" }
  },
  "actions": [
    { "type":"move_stage", "stage_key":"qualified|proposal|won|lost|needs_follow_up", "reason":"string" },
    { "type":"create_task", "title":"string", "due_in_hours": 24, "notes":"string" },
    { "type":"send_message", "text":"string" }
  ]
}
Rules:
- Output JSON only, no markdown.
- Reply in customer's language.
- Ask at most one clarifying question.
- Never invent prices/policies.
- Move stage only on high confidence.
- Set handoff=true for abusive language, legal threats, complex billing/refund disputes.
`.trim();

    const contextMessages = [
      { role: "system", content: systemPrompt },
      ...((messages ?? []).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      }))),
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: contextMessages,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI gateway ${aiRes.status}: ${truncate(errText, 250)}`);
    }

    const aiJson = await aiRes.json();
    const aiContent = aiJson?.choices?.[0]?.message?.content;
    if (!aiContent || typeof aiContent !== "string") throw new Error("Empty AI response");

    const parsed = parseJsonOutput(aiContent);
    const intent = normalizeIntent(parsed.extracted?.intent);
    const leadScore = normalizeLeadScore(parsed.extracted?.lead_score);
    const leadScoreReason = parsed.extracted?.lead_score_reason ?? {};
    const entities = parsed.extracted?.entities ?? {};
    const handoff = !!parsed.reply?.handoff || parsed.reply?.set_status === "needs_handoff";
    const requestedStatus = normalizeConversationStatus(parsed.reply?.set_status ?? null);

    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const shouldSend = parsed.reply?.should_send !== false;
    const fallbackSendText = (parsed.reply?.text ?? "").trim();
    if (!actions.some((a) => a.type === "send_message") && shouldSend && fallbackSendText) {
      actions.push({ type: "send_message", text: fallbackSendText });
    }

    await supabase.from("ai_agent_runs").update({
      input_summary: {
        message_count: messages?.length ?? 0,
        language_hint: parsed.extracted?.language ?? null,
        opportunity_id: opportunityId,
        current_stage: (oppCtx as any)?.stages?.name ?? null,
      },
      output: parsed as unknown as Record<string, unknown>,
    }).eq("id", runId);

    const insertedActions: Array<{ id: string; action_type: string; payload: Record<string, unknown> }> = [];
    for (const action of actions) {
      const type = action.type ?? "unknown";
      const { data: inserted } = await supabase
        .from("ai_agent_actions")
        .insert({
          org_id: conv.org_id,
          run_id: runId,
          action_type: type,
          payload: action as unknown as Record<string, unknown>,
          status: "pending",
        })
        .select("id,action_type,payload")
        .single();
      if (inserted) insertedActions.push(inserted as { id: string; action_type: string; payload: Record<string, unknown> });
    }

    // apply effects
    await supabase.from("conversations").update({
      last_intent: intent,
      intent,
      last_entities: entities as Record<string, unknown>,
      lead_score: leadScore,
      lead_score_reason: leadScoreReason as Record<string, unknown>,
      ai_last_generated_at: nowIso,
      updated_at: nowIso,
    }).eq("id", conv.id);

    const actionErrors: Array<{ action_id: string; action_type: string; error: string }> = [];
    let outboundMessageId: string | undefined;

    if (handoff) {
      await supabase.from("conversations").update({ status: "needs_handoff" }).eq("id", conv.id);
      for (const action of insertedActions) {
        await markActionStatus(supabase, action.id, "skipped", "Skipped due to handoff");
      }
    } else {
      if (requestedStatus) {
        await supabase.from("conversations").update({ status: requestedStatus }).eq("id", conv.id);
      }

      for (const action of insertedActions) {
        try {
          if (action.action_type === "move_stage") {
            if (!opportunityId) throw new Error("Missing opportunity_id for stage move");
            const stageKey = String(action.payload.stage_key ?? "");
            const stageId = await findStageByKey(supabase, conv.org_id, conv.merchant_id, stageKey);
            if (!stageId) {
              if (stageKey === "needs_follow_up") {
                await markActionStatus(supabase, action.id, "skipped", "No follow-up stage configured");
                continue;
              }
              throw new Error(`No stage found for key: ${stageKey}`);
            }

            const { data: opp } = await supabase
              .from("opportunities")
              .select("id,version,stage_id,owner_user_id")
              .eq("id", opportunityId)
              .single();

            if (!opp) {
              throw new Error("Opportunity missing while moving stage");
            }

            if (opp.stage_id === stageId) {
              await markActionStatus(supabase, action.id, "skipped", "Opportunity already in target stage");
              continue;
            }

            const actorUserId = ownerUserId ?? opp.owner_user_id ?? null;
            if (!actorUserId) {
              throw new Error("Missing actor_user_id for stage move");
            }

            const rpc = await supabase.rpc("rpc_move_opportunity_stage", {
              p_opportunity_id: opportunityId,
              p_to_stage_id: stageId,
              p_expected_version: opp.version,
              p_actor_user_id: actorUserId,
            });

            const rpcData = typeof rpc.data === "string"
              ? JSON.parse(rpc.data)
              : rpc.data;
            if (rpc.error || !rpcData?.ok) {
              throw new Error(truncate(rpc.error ?? rpcData?.error ?? "Stage move failed"));
            }

            await markActionStatus(supabase, action.id, "executed");
          } else if (action.action_type === "create_task") {
            if (!opportunityId) throw new Error("Missing opportunity_id for task");
            if (!ownerUserId) throw new Error("Missing owner for task assignment");

            const title = String(action.payload.title ?? "Follow up customer");
            const dueHoursRaw = Number(action.payload.due_in_hours ?? 24);
            const dueInHours = Number.isFinite(dueHoursRaw) ? Math.max(1, Math.round(dueHoursRaw)) : 24;
            const notes = String(action.payload.notes ?? "");
            const dueAt = new Date(Date.now() + dueInHours * 3600_000).toISOString();

            const taskInsert = await supabase.from("tasks").insert({
              org_id: conv.org_id,
              opportunity_id: opportunityId,
              title,
              due_at: dueAt,
              assigned_to: ownerUserId,
              created_by: ownerUserId,
            });
            if (taskInsert.error) throw new Error(truncate(taskInsert.error));

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
          } else if (action.action_type === "send_message") {
            if (!shouldSend) {
              await markActionStatus(supabase, action.id, "skipped", "reply.should_send=false");
              continue;
            }

            const text = String(action.payload.text ?? parsed.reply?.text ?? "").trim();
            if (!text) {
              await markActionStatus(supabase, action.id, "skipped", "No text to send");
              continue;
            }

            const { data: outboundMsg, error: outboundMsgErr } = await supabase
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
                metadata: {
                  agent_run_id: runId,
                  model: MODEL,
                  trigger_message_id: body.trigger_message_id ?? null,
                  generated_at: nowIso,
                },
              })
              .select("id")
              .single();
            if (outboundMsgErr || !outboundMsg) throw new Error(truncate(outboundMsgErr ?? "Failed to create outbound message"));

            const idem = `agent:${conv.id}:${body.trigger_message_id ?? outboundMsg.id}`;
            const { error: jobErr } = await supabase
              .from("outbound_jobs")
              .insert({
                org_id: conv.org_id,
                merchant_id: conv.merchant_id,
                conversation_id: conv.id,
                message_id: outboundMsg.id,
                channel: "whatsapp",
                provider: "meta",
                status: "queued",
                retry_count: 0,
                max_retries: 5,
                next_retry_at: nowIso,
                idempotency_key: idem,
              });
            if (jobErr) throw new Error(truncate(jobErr));

            await supabase.from("conversations").update({
              last_outbound_at: nowIso,
              last_ai_outbound_at: nowIso,
            }).eq("id", conv.id);

            outboundMessageId = outboundMsg.id;
            await markActionStatus(supabase, action.id, "executed");
          } else {
            await markActionStatus(supabase, action.id, "skipped", "Unsupported action type");
          }
        } catch (e) {
          const errorText = truncate(e);
          actionErrors.push({ action_id: action.id, action_type: action.action_type, error: errorText });
          await markActionStatus(supabase, action.id, "failed", errorText);
        }
      }
    }

    await supabase.from("ai_agent_runs").update({
      status: "completed",
    }).eq("id", runId);

    await supabase.from("conversations").update({
      ai_status: "ready",
      ai_last_error: actionErrors.length ? truncate(actionErrors, 300) : null,
    }).eq("id", conv.id);

    return json({
      ok: true,
      run_id: runId,
      conversation_id: conv.id,
      outbound_message_id: outboundMessageId,
      errors: actionErrors,
    }, 200);
  } catch (e) {
    const errorText = truncate(e);
    console.error("ai-sales-agent error:", errorText);
    try {
      if (conversationIdForError) {
        await setConversationAiState(supabase, conversationIdForError, "failed", errorText);
      }
      if (runId) {
        await supabase.from("ai_agent_runs").update({
          status: "failed",
          error: errorText,
        }).eq("id", runId);
      }
    } catch (_ignore) {
      // no-op
    }
    return json({ ok: false, error: errorText }, 500);
  }
});
