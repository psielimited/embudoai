/**
 * Edge Function: nightly-analytics-rollup
 * Runs daily (via cron at 02:30) to aggregate metrics into analytics_daily.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey);

  // Default to yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const day = yesterday.toISOString().slice(0, 10);

  const startOfDay = `${day}T00:00:00Z`;
  const endOfDay = `${day}T23:59:59.999Z`;

  try {
    const { data: pipelines } = await client.from("pipelines").select("id");
    if (!pipelines || pipelines.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No pipelines" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metrics: Array<{ pipeline_id: string; owner_user_id: string | null; metric: string; value: number }> = [];

    for (const pipeline of pipelines) {
      const pid = pipeline.id;

      // Stage entries from audit_events
      const { data: stageChanges } = await client
        .from("audit_events")
        .select("diff, opportunity_id")
        .eq("event_type", "stage_changed")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay);

      // Filter by pipeline
      const relevantChanges = (stageChanges || []).filter((ae: any) => {
        return ae.diff && ae.diff.to_stage_id;
      });

      // Get opportunities for this pipeline
      const { data: pipelineOpps } = await client
        .from("opportunities")
        .select("id, owner_user_id, status")
        .eq("pipeline_id", pid);

      const oppIds = new Set((pipelineOpps || []).map((o: any) => o.id));

      // Stage entry counts
      const stageEntryCounts: Record<string, number> = {};
      for (const ae of relevantChanges) {
        if (oppIds.has(ae.opportunity_id)) {
          const stageId = (ae.diff as any).to_stage_id;
          stageEntryCounts[stageId] = (stageEntryCounts[stageId] || 0) + 1;
        }
      }

      for (const [stageId, count] of Object.entries(stageEntryCounts)) {
        metrics.push({ pipeline_id: pid, owner_user_id: null, metric: `stage_entries_${stageId}`, value: count });
      }

      // Won / Lost counts
      const { data: wonOpps } = await client
        .from("opportunities")
        .select("id, owner_user_id")
        .eq("pipeline_id", pid)
        .eq("status", "won")
        .gte("updated_at", startOfDay)
        .lte("updated_at", endOfDay);

      const { data: lostOpps } = await client
        .from("opportunities")
        .select("id, owner_user_id")
        .eq("pipeline_id", pid)
        .eq("status", "lost")
        .gte("updated_at", startOfDay)
        .lte("updated_at", endOfDay);

      metrics.push({ pipeline_id: pid, owner_user_id: null, metric: "won_count", value: (wonOpps || []).length });
      metrics.push({ pipeline_id: pid, owner_user_id: null, metric: "lost_count", value: (lostOpps || []).length });

      // Per-owner activity counts
      const ownerActivities: Record<string, number> = {};
      for (const opp of (pipelineOpps || [])) {
        const { count } = await client
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("entity_type", "opportunity")
          .eq("entity_id", opp.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        ownerActivities[opp.owner_user_id] = (ownerActivities[opp.owner_user_id] || 0) + (count || 0);
      }

      for (const [ownerId, count] of Object.entries(ownerActivities)) {
        metrics.push({ pipeline_id: pid, owner_user_id: ownerId, metric: "activities_count", value: count });
      }

      // Overdue tasks per owner
      const ownerOverdue: Record<string, number> = {};
      for (const opp of (pipelineOpps || [])) {
        const { count } = await client
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("opportunity_id", opp.id)
          .eq("completed", false)
          .not("due_at", "is", null)
          .lt("due_at", endOfDay);

        ownerOverdue[opp.owner_user_id] = (ownerOverdue[opp.owner_user_id] || 0) + (count || 0);
      }

      for (const [ownerId, count] of Object.entries(ownerOverdue)) {
        metrics.push({ pipeline_id: pid, owner_user_id: ownerId, metric: "overdue_tasks_count", value: count });
      }
    }

    // Upsert metrics using the unique index
    for (const m of metrics) {
      const nullSafeOwner = m.owner_user_id || "00000000-0000-0000-0000-000000000000";
      // Delete existing then insert (simple upsert via unique index)
      await client
        .from("analytics_daily")
        .delete()
        .eq("day", day)
        .eq("pipeline_id", m.pipeline_id)
        .eq("metric", m.metric)
        .eq("owner_user_id", m.owner_user_id as any);

      await client.from("analytics_daily").insert({
        day,
        pipeline_id: m.pipeline_id,
        owner_user_id: m.owner_user_id,
        metric: m.metric,
        value: m.value,
      });
    }

    console.log(`Analytics rollup for ${day}: ${metrics.length} metrics upserted`);
    return new Response(JSON.stringify({ ok: true, day, metrics_count: metrics.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Analytics rollup error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
