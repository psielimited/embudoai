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

      // 1. NO_ACTIVITY
      const cutoff = new Date(Date.now() - NO_ACTIVITY_HOURS * 3600000).toISOString();
      const { data: openOpps } = await client
        .from("opportunities").select("id, owner_user_id, name, updated_at")
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

      if (openOpps) {
        for (const opp of openOpps) {
          const { data: last } = await client.from("audit_events").select("created_at, diff")
            .eq("opportunity_id", opp.id).eq("event_type", "stage_changed")
            .order("created_at", { ascending: false }).limit(1);
          const enteredAt = last?.[0]?.created_at || opp.updated_at;
          const toStageId = (last?.[0]?.diff as any)?.to_stage_id;
          const stageName = toStageId ? stageMap.get(toStageId) : null;
          const threshold = DEFAULT_TIME_IN_STAGE_DAYS;
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

async function upsertSla(client: any, entityId: string, slaType: string, severity: string, details: any, orgId: string) {
  const { data: existing } = await client.from("sla_events").select("id")
    .eq("entity_id", entityId).eq("sla_type", slaType).eq("org_id", orgId).is("resolved_at", null).limit(1);
  if (existing && existing.length > 0) return false;
  await client.from("sla_events").insert({
    entity_type: "opportunity", entity_id: entityId, sla_type: slaType, severity, details, org_id: orgId,
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
