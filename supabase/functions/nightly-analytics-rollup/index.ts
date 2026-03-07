/**
 * Edge Function: nightly-analytics-rollup (org-aware)
 * Aggregates metrics per org into analytics_daily.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const day = yesterday.toISOString().slice(0, 10);
  const startOfDay = `${day}T00:00:00Z`;
  const endOfDay = `${day}T23:59:59.999Z`;

  try {
    const { data: orgs } = await client.from("orgs").select("id");
    if (!orgs) return new Response(JSON.stringify({ ok: true, message: "No orgs" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    let totalMetrics = 0;

    for (const org of orgs) {
      const orgId = org.id;
      const { data: pipelines } = await client.from("pipelines").select("id").eq("org_id", orgId);
      if (!pipelines) continue;

      const metrics: Array<{ pipeline_id: string; owner_user_id: string | null; metric: string; value: number }> = [];

      for (const pipeline of pipelines) {
        const pid = pipeline.id;

        const { data: stageChanges } = await client.from("audit_events")
          .select("diff, opportunity_id").eq("event_type", "stage_changed").eq("org_id", orgId)
          .gte("created_at", startOfDay).lte("created_at", endOfDay);

        const { data: pipelineOpps } = await client.from("opportunities")
          .select("id, owner_user_id, status").eq("pipeline_id", pid).eq("org_id", orgId);
        const oppIds = new Set((pipelineOpps || []).map(o => o.id));

        const stageEntryCounts: Record<string, number> = {};
        for (const ae of (stageChanges || [])) {
          if (oppIds.has(ae.opportunity_id) && (ae.diff as any)?.to_stage_id) {
            const sid = (ae.diff as any).to_stage_id;
            stageEntryCounts[sid] = (stageEntryCounts[sid] || 0) + 1;
          }
        }
        for (const [sid, count] of Object.entries(stageEntryCounts)) {
          metrics.push({ pipeline_id: pid, owner_user_id: null, metric: `stage_entries_${sid}`, value: count });
        }

        const { data: wonOpps } = await client.from("opportunities").select("id")
          .eq("pipeline_id", pid).eq("org_id", orgId).eq("status", "won")
          .gte("updated_at", startOfDay).lte("updated_at", endOfDay);
        const { data: lostOpps } = await client.from("opportunities").select("id")
          .eq("pipeline_id", pid).eq("org_id", orgId).eq("status", "lost")
          .gte("updated_at", startOfDay).lte("updated_at", endOfDay);

        metrics.push({ pipeline_id: pid, owner_user_id: null, metric: "won_count", value: (wonOpps || []).length });
        metrics.push({ pipeline_id: pid, owner_user_id: null, metric: "lost_count", value: (lostOpps || []).length });

        const ownerActs: Record<string, number> = {};
        for (const opp of (pipelineOpps || [])) {
          const { count } = await client.from("activities").select("id", { count: "exact", head: true })
            .eq("entity_type", "opportunity").eq("entity_id", opp.id)
            .gte("created_at", startOfDay).lte("created_at", endOfDay);
          ownerActs[opp.owner_user_id] = (ownerActs[opp.owner_user_id] || 0) + (count || 0);
        }
        for (const [oid, count] of Object.entries(ownerActs)) {
          metrics.push({ pipeline_id: pid, owner_user_id: oid, metric: "activities_count", value: count });
        }
      }

      // Upsert
      for (const m of metrics) {
        await client.from("analytics_daily").delete()
          .eq("day", day).eq("pipeline_id", m.pipeline_id).eq("metric", m.metric)
          .eq("org_id", orgId).eq("owner_user_id", m.owner_user_id as any);
        await client.from("analytics_daily").insert({
          day, pipeline_id: m.pipeline_id, owner_user_id: m.owner_user_id,
          metric: m.metric, value: m.value, org_id: orgId,
        });
      }
      totalMetrics += metrics.length;
    }

    const shouldRunDemoReset = (Deno.env.get("DEMO_NIGHTLY_RESET") ?? "false").toLowerCase() === "true";
    let demoResetResult: unknown = null;

    if (shouldRunDemoReset) {
      try {
        const cronSecret = Deno.env.get("DEMO_RESET_CRON_SECRET") ?? "";
        const authToken = cronSecret || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        if (authToken) {
          const resetResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/demo-nightly-reset`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ source: "nightly-analytics-rollup" }),
          });
          demoResetResult = await resetResp.json().catch(() => ({ ok: false, error: "Invalid JSON response" }));
        } else {
          demoResetResult = { ok: false, error: "Missing auth token for demo-nightly-reset" };
        }
      } catch (resetErr) {
        console.error("Demo nightly reset invoke error:", resetErr);
        demoResetResult = { ok: false, error: "Failed to invoke demo-nightly-reset" };
      }
    }

    return new Response(JSON.stringify({ ok: true, day, metrics_count: totalMetrics, demo_reset: demoResetResult }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Analytics rollup error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
