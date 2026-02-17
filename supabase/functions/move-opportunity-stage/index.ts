/**
 * Edge Function: move-opportunity-stage
 * Authenticates user, authorizes access, calls RPC.
 * After success, executes automation rules (Phase 4).
 * Org-aware: validates entity.org_id matches user's active org.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AutomationAction {
  type: "create_task" | "assign_owner";
  title?: string;
  due_in_hours?: number;
  assigned_to?: string;
  user_id?: string;
}

async function executeAutomationRules(
  serviceClient: any, opportunityId: string, fromStageId: string,
  toStageId: string, pipelineId: string, ownerUserId: string, orgId: string,
) {
  try {
    const { data: subscription } = await serviceClient
      .from("org_subscriptions")
      .select("status, trial_ends_at, subscription_plans(automation_enabled)")
      .eq("org_id", orgId)
      .maybeSingle();

    const trialExpired = subscription?.status === "trial"
      && !!subscription?.trial_ends_at
      && new Date(subscription.trial_ends_at).getTime() <= Date.now();
    const activeState = ["active", "trial"].includes(subscription?.status ?? "trial") && !trialExpired;
    const automationEnabledByPlan = subscription?.subscription_plans?.automation_enabled ?? false;

    if (!activeState || !automationEnabledByPlan) {
      return;
    }

    const { data: rules } = await serviceClient
      .from("automation_rules")
      .select("*")
      .eq("trigger_type", "stage_changed")
      .eq("is_active", true)
      .eq("org_id", orgId);

    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
      const conds = rule.conditions || {};
      if (conds.pipeline_id && conds.pipeline_id !== pipelineId) continue;
      if (conds.from_stage_id && conds.from_stage_id !== fromStageId) continue;
      if (conds.to_stage_id && conds.to_stage_id !== toStageId) continue;

      const actions: AutomationAction[] = Array.isArray(rule.actions) ? rule.actions : [];
      for (const action of actions) {
        if (action.type === "create_task") {
          let assignedTo = ownerUserId;
          if (action.assigned_to === "manager") {
            const { data: tms } = await serviceClient
              .from("team_members")
              .select("team_id, is_team_manager")
              .eq("user_id", ownerUserId);
            if (tms) {
              for (const tm of tms) {
                if (!tm.is_team_manager) {
                  const { data: mgrs } = await serviceClient
                    .from("team_members")
                    .select("user_id")
                    .eq("team_id", tm.team_id)
                    .eq("is_team_manager", true)
                    .limit(1);
                  if (mgrs?.[0]) { assignedTo = mgrs[0].user_id; break; }
                }
              }
            }
          } else if (action.assigned_to && action.assigned_to !== "owner") {
            assignedTo = action.assigned_to;
          }

          const dueAt = action.due_in_hours
            ? new Date(Date.now() + action.due_in_hours * 3600000).toISOString()
            : null;

          await serviceClient.from("tasks").insert({
            opportunity_id: opportunityId,
            title: action.title || "Follow up",
            due_at: dueAt,
            assigned_to: assignedTo,
            created_by: ownerUserId,
            org_id: orgId,
          });
        } else if (action.type === "assign_owner" && action.user_id) {
          await serviceClient
            .from("opportunities")
            .update({ owner_user_id: action.user_id })
            .eq("id", opportunityId);
        }
      }
    }
  } catch (err) {
    console.error("Automation rule execution error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // Get user's active org and org role
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("active_org_id")
    .eq("user_id", userId)
    .single();

  if (!profile?.active_org_id) {
    return new Response(JSON.stringify({ error: "No active organization" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const activeOrgId = profile.active_org_id;

  const { data: membership } = await serviceClient
    .from("org_members")
    .select("role")
    .eq("org_id", activeOrgId)
    .eq("user_id", userId)
    .single();

  if (!membership) {
    return new Response(JSON.stringify({ error: "Not a member of active org" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { opportunity_id, to_stage_id, expected_version } = body;

    if (!opportunity_id || !to_stage_id || expected_version === undefined) {
      return new Response(
        JSON.stringify({ error: "opportunity_id, to_stage_id, expected_version are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: opp } = await serviceClient
      .from("opportunities")
      .select("owner_user_id, pipeline_id, stage_id, org_id")
      .eq("id", opportunity_id)
      .single();

    if (!opp) {
      return new Response(JSON.stringify({ error: "Opportunity not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Org isolation check
    if (opp.org_id !== activeOrgId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = membership.role;
    const isOwner = opp.owner_user_id === userId;

    if (role === "rep" && !isOwner) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role === "analyst") {
      return new Response(JSON.stringify({ error: "Analysts cannot move opportunities" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call RPC
    const { data: result, error: rpcError } = await serviceClient.rpc(
      "rpc_move_opportunity_stage",
      {
        p_opportunity_id: opportunity_id,
        p_to_stage_id: to_stage_id,
        p_expected_version: expected_version,
        p_actor_user_id: userId,
      }
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcResult = typeof result === "string" ? JSON.parse(result) : result;

    if (!rpcResult.ok) {
      const status =
        rpcResult.error_code === "VERSION_CONFLICT" || rpcResult.error_code === "STAGE_GATE_FAILED"
          ? 409 : 400;
      return new Response(JSON.stringify(rpcResult), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await executeAutomationRules(
      serviceClient, opportunity_id, opp.stage_id, to_stage_id,
      opp.pipeline_id, opp.owner_user_id, activeOrgId,
    );

    return new Response(JSON.stringify(rpcResult), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
