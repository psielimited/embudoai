/**
 * Edge Function: generate-report-csv (org-aware)
 * CSV exports filtered by active org and role scope.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;
  const sc = createClient(supabaseUrl, serviceKey);

  const { data: profile } = await sc.from("profiles").select("active_org_id").eq("user_id", userId).single();
  if (!profile?.active_org_id) {
    return new Response(JSON.stringify({ error: "No active org" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const orgId = profile.active_org_id;

  const { data: membership } = await sc.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).single();
  if (!membership) {
    return new Response(JSON.stringify({ error: "Not a member" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const reportType = url.searchParams.get("type") || "funnel";

  try {
    let csv = "";
    const { data: stages } = await sc.from("stages").select("id, name").eq("org_id", orgId);
    const stageMap = new Map((stages || []).map(s => [s.id, s.name]));

    if (reportType === "funnel") {
      const { data: events } = await sc.from("audit_events").select("created_at, diff, opportunity_id")
        .eq("event_type", "stage_changed").eq("org_id", orgId).order("created_at", { ascending: true });

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
      for (const [day, sts] of Object.entries(grouped).sort()) {
        for (const [stage, count] of Object.entries(sts)) csv += `${day},"${stage}",${count}\n`;
      }
    } else if (reportType === "time_in_stage") {
      const { data: events } = await sc.from("audit_events").select("opportunity_id, created_at, diff")
        .eq("event_type", "stage_changed").eq("org_id", orgId).order("created_at", { ascending: true });

      const byOpp: Record<string, Array<{ to_stage_id: string; at: string }>> = {};
      for (const e of (events || [])) {
        const ts = (e.diff as any)?.to_stage_id;
        if (!ts) continue;
        if (!byOpp[e.opportunity_id]) byOpp[e.opportunity_id] = [];
        byOpp[e.opportunity_id].push({ to_stage_id: ts, at: e.created_at });
      }

      // Filter by role
      let allowedOpps: Set<string> | null = null;
      if (membership.role === "rep") {
        const { data: myOpps } = await sc.from("opportunities").select("id").eq("owner_user_id", userId).eq("org_id", orgId);
        allowedOpps = new Set((myOpps || []).map(o => o.id));
      }

      csv = "opportunity_id,stage_name,entered_at,exited_at,duration_hours\n";
      for (const [oppId, transitions] of Object.entries(byOpp)) {
        if (allowedOpps && !allowedOpps.has(oppId)) continue;
        for (let i = 0; i < transitions.length; i++) {
          const entered = transitions[i].at;
          const exited = transitions[i + 1]?.at || "";
          const dur = exited ? ((new Date(exited).getTime() - new Date(entered).getTime()) / 3600000).toFixed(2) : "";
          csv += `${oppId},"${stageMap.get(transitions[i].to_stage_id) || transitions[i].to_stage_id}",${entered},${exited},${dur}\n`;
        }
      }
    } else if (reportType === "rep_performance") {
      let oppFilter: string[] | null = null;
      if (membership.role === "rep") {
        const { data: myOpps } = await sc.from("opportunities").select("id").eq("owner_user_id", userId).eq("org_id", orgId);
        oppFilter = (myOpps || []).map(o => o.id);
      } else {
        const { data: allOpps } = await sc.from("opportunities").select("id").eq("org_id", orgId);
        oppFilter = (allOpps || []).map(o => o.id);
      }

      const { data: activities } = await sc.from("activities").select("created_at, entity_id, created_by")
        .eq("entity_type", "opportunity").eq("org_id", orgId).order("created_at", { ascending: true });

      const { data: allProfiles } = await sc.from("profiles").select("user_id, full_name");
      const nameMap = new Map((allProfiles || []).map(p => [p.user_id, p.full_name || p.user_id]));

      csv = "day,rep_name,activities_count\n";
      const grouped: Record<string, Record<string, number>> = {};
      for (const a of (activities || [])) {
        if (oppFilter && !oppFilter.includes(a.entity_id)) continue;
        const day = a.created_at.slice(0, 10);
        const owner = a.created_by;
        if (!grouped[day]) grouped[day] = {};
        grouped[day][owner] = (grouped[day][owner] || 0) + 1;
      }
      for (const [day, reps] of Object.entries(grouped).sort()) {
        for (const [rep, count] of Object.entries(reps)) csv += `${day},"${nameMap.get(rep) || rep}",${count}\n`;
      }
    } else {
      return new Response(JSON.stringify({ error: "Unknown report type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(csv, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${reportType}_report.csv"` },
    });
  } catch (err) {
    console.error("Report error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
