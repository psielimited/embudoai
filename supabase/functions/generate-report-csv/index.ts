/**
 * Edge Function: generate-report-csv
 * Generates CSV reports server-side respecting RLS-like filtering.
 * Authenticated users only. Supports report types:
 *  - funnel: Funnel counts by stage/day
 *  - time_in_stage: Time in stage per opportunity
 *  - rep_performance: Rep performance daily
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;
  const serviceClient = createClient(supabaseUrl, serviceKey);

  // Get user role
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role, manager_user_id")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const reportType = url.searchParams.get("type") || "funnel";

  try {
    let csv = "";

    if (reportType === "funnel") {
      // Use audit_events to build funnel data
      const { data: stages } = await serviceClient.from("stages").select("id, name, pipeline_id").order("position");
      const stageMap = new Map((stages || []).map(s => [s.id, s.name]));

      let query = serviceClient
        .from("audit_events")
        .select("created_at, diff, opportunity_id")
        .eq("event_type", "stage_changed")
        .order("created_at", { ascending: true });

      const { data: events } = await query;

      csv = "day,stage_name,entries\n";
      const grouped: Record<string, Record<string, number>> = {};
      for (const e of (events || [])) {
        const toStage = (e.diff as any)?.to_stage_id;
        if (!toStage) continue;
        const day = e.created_at.slice(0, 10);
        const name = stageMap.get(toStage) || toStage;
        if (!grouped[day]) grouped[day] = {};
        grouped[day][name] = (grouped[day][name] || 0) + 1;
      }
      for (const [day, stages] of Object.entries(grouped).sort()) {
        for (const [stage, count] of Object.entries(stages)) {
          csv += `${day},"${stage}",${count}\n`;
        }
      }
    } else if (reportType === "time_in_stage") {
      const { data: stages } = await serviceClient.from("stages").select("id, name");
      const stageMap = new Map((stages || []).map(s => [s.id, s.name]));

      // Build from audit_events
      const { data: events } = await serviceClient
        .from("audit_events")
        .select("opportunity_id, created_at, diff")
        .eq("event_type", "stage_changed")
        .order("created_at", { ascending: true });

      // Group by opportunity
      const byOpp: Record<string, Array<{ to_stage_id: string; at: string }>> = {};
      for (const e of (events || [])) {
        const toStage = (e.diff as any)?.to_stage_id;
        if (!toStage) continue;
        if (!byOpp[e.opportunity_id]) byOpp[e.opportunity_id] = [];
        byOpp[e.opportunity_id].push({ to_stage_id: toStage, at: e.created_at });
      }

      csv = "opportunity_id,stage_name,entered_at,exited_at,duration_hours\n";
      for (const [oppId, transitions] of Object.entries(byOpp)) {
        // Filter by role
        if (profile.role === "rep") {
          const { data: opp } = await serviceClient.from("opportunities").select("owner_user_id").eq("id", oppId).single();
          if (opp?.owner_user_id !== userId) continue;
        }

        for (let i = 0; i < transitions.length; i++) {
          const entered = transitions[i].at;
          const exited = transitions[i + 1]?.at || "";
          const dur = exited
            ? ((new Date(exited).getTime() - new Date(entered).getTime()) / 3600000).toFixed(2)
            : "";
          const sName = stageMap.get(transitions[i].to_stage_id) || transitions[i].to_stage_id;
          csv += `${oppId},"${sName}",${entered},${exited},${dur}\n`;
        }
      }
    } else if (reportType === "rep_performance") {
      // Activities per rep per day
      let oppFilter: string[] | null = null;
      if (profile.role === "rep") {
        const { data: myOpps } = await serviceClient.from("opportunities").select("id").eq("owner_user_id", userId);
        oppFilter = (myOpps || []).map(o => o.id);
      } else if (profile.role === "manager") {
        const { data: teamUsers } = await serviceClient.from("profiles").select("user_id").eq("manager_user_id", userId);
        const userIds = [userId, ...(teamUsers || []).map(u => u.user_id)];
        const { data: teamOpps } = await serviceClient.from("opportunities").select("id").in("owner_user_id", userIds);
        oppFilter = (teamOpps || []).map(o => o.id);
      }

      let actQuery = serviceClient
        .from("activities")
        .select("created_at, entity_id, created_by")
        .eq("entity_type", "opportunity")
        .order("created_at", { ascending: true });

      const { data: activities } = await actQuery;

      const oppOwners = new Map<string, string>();
      if (oppFilter) {
        for (const oppId of oppFilter) {
          const { data: o } = await serviceClient.from("opportunities").select("owner_user_id").eq("id", oppId).single();
          if (o) oppOwners.set(oppId, o.owner_user_id);
        }
      }

      // Get profiles for names
      const { data: allProfiles } = await serviceClient.from("profiles").select("user_id, full_name");
      const nameMap = new Map((allProfiles || []).map(p => [p.user_id, p.full_name || p.user_id]));

      csv = "day,rep_name,activities_count\n";
      const grouped: Record<string, Record<string, number>> = {};
      for (const a of (activities || [])) {
        if (oppFilter && !oppFilter.includes(a.entity_id)) continue;
        const day = a.created_at.slice(0, 10);
        const owner = oppOwners.get(a.entity_id) || a.created_by;
        if (!grouped[day]) grouped[day] = {};
        grouped[day][owner] = (grouped[day][owner] || 0) + 1;
      }

      for (const [day, reps] of Object.entries(grouped).sort()) {
        for (const [rep, count] of Object.entries(reps)) {
          csv += `${day},"${nameMap.get(rep) || rep}",${count}\n`;
        }
      }
    } else {
      return new Response(JSON.stringify({ error: "Unknown report type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${reportType}_report.csv"`,
      },
    });
  } catch (err) {
    console.error("Report generation error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
