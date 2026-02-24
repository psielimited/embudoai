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

type Action = "seed" | "cleanup";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = (body?.action as Action | undefined) ?? "seed";
    if (!["seed", "cleanup"].includes(action)) return json({ error: "Invalid action" }, 400);

    const { data: profile } = await service
      .from("profiles")
      .select("active_org_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    const orgId = profile?.active_org_id ?? null;
    if (!orgId) return json({ error: "No active organization" }, 400);

    const { data: membership } = await service
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = profile?.role === "admin" || membership?.role === "org_admin" || membership?.role === "admin";
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const seedContact = "18095550001";
    const seedMerchantName = "DEV Merchant";
    const seedLeadName = "DEV Lead";
    const seedContactName = "DEV Contact";
    const seedOppName = "DEV Opportunity - WhatsApp Demo";

    if (action === "cleanup") {
      const { data: merchants } = await service
        .from("merchants")
        .select("id")
        .eq("org_id", orgId)
        .eq("name", seedMerchantName);
      const merchantIds = (merchants ?? []).map((m) => m.id);

      const { data: conversations } = await service
        .from("conversations")
        .select("id")
        .eq("org_id", orgId)
        .eq("external_contact", seedContact);
      const convIds = (conversations ?? []).map((c) => c.id);

      if (convIds.length > 0) {
        await service.from("outbound_jobs").delete().in("conversation_id", convIds);
        const { data: runs } = await service.from("ai_agent_runs").select("id").in("conversation_id", convIds);
        const runIds = (runs ?? []).map((r) => r.id);
        if (runIds.length > 0) {
          await service.from("ai_agent_actions").delete().in("run_id", runIds);
          await service.from("ai_agent_runs").delete().in("id", runIds);
        }
        await service.from("conversation_events").delete().in("conversation_id", convIds);
        await service.from("messages").delete().in("conversation_id", convIds);
        await service.from("conversations").delete().in("id", convIds);
      }

      const { data: opps } = await service
        .from("opportunities")
        .select("id")
        .eq("org_id", orgId)
        .eq("name", seedOppName);
      const oppIds = (opps ?? []).map((o) => o.id);
      if (oppIds.length > 0) {
        await service.from("tasks").delete().in("opportunity_id", oppIds);
        await service.from("activities").delete().eq("entity_type", "opportunity").in("entity_id", oppIds);
        await service.from("opportunities").delete().in("id", oppIds);
      }

      const { data: leads } = await service
        .from("leads")
        .select("id")
        .eq("org_id", orgId)
        .eq("full_name", seedLeadName);
      const leadIds = (leads ?? []).map((l) => l.id);
      if (leadIds.length > 0) {
        await service.from("contact_channels").delete().in("lead_id", leadIds);
        await service.from("leads").delete().in("id", leadIds);
      }

      const { data: contacts } = await service
        .from("contacts")
        .select("id")
        .eq("org_id", orgId)
        .eq("full_name", seedContactName);
      const contactIds = (contacts ?? []).map((c) => c.id);
      if (contactIds.length > 0) {
        await service.from("contact_channels").delete().in("contact_id", contactIds);
        await service.from("contacts").delete().in("id", contactIds);
      }

      await service
        .from("channel_events")
        .delete()
        .eq("org_id", orgId)
        .eq("external_contact", seedContact)
        .in("event_type", ["message", "status"]);

      if (merchantIds.length > 0) {
        await service.from("merchant_settings").delete().in("merchant_id", merchantIds);
        await service.from("merchants").delete().in("id", merchantIds);
      }

      return json({ ok: true, action: "cleanup" });
    }

    // seed
    let merchantId: string;
    const { data: existingMerchant } = await service
      .from("merchants")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", seedMerchantName)
      .maybeSingle();
    if (existingMerchant?.id) {
      merchantId = existingMerchant.id;
      await service
        .from("merchants")
        .update({
          status: "active",
          whatsapp_phone_number_id: "1015595591633834",
          whatsapp_verify_token: "embudex_meta_verify",
        })
        .eq("id", merchantId);
    } else {
      const { data: createdMerchant, error: merchantErr } = await service
        .from("merchants")
        .insert({
          org_id: orgId,
          name: seedMerchantName,
          status: "active",
          whatsapp_phone_number_id: "1015595591633834",
          whatsapp_verify_token: "embudex_meta_verify",
          whatsapp_access_token: "dev_mock_token_replace_via_embedded_signup",
        })
        .select("id")
        .single();
      if (merchantErr || !createdMerchant) return json({ error: "Failed to create seed merchant" }, 500);
      merchantId = createdMerchant.id;
    }

    // subscription
    let planId: string | null = null;
    const { data: plan } = await service
      .from("subscription_plans")
      .select("id")
      .ilike("name", "Pro")
      .maybeSingle();
    if (plan?.id) planId = plan.id;
    if (!planId) {
      const { data: createdPlan, error: planErr } = await service
        .from("subscription_plans")
        .insert({
          name: `Pro-Seed-${Date.now()}`,
          monthly_price: 100,
          message_limit: 10000,
          ai_enabled: true,
          automation_enabled: true,
          sla_monitoring_enabled: true,
          catalog_enabled: true,
          multi_user_enabled: true,
          support_level: "premium",
        })
        .select("id")
        .single();
      if (planErr || !createdPlan) return json({ error: "Failed to ensure seed plan" }, 500);
      planId = createdPlan.id;
    }
    await service
      .from("org_subscriptions")
      .upsert({
        org_id: orgId,
        plan_id: planId,
        status: "active",
        billing_cycle_start: new Date(Date.now() - 86_400_000).toISOString(),
        billing_cycle_end: new Date(Date.now() + 29 * 86_400_000).toISOString(),
        trial_ends_at: null,
      }, { onConflict: "org_id" });

    await service
      .from("org_settings")
      .upsert({
        org_id: orgId,
        timezone: "America/Santo_Domingo",
        sla_first_response_minutes: 15,
        sla_next_response_minutes: 60,
      }, { onConflict: "org_id" });

    await service
      .from("merchant_settings")
      .upsert({
        org_id: orgId,
        merchant_id: merchantId,
        onboarding_step: 3,
        credentials_valid: true,
        webhook_challenge_valid: true,
        connectivity_outbound_ok: true,
        connectivity_inbound_ok: true,
        token_valid: true,
        embedded_signup_status: "connected",
        meta_waba_id: "804704402661273",
        meta_phone_number_id: "1015595591633834",
        meta_access_token_last4: "MOCK",
        meta_token_updated_at: new Date().toISOString(),
        credentials_last_checked_at: new Date().toISOString(),
        webhook_challenge_last_checked_at: new Date().toISOString(),
        connectivity_outbound_last_checked_at: new Date().toISOString(),
        connectivity_inbound_last_checked_at: new Date().toISOString(),
        last_webhook_received_at: new Date().toISOString(),
        last_outbound_success_at: new Date().toISOString(),
        validation_results: {
          validate_credentials: { ok: true, seeded: true, checked_at: new Date().toISOString() },
          connectivity_test_outbound: { ok: true, seeded: true, checked_at: new Date().toISOString() },
          check_inbound_marker: { ok: true, seeded: true, checked_at: new Date().toISOString() },
        },
      }, { onConflict: "merchant_id" });

    // pipeline/stages
    let pipelineId: string;
    const { data: existingPipeline } = await service
      .from("pipelines")
      .select("id")
      .eq("org_id", orgId)
      .eq("is_default", true)
      .maybeSingle();
    if (existingPipeline?.id) {
      pipelineId = existingPipeline.id;
    } else {
      const { data: createdPipeline, error: pipelineErr } = await service
        .from("pipelines")
        .insert({ org_id: orgId, name: "DEV Sales Pipeline", is_default: true })
        .select("id")
        .single();
      if (pipelineErr || !createdPipeline) return json({ error: "Failed to ensure default pipeline" }, 500);
      pipelineId = createdPipeline.id;
    }

    const ensureStage = async (name: string, position: number) => {
      const { data: found } = await service
        .from("stages")
        .select("id")
        .eq("org_id", orgId)
        .eq("pipeline_id", pipelineId)
        .ilike("name", name)
        .maybeSingle();
      if (found?.id) return found.id;
      const { data: created, error } = await service
        .from("stages")
        .insert({ org_id: orgId, pipeline_id: pipelineId, name, position })
        .select("id")
        .single();
      if (error || !created) throw new Error(`Failed to ensure stage ${name}`);
      return created.id;
    };

    const stageLeadId = await ensureStage("Lead", 0);
    const stageQualifiedId = await ensureStage("Qualified", 1);
    await ensureStage("Proposal", 2);
    await ensureStage("Won", 3);
    await ensureStage("Lost", 4);

    // lead/contact/channels
    let leadId: string;
    const { data: existingLead } = await service
      .from("leads")
      .select("id")
      .eq("org_id", orgId)
      .eq("full_name", seedLeadName)
      .maybeSingle();
    if (existingLead?.id) {
      leadId = existingLead.id;
    } else {
      const { data: createdLead, error: leadErr } = await service
        .from("leads")
        .insert({
          org_id: orgId,
          full_name: seedLeadName,
          phones: [seedContact],
          source: "whatsapp",
          status: "open",
          stage_id: stageLeadId,
          owner_user_id: user.id,
        })
        .select("id")
        .single();
      if (leadErr || !createdLead) return json({ error: "Failed to create seed lead" }, 500);
      leadId = createdLead.id;
    }

    let contactId: string;
    const { data: existingContact } = await service
      .from("contacts")
      .select("id")
      .eq("org_id", orgId)
      .eq("full_name", seedContactName)
      .maybeSingle();
    if (existingContact?.id) {
      contactId = existingContact.id;
    } else {
      const { data: createdContact, error: contactErr } = await service
        .from("contacts")
        .insert({
          org_id: orgId,
          full_name: seedContactName,
          phones: [seedContact],
          emails: ["dev-contact@example.com"],
          tags: ["seeded", "validation"],
          owner_user_id: user.id,
        })
        .select("id")
        .single();
      if (contactErr || !createdContact) return json({ error: "Failed to create seed contact" }, 500);
      contactId = createdContact.id;
    }

    const { data: existingChannel } = await service
      .from("contact_channels")
      .select("id")
      .eq("org_id", orgId)
      .eq("channel", "whatsapp")
      .eq("external_contact", seedContact)
      .maybeSingle();
    if (!existingChannel) {
      await service.from("contact_channels").insert({
        org_id: orgId,
        channel: "whatsapp",
        external_contact: seedContact,
        contact_id: contactId,
        lead_id: leadId,
      });
    }

    // opportunity
    let opportunityId: string;
    const { data: existingOpp } = await service
      .from("opportunities")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", seedOppName)
      .maybeSingle();
    if (existingOpp?.id) {
      opportunityId = existingOpp.id;
    } else {
      const { data: createdOpp, error: oppErr } = await service
        .from("opportunities")
        .insert({
          org_id: orgId,
          pipeline_id: pipelineId,
          stage_id: stageQualifiedId,
          name: seedOppName,
          amount: 1200,
          expected_close_date: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
          status: "open",
          owner_user_id: user.id,
        })
        .select("id")
        .single();
      if (oppErr || !createdOpp) return json({ error: "Failed to create seed opportunity" }, 500);
      opportunityId = createdOpp.id;
    }

    // conversation
    let conversationId: string;
    const { data: existingConv } = await service
      .from("conversations")
      .select("id")
      .eq("org_id", orgId)
      .eq("merchant_id", merchantId)
      .eq("external_contact", seedContact)
      .maybeSingle();
    if (existingConv?.id) {
      conversationId = existingConv.id;
      await service.from("outbound_jobs").delete().eq("conversation_id", conversationId);
      const { data: runs } = await service.from("ai_agent_runs").select("id").eq("conversation_id", conversationId);
      const runIds = (runs ?? []).map((r) => r.id);
      if (runIds.length > 0) {
        await service.from("ai_agent_actions").delete().in("run_id", runIds);
        await service.from("ai_agent_runs").delete().in("id", runIds);
      }
      await service.from("conversation_events").delete().eq("conversation_id", conversationId);
      await service.from("messages").delete().eq("conversation_id", conversationId);
    } else {
      const { data: createdConv, error: convErr } = await service
        .from("conversations")
        .insert({
          org_id: orgId,
          merchant_id: merchantId,
          external_contact: seedContact,
          language: "es",
          intent: "pricing",
          last_intent: "pricing",
          last_entities: { product: "constitucion-empresa", quantity: "1" },
          lead_score: 78,
          lead_score_reason: { signals: ["asks_price", "high_intent"], notes: "seeded validation conversation" },
          status: "open",
          ai_enabled: true,
          ai_paused: false,
          ai_status: "ready",
          lead_id: leadId,
          contact_id: contactId,
          opportunity_id: opportunityId,
          owner_user_id: user.id,
        })
        .select("id")
        .single();
      if (convErr || !createdConv) return json({ error: "Failed to create seed conversation" }, 500);
      conversationId = createdConv.id;
    }

    // messages + jobs + events + agent runs
    const { data: inboundMsg } = await service
      .from("messages")
      .insert({
        org_id: orgId,
        conversation_id: conversationId,
        sender: "user",
        direction: "inbound",
        channel: "whatsapp",
        provider: "meta",
        content: "Hola, quiero constituir una empresa. Cuanto cuesta?",
        send_status: "sent",
        delivery_status: "delivered",
      })
      .select("id")
      .single();

    await service
      .from("messages")
      .insert({
        org_id: orgId,
        conversation_id: conversationId,
        sender: "ai",
        direction: "outbound",
        channel: "whatsapp",
        provider: "meta",
        content: "Gracias por escribirnos. Para cotizar, me confirma el tipo de empresa y si requiere RNC?",
        send_status: "sent",
        delivery_status: "delivered",
        sent_at: new Date(Date.now() - 120_000).toISOString(),
      });

    const { data: queuedMsg } = await service
      .from("messages")
      .insert({
        org_id: orgId,
        conversation_id: conversationId,
        sender: "ai",
        direction: "outbound",
        channel: "whatsapp",
        provider: "meta",
        content: "Perfecto. Si desea, le comparto los requisitos y documentos ahora mismo.",
        send_status: "queued",
        delivery_status: "unknown",
        metadata: { agent_run_seeded: true },
      })
      .select("id")
      .single();

    if (queuedMsg?.id) {
      await service.from("outbound_jobs").insert({
        org_id: orgId,
        merchant_id: merchantId,
        conversation_id: conversationId,
        message_id: queuedMsg.id,
        channel: "whatsapp",
        provider: "meta",
        status: "queued",
        retry_count: 0,
        max_retries: 5,
        next_retry_at: new Date().toISOString(),
        attempts: 0,
        idempotency_key: `seeded:${queuedMsg.id}`,
      });
    }

    await service
      .from("conversations")
      .update({
        ai_status: "ready",
        ai_last_generated_at: new Date(Date.now() - 60_000).toISOString(),
        ai_last_error: null,
        last_inbound_at: new Date(Date.now() - 180_000).toISOString(),
        last_outbound_at: new Date(Date.now() - 60_000).toISOString(),
        last_human_outbound_at: new Date(Date.now() - 240_000).toISOString(),
        last_ai_outbound_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    await service.from("conversation_events").insert([
      { org_id: orgId, conversation_id: conversationId, event_type: "message_received", details: { seeded: true, message_id: inboundMsg?.id ?? null } },
      { org_id: orgId, conversation_id: conversationId, event_type: "draft_generated", details: { seeded: true, message_id: queuedMsg?.id ?? null } },
    ]);

    await service.from("channel_events").insert([
      {
        org_id: orgId,
        merchant_id: merchantId,
        channel: "whatsapp",
        provider: "meta",
        event_type: "message",
        provider_event_id: `seeded_inbound_${Date.now()}`,
        external_contact: seedContact,
        severity: "info",
        payload: { seeded: true, type: "inbound" },
      },
      {
        org_id: orgId,
        merchant_id: merchantId,
        channel: "whatsapp",
        provider: "meta",
        event_type: "status",
        provider_event_id: `seeded_status_${Date.now()}`,
        external_contact: seedContact,
        severity: "info",
        payload: { seeded: true, status: "delivered" },
      },
    ]);

    await service.from("tasks").insert({
      org_id: orgId,
      opportunity_id: opportunityId,
      title: "Follow up seeded opportunity",
      due_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
      assigned_to: user.id,
      created_by: user.id,
      completed: false,
    });

    await service.from("activities").insert({
      org_id: orgId,
      entity_type: "opportunity",
      entity_id: opportunityId,
      activity_type: "note",
      description: "Seeded activity note for validation flow",
      created_by: user.id,
    });

    const { data: run } = await service
      .from("ai_agent_runs")
      .insert({
        org_id: orgId,
        merchant_id: merchantId,
        conversation_id: conversationId,
        trigger_message_id: inboundMsg?.id ?? null,
        model: "google/gemini-3-flash-preview",
        status: "completed",
        input_summary: { message_count: 3, language: "es", seeded: true },
        output: {
          reply: { text: "Le ayudo con eso.", should_send: true, handoff: false, set_status: "open" },
          extracted: {
            language: "es",
            intent: "pricing",
            entities: { product: "constitucion", quantity: "1", budget: null, location: null, timeframe: "esta semana" },
            lead_score: 78,
            lead_score_reason: { signals: ["asks_price", "ready_to_buy"], notes: "seeded" },
          },
          actions: [
            { type: "move_stage", stage_key: "qualified", reason: "High buying intent" },
            { type: "create_task", title: "Call lead", due_in_hours: 6, notes: "Seeded follow-up" },
            { type: "send_message", text: "Le comparto los detalles ahora mismo." },
          ],
        },
      })
      .select("id")
      .single();

    if (run?.id) {
      await service.from("ai_agent_actions").insert([
        { org_id: orgId, run_id: run.id, action_type: "move_stage", payload: { stage_key: "qualified" }, status: "executed", executed_at: new Date().toISOString() },
        { org_id: orgId, run_id: run.id, action_type: "create_task", payload: { title: "Call lead", due_in_hours: 6 }, status: "executed", executed_at: new Date().toISOString() },
        { org_id: orgId, run_id: run.id, action_type: "send_message", payload: { text: "Le comparto los detalles ahora mismo." }, status: "executed", executed_at: new Date().toISOString() },
      ]);
    }

    return json({
      ok: true,
      action: "seed",
      org_id: orgId,
      merchant_id: merchantId,
      conversation_id: conversationId,
      opportunity_id: opportunityId,
    });
  } catch (error) {
    console.error("dev-validation-seed error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
