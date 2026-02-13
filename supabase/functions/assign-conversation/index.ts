/**
 * Edge Function: assign-conversation
 *
 * POST /functions/v1/assign-conversation
 * Body: { conversation_id, owner_user_id?, owner_team_id?, status?, priority?, ai_paused?, outcome? }
 *
 * Updates conversation workflow fields and logs conversation_events.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AssignRequest {
  conversation_id: string;
  owner_user_id?: string | null;
  owner_team_id?: string | null;
  status?: string;
  priority?: string;
  ai_paused?: boolean;
  outcome?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract actor from auth header
    const authHeader = req.headers.get("authorization") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    let actorUserId: string | null = null;

    // Try to get user from JWT
    if (authHeader.startsWith("Bearer ") && authHeader.slice(7) !== anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      actorUserId = user?.id ?? null;
    }

    const body: AssignRequest = await req.json();
    if (!body.conversation_id) {
      return json({ error: "conversation_id is required" }, 400);
    }

    // Load conversation
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, org_id, owner_user_id, owner_team_id, status, priority, ai_paused, outcome")
      .eq("id", body.conversation_id)
      .single();

    if (convErr || !conv) {
      return json({ error: "Conversation not found" }, 404);
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const events: Array<{ event_type: string; details: Record<string, unknown> }> = [];

    // Assignment changes
    if (body.owner_user_id !== undefined) {
      updates.owner_user_id = body.owner_user_id;
      updates.owner_team_id = null; // Mutually exclusive
      events.push({
        event_type: "assigned",
        details: {
          from_user_id: conv.owner_user_id,
          to_user_id: body.owner_user_id,
        },
      });
    }
    if (body.owner_team_id !== undefined) {
      updates.owner_team_id = body.owner_team_id;
      updates.owner_user_id = null;
      events.push({
        event_type: "assigned_team",
        details: {
          from_team_id: conv.owner_team_id,
          to_team_id: body.owner_team_id,
        },
      });
    }

    // Status change
    const validStatuses = ["open", "waiting_on_customer", "needs_handoff", "resolved", "closed"];
    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, 400);
      }
      updates.status = body.status;
      events.push({
        event_type: "status_changed",
        details: { from: conv.status, to: body.status },
      });

      // Auto-pause AI on needs_handoff
      if (body.status === "needs_handoff" && !conv.ai_paused) {
        updates.ai_paused = true;
        events.push({ event_type: "ai_paused", details: { reason: "needs_handoff" } });
      }
    }

    // Priority
    const validPriorities = ["low", "normal", "high", "urgent"];
    if (body.priority !== undefined) {
      if (!validPriorities.includes(body.priority)) {
        return json({ error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` }, 400);
      }
      updates.priority = body.priority;
      events.push({
        event_type: "priority_changed",
        details: { from: conv.priority, to: body.priority },
      });
    }

    // AI paused
    if (body.ai_paused !== undefined) {
      updates.ai_paused = body.ai_paused;
      events.push({
        event_type: body.ai_paused ? "ai_paused" : "ai_resumed",
        details: { manual: true },
      });
    }

    // Outcome
    if (body.outcome !== undefined) {
      updates.outcome = body.outcome;
      events.push({
        event_type: "outcome_set",
        details: { outcome: body.outcome },
      });
    }

    // Apply updates
    const { error: updateErr } = await supabase
      .from("conversations")
      .update(updates)
      .eq("id", body.conversation_id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return json({ error: "Failed to update conversation" }, 500);
    }

    // Log events
    for (const ev of events) {
      await supabase.from("conversation_events").insert({
        org_id: conv.org_id,
        conversation_id: body.conversation_id,
        actor_user_id: actorUserId,
        event_type: ev.event_type,
        details: ev.details,
      });
    }

    // Create notification for assignee
    if (body.owner_user_id && body.owner_user_id !== actorUserId) {
      await supabase.from("notifications").insert({
        user_id: body.owner_user_id,
        org_id: conv.org_id,
        type: "conversation_assigned",
        title: "Conversation assigned to you",
        body: `A conversation has been assigned to you.`,
        entity_type: "conversation",
        entity_id: body.conversation_id,
      });
    }

    return json({ ok: true, conversation_id: body.conversation_id, updates });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
