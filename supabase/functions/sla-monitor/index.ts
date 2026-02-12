/**
 * Edge Function: sla-monitor
 * Runs periodically (every 15 min via cron) to detect SLA breaches.
 * - NO_ACTIVITY: open opportunity with no activity in N hours
 * - TASK_OVERDUE: tasks past due
 * - TIME_IN_STAGE: opportunity stuck in stage > threshold days
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Configurable SLA thresholds
const NO_ACTIVITY_HOURS = 48;
const TASK_OVERDUE_GRACE_HOURS = 2;
const TIME_IN_STAGE_DAYS: Record<string, number> = {}; // stage_name -> days, default 14

const DEFAULT_TIME_IN_STAGE_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey);

  const results = { no_activity: 0, task_overdue: 0, time_in_stage: 0, notifications: 0 };

  try {
    // 1. NO_ACTIVITY breaches
    const cutoff = new Date(Date.now() - NO_ACTIVITY_HOURS * 3600000).toISOString();
    const { data: openOpps } = await client
      .from("opportunities")
      .select("id, owner_user_id, name, updated_at")
      .eq("status", "open");

    if (openOpps) {
      for (const opp of openOpps) {
        // Check last activity
        const { data: lastActivity } = await client
          .from("activities")
          .select("created_at")
          .eq("entity_type", "opportunity")
          .eq("entity_id", opp.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastAt = lastActivity?.[0]?.created_at || opp.updated_at;
        if (lastAt < cutoff) {
          const created = await upsertSlaEvent(client, opp.id, "NO_ACTIVITY", "warn", {
            last_activity_at: lastAt,
            threshold_hours: NO_ACTIVITY_HOURS,
          });
          if (created) {
            results.no_activity++;
            await notify(client, opp.owner_user_id, "sla_breach", 
              `No activity on "${opp.name}"`,
              `No activity for ${NO_ACTIVITY_HOURS}+ hours`,
              "opportunity", opp.id);
            results.notifications++;
          }
        }
      }
    }

    // 2. TASK_OVERDUE breaches
    const graceTime = new Date(Date.now() - TASK_OVERDUE_GRACE_HOURS * 3600000).toISOString();
    const { data: overdueTasks } = await client
      .from("tasks")
      .select("id, opportunity_id, title, assigned_to, due_at")
      .eq("completed", false)
      .not("due_at", "is", null)
      .lt("due_at", graceTime);

    if (overdueTasks) {
      for (const task of overdueTasks) {
        const created = await upsertSlaEvent(client, task.opportunity_id, "TASK_OVERDUE", "breach", {
          task_id: task.id,
          task_title: task.title,
          due_at: task.due_at,
        });
        if (created) {
          results.task_overdue++;
          if (task.assigned_to) {
            await notify(client, task.assigned_to, "sla_breach",
              `Task overdue: "${task.title}"`,
              `Due at ${task.due_at}`,
              "opportunity", task.opportunity_id);
            results.notifications++;
          }
        }
      }
    }

    // 3. TIME_IN_STAGE breaches
    const { data: stages } = await client.from("stages").select("id, name");
    const stageMap = new Map((stages || []).map(s => [s.id, s.name]));

    if (openOpps) {
      for (const opp of openOpps) {
        // Get last stage change
        const { data: lastChange } = await client
          .from("audit_events")
          .select("created_at, diff")
          .eq("opportunity_id", opp.id)
          .eq("event_type", "stage_changed")
          .order("created_at", { ascending: false })
          .limit(1);

        const enteredAt = lastChange?.[0]?.created_at || opp.updated_at;
        const toStageId = lastChange?.[0]?.diff?.to_stage_id;
        const stageName = toStageId ? stageMap.get(toStageId) : null;
        const threshold = (stageName && TIME_IN_STAGE_DAYS[stageName]) || DEFAULT_TIME_IN_STAGE_DAYS;
        const thresholdMs = threshold * 24 * 3600000;

        if (Date.now() - new Date(enteredAt).getTime() > thresholdMs) {
          const created = await upsertSlaEvent(client, opp.id, "TIME_IN_STAGE", "warn", {
            stage_name: stageName || "unknown",
            entered_at: enteredAt,
            threshold_days: threshold,
          });
          if (created) {
            results.time_in_stage++;
            await notify(client, opp.owner_user_id, "sla_breach",
              `"${opp.name}" stuck in ${stageName || "stage"}`,
              `In stage for ${threshold}+ days`,
              "opportunity", opp.id);
            results.notifications++;
          }
        }
      }
    }

    // 4. Auto-resolve SLA events where condition no longer applies
    // Resolve TASK_OVERDUE for completed tasks
    const { data: openTaskSlas } = await client
      .from("sla_events")
      .select("id, details")
      .eq("sla_type", "TASK_OVERDUE")
      .is("resolved_at", null);

    if (openTaskSlas) {
      for (const sla of openTaskSlas) {
        const taskId = (sla.details as any)?.task_id;
        if (taskId) {
          const { data: task } = await client.from("tasks").select("completed").eq("id", taskId).single();
          if (task?.completed) {
            await client.from("sla_events").update({ resolved_at: new Date().toISOString() }).eq("id", sla.id);
          }
        }
      }
    }

    console.log("SLA monitor results:", results);
    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SLA monitor error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function upsertSlaEvent(
  client: any, entityId: string, slaType: string, severity: string, details: any
): Promise<boolean> {
  // Dedupe: don't create if unresolved event of same type exists
  const { data: existing } = await client
    .from("sla_events")
    .select("id")
    .eq("entity_id", entityId)
    .eq("sla_type", slaType)
    .is("resolved_at", null)
    .limit(1);

  if (existing && existing.length > 0) return false;

  await client.from("sla_events").insert({
    entity_type: "opportunity",
    entity_id: entityId,
    sla_type: slaType,
    severity,
    details,
  });
  return true;
}

async function notify(
  client: any, userId: string, type: string, title: string, body: string,
  entityType: string, entityId: string,
) {
  await client.from("notifications").insert({ user_id: userId, type, title, body, entity_type: entityType, entity_id: entityId });
  // Also notify manager
  const { data: profile } = await client.from("profiles").select("manager_user_id").eq("user_id", userId).single();
  if (profile?.manager_user_id) {
    await client.from("notifications").insert({
      user_id: profile.manager_user_id, type, title: `[Team] ${title}`, body, entity_type: entityType, entity_id: entityId,
    });
  }
}
