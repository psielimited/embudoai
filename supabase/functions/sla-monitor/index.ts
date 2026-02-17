/**
 * Edge Function: sla-monitor (org-aware)
 * Runs periodically to detect SLA breaches per org.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NO_ACTIVITY_HOURS = 48;
const TASK_OVERDUE_GRACE_HOURS = 2;
const DEFAULT_TIME_IN_STAGE_DAYS = 14;
const DEFAULT_CONV_FIRST_RESPONSE_MINUTES = 15;
const DEFAULT_CONV_NEXT_RESPONSE_MINUTES = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const results = { no_activity: 0, task_overdue: 0, time_in_stage: 0, notifications: 0 };

  try {
    // Get all orgs
    const { data: orgs } = await client.from("orgs").select("id");
    if (!orgs) return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    for (const org of orgs) {
      const orgId = org.id;

      const { data: subscription } = await client
        .from("org_subscriptions")
        .select("status, trial_ends_at, subscription_plans(sla_monitoring_enabled)")
        .eq("org_id", orgId)
        .maybeSingle();

      const trialExpired = subscription?.status === "trial"
        && !!subscription?.trial_ends_at
        && new Date(subscription.trial_ends_at).getTime() <= Date.now();
      const plans = subscription?.subscription_plans;
      const plan = Array.isArray(plans) ? plans[0] : plans;
      const slaEnabledByPlan = plan?.sla_monitoring_enabled ?? false;
      const activeState = ["active", "trial"].includes(subscription?.status ?? "trial") && !trialExpired;

      if (!slaEnabledByPlan || !activeState) {
        continue;
      }

      const { data: orgSettings } = await client.from("org_settings")
        .select("sla_first_response_minutes, sla_next_response_minutes")
        .eq("org_id", orgId)
        .maybeSingle();
      const defaultFirstResponseMinutes = orgSettings?.sla_first_response_minutes ?? DEFAULT_CONV_FIRST_RESPONSE_MINUTES;
      const defaultNextResponseMinutes = orgSettings?.sla_next_response_minutes ?? DEFAULT_CONV_NEXT_RESPONSE_MINUTES;

      // 1. NO_ACTIVITY
      const cutoff = new Date(Date.now() - NO_ACTIVITY_HOURS * 3600000).toISOString();
      const { data: openOpps } = await client
        .from("opportunities").select("id, owner_user_id, name, updated_at, stage_id")
        .eq("status", "open").eq("org_id", orgId);

      if (openOpps) {
        for (const opp of openOpps) {
          const { data: lastAct } = await client.from("activities").select("created_at")
            .eq("entity_type", "opportunity").eq("entity_id", opp.id)
            .order("created_at", { ascending: false }).limit(1);
          const lastAt = lastAct?.[0]?.created_at || opp.updated_at;
          if (lastAt < cutoff) {
            const created = await upsertSla(client, opp.id, "NO_ACTIVITY", "warn",
              { last_activity_at: lastAt, threshold_hours: NO_ACTIVITY_HOURS }, orgId);
            if (created) {
              results.no_activity++;
              await notify(client, opp.owner_user_id, "sla_breach",
                `No activity on "${opp.name}"`, `${NO_ACTIVITY_HOURS}+ hours`, "opportunity", opp.id, orgId);
              results.notifications++;
            }
          }
        }
      }

      // 2. TASK_OVERDUE
      const grace = new Date(Date.now() - TASK_OVERDUE_GRACE_HOURS * 3600000).toISOString();
      const { data: tasks } = await client.from("tasks").select("id, opportunity_id, title, assigned_to, due_at")
        .eq("completed", false).eq("org_id", orgId).not("due_at", "is", null).lt("due_at", grace);

      if (tasks) {
        for (const t of tasks) {
          const created = await upsertSla(client, t.opportunity_id, "TASK_OVERDUE", "breach",
            { task_id: t.id, task_title: t.title, due_at: t.due_at }, orgId);
          if (created) {
            results.task_overdue++;
            if (t.assigned_to) {
              await notify(client, t.assigned_to, "sla_breach",
                `Task overdue: "${t.title}"`, `Due: ${t.due_at}`, "opportunity", t.opportunity_id, orgId);
              results.notifications++;
            }
          }
        }
      }

      // 3. TIME_IN_STAGE
      const { data: stages } = await client.from("stages").select("id, name").eq("org_id", orgId);
      const stageMap = new Map((stages || []).map(s => [s.id, s.name]));
      const { data: stageGates } = await client
        .from("stage_gates")
        .select("stage_id, max_days_in_stage")
        .eq("org_id", orgId)
        .not("max_days_in_stage", "is", null);
      const stageThresholdMap = new Map((stageGates || []).map((g) => [g.stage_id, g.max_days_in_stage as number]));

      if (openOpps) {
        for (const opp of openOpps) {
          const { data: last } = await client.from("audit_events").select("created_at, diff")
            .eq("opportunity_id", opp.id).eq("event_type", "stage_changed")
            .order("created_at", { ascending: false }).limit(1);
          const enteredAt = last?.[0]?.created_at || opp.updated_at;
          const toStageId = (last?.[0]?.diff as any)?.to_stage_id;
          const currentStageId = toStageId || opp.stage_id;
          const stageName = currentStageId ? stageMap.get(currentStageId) : null;
          const threshold = (currentStageId ? stageThresholdMap.get(currentStageId) : null) ?? DEFAULT_TIME_IN_STAGE_DAYS;
          if (Date.now() - new Date(enteredAt).getTime() > threshold * 86400000) {
            const created = await upsertSla(client, opp.id, "TIME_IN_STAGE", "warn",
              { stage_name: stageName || "unknown", entered_at: enteredAt, threshold_days: threshold }, orgId);
            if (created) {
              results.time_in_stage++;
              await notify(client, opp.owner_user_id, "sla_breach",
                `"${opp.name}" stuck in ${stageName || "stage"}`, `${threshold}+ days`, "opportunity", opp.id, orgId);
              results.notifications++;
            }
          }
        }
      }

      // 4. CONVERSATION SLA
      // Load SLA policy overrides for this org (fallback to org defaults)
      const { data: slaPolicies } = await client.from("conversation_sla_policies")
        .select("merchant_id, first_response_minutes, next_response_minutes")
        .eq("org_id", orgId).eq("enabled", true);
      const policyMap = new Map((slaPolicies || []).map(p => [p.merchant_id, p]));

      const { data: openConvs } = await client.from("conversations")
        .select("id, merchant_id, owner_user_id, external_contact, last_inbound_at, last_outbound_at, status")
        .eq("org_id", orgId)
        .in("status", ["open", "needs_handoff"]);

      if (openConvs) {
        for (const conv of openConvs) {
          if (!conv.last_inbound_at) continue;

          const policy = policyMap.get(conv.merchant_id);
          const firstResponseMinutes = policy?.first_response_minutes ?? defaultFirstResponseMinutes;
          const nextResponseMinutes = policy?.next_response_minutes ?? defaultNextResponseMinutes;

          const inboundTime = new Date(conv.last_inbound_at).getTime();
          const outboundTime = conv.last_outbound_at ? new Date(conv.last_outbound_at).getTime() : 0;
          const now = Date.now();

          // First response: no outbound ever
          if (outboundTime === 0 && (now - inboundTime) > firstResponseMinutes * 60000) {
            const created = await upsertSla(client, conv.id, "CONV_FIRST_RESPONSE", "breach",
              { minutes: firstResponseMinutes, last_inbound_at: conv.last_inbound_at }, orgId, "conversation");
            if (created) {
              results.no_activity++;
              if (conv.owner_user_id) {
                await notify(client, conv.owner_user_id, "sla_breach",
                  `First response SLA breached`, `No reply in ${firstResponseMinutes}min for ${conv.external_contact}`,
                  "conversation", conv.id, orgId);
                results.notifications++;
              }
            }
          }

          // Next response: outbound is older than inbound
          else if (outboundTime < inboundTime && (now - inboundTime) > nextResponseMinutes * 60000) {
            const created = await upsertSla(client, conv.id, "CONV_NEXT_RESPONSE", "warn",
              { minutes: nextResponseMinutes, last_inbound_at: conv.last_inbound_at, last_outbound_at: conv.last_outbound_at }, orgId, "conversation");
            if (created) {
              results.no_activity++;
              if (conv.owner_user_id) {
                await notify(client, conv.owner_user_id, "sla_breach",
                  `Response SLA breached`, `No reply in ${nextResponseMinutes}min for ${conv.external_contact}`,
                  "conversation", conv.id, orgId);
                results.notifications++;
              }
            }
          }
        }
      }

      // Auto-resolve conversation SLAs when responded
      const { data: openConvSlas } = await client.from("sla_events")
        .select("id, entity_id, sla_type, details")
        .eq("org_id", orgId)
        .eq("entity_type", "conversation")
        .in("sla_type", ["CONV_FIRST_RESPONSE", "CONV_NEXT_RESPONSE"])
        .is("resolved_at", null);

      if (openConvSlas) {
        for (const sla of openConvSlas) {
          const { data: convCheck } = await client.from("conversations")
            .select("last_inbound_at, last_outbound_at")
            .eq("id", sla.entity_id).single();
          if (convCheck?.last_outbound_at && convCheck.last_inbound_at &&
              new Date(convCheck.last_outbound_at) >= new Date(convCheck.last_inbound_at)) {
            await client.from("sla_events").update({ resolved_at: new Date().toISOString() }).eq("id", sla.id);
          }
        }
      }

      // Auto-resolve completed task SLAs
      const { data: openSlas } = await client.from("sla_events").select("id, details")
        .eq("sla_type", "TASK_OVERDUE").eq("org_id", orgId).is("resolved_at", null);
      if (openSlas) {
        for (const sla of openSlas) {
          const tid = (sla.details as any)?.task_id;
          if (tid) {
            const { data: task } = await client.from("tasks").select("completed").eq("id", tid).single();
            if (task?.completed) await client.from("sla_events").update({ resolved_at: new Date().toISOString() }).eq("id", sla.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SLA monitor error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function upsertSla(client: any, entityId: string, slaType: string, severity: string, details: any, orgId: string, entityType = "opportunity") {
  const { data: existing } = await client.from("sla_events").select("id")
    .eq("entity_id", entityId).eq("sla_type", slaType).eq("org_id", orgId).is("resolved_at", null).limit(1);
  if (existing && existing.length > 0) return false;
  await client.from("sla_events").insert({
    entity_type: entityType, entity_id: entityId, sla_type: slaType, severity, details, org_id: orgId,
  });
  return true;
}

async function notify(client: any, userId: string, type: string, title: string, body: string,
  entityType: string, entityId: string, orgId: string) {
  await client.from("notifications").insert({ user_id: userId, type, title, body, entity_type: entityType, entity_id: entityId, org_id: orgId });
  // Also notify team managers
  const { data: tms } = await client.from("team_members").select("team_id").eq("user_id", userId);
  if (tms) {
    for (const tm of tms) {
      const { data: mgrs } = await client.from("team_members").select("user_id")
        .eq("team_id", tm.team_id).eq("is_team_manager", true);
      if (mgrs) {
        for (const mgr of mgrs) {
          if (mgr.user_id !== userId) {
            await client.from("notifications").insert({
              user_id: mgr.user_id, type, title: `[Team] ${title}`, body,
              entity_type: entityType, entity_id: entityId, org_id: orgId,
            });
          }
        }
      }
    }
  }
}
