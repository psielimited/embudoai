-- Embudex dev validation seed
-- Purpose: bootstrap a complete org + merchant + conversation + AI timeline fixture
-- so you can validate UX/features without running onboarding each time.
--
-- Usage:
-- 1) Open Supabase SQL Editor
-- 2) Change target_email below
-- 3) Run script

DO $$
DECLARE
  target_email text := 'embudex04@yopmail.com';

  v_user_id uuid;
  v_org_id uuid;
  v_plan_id uuid;
  v_merchant_id uuid;
  v_pipeline_id uuid;
  v_stage_lead_id uuid;
  v_stage_qualified_id uuid;
  v_stage_proposal_id uuid;
  v_stage_won_id uuid;
  v_stage_lost_id uuid;
  v_lead_id uuid;
  v_contact_id uuid;
  v_opportunity_id uuid;
  v_conversation_id uuid;
  v_inbound_msg_id uuid;
  v_outbound_sent_msg_id uuid;
  v_outbound_queued_msg_id uuid;
  v_run_id uuid;
  v_existing_conv_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = target_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % was not found in auth.users', target_email;
  END IF;

  SELECT id INTO v_org_id
  FROM public.orgs
  WHERE name = 'DEV Validation Org'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.orgs (name)
    VALUES ('DEV Validation Org')
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role)
  SELECT v_org_id, v_user_id, 'org_admin'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.org_members WHERE org_id = v_org_id AND user_id = v_user_id
  );

  INSERT INTO public.profiles (user_id, full_name, role, active_org_id)
  VALUES (v_user_id, target_email, 'admin', v_org_id)
  ON CONFLICT (user_id) DO UPDATE
  SET active_org_id = EXCLUDED.active_org_id,
      role = 'admin',
      updated_at = now();

  SELECT id INTO v_plan_id
  FROM public.subscription_plans
  WHERE lower(name) = 'pro'
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    INSERT INTO public.subscription_plans (
      name, monthly_price, message_limit, ai_enabled, automation_enabled,
      sla_monitoring_enabled, catalog_enabled, multi_user_enabled, support_level
    )
    VALUES ('Pro', 100, 10000, true, true, true, true, true, 'premium')
    RETURNING id INTO v_plan_id;
  END IF;

  INSERT INTO public.org_subscriptions (
    org_id, plan_id, status, billing_cycle_start, billing_cycle_end, messages_used, trial_ends_at
  )
  VALUES (
    v_org_id, v_plan_id, 'active', now() - interval '1 day', now() + interval '29 days', 0, null
  )
  ON CONFLICT (org_id) DO UPDATE
  SET plan_id = EXCLUDED.plan_id,
      status = 'active',
      billing_cycle_start = EXCLUDED.billing_cycle_start,
      billing_cycle_end = EXCLUDED.billing_cycle_end,
      messages_used = LEAST(public.org_subscriptions.messages_used, 50),
      trial_ends_at = null,
      updated_at = now();

  INSERT INTO public.org_settings (org_id, timezone, sla_first_response_minutes, sla_next_response_minutes)
  VALUES (v_org_id, 'America/Santo_Domingo', 15, 60)
  ON CONFLICT (org_id) DO UPDATE
  SET timezone = EXCLUDED.timezone,
      sla_first_response_minutes = EXCLUDED.sla_first_response_minutes,
      sla_next_response_minutes = EXCLUDED.sla_next_response_minutes,
      updated_at = now();

  SELECT id INTO v_merchant_id
  FROM public.merchants
  WHERE org_id = v_org_id AND name = 'DEV Merchant'
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    INSERT INTO public.merchants (
      org_id, name, status, whatsapp_phone_number_id, whatsapp_verify_token, whatsapp_access_token
    )
    VALUES (
      v_org_id,
      'DEV Merchant',
      'active',
      '1015595591633834',
      'embudex_meta_verify',
      'dev_mock_token_replace_via_embedded_signup'
    )
    RETURNING id INTO v_merchant_id;
  ELSE
    UPDATE public.merchants
    SET status = 'active',
        whatsapp_phone_number_id = '1015595591633834',
        whatsapp_verify_token = coalesce(whatsapp_verify_token, 'embudex_meta_verify')
    WHERE id = v_merchant_id;
  END IF;

  INSERT INTO public.merchant_settings (
    org_id, merchant_id, onboarding_step,
    credentials_valid, webhook_challenge_valid,
    connectivity_outbound_ok, connectivity_inbound_ok,
    token_valid, embedded_signup_status,
    meta_waba_id, meta_phone_number_id, meta_access_token_last4, meta_token_updated_at,
    credentials_last_checked_at, webhook_challenge_last_checked_at,
    connectivity_outbound_last_checked_at, connectivity_inbound_last_checked_at,
    last_webhook_received_at, last_outbound_success_at,
    validation_results
  )
  VALUES (
    v_org_id, v_merchant_id, 3,
    true, true,
    true, true,
    true, 'connected',
    '804704402661273', '1015595591633834', 'MOCK', now(),
    now(), now(),
    now(), now(),
    now(), now(),
    jsonb_build_object(
      'validate_credentials', jsonb_build_object('ok', true, 'seeded', true, 'checked_at', now()),
      'connectivity_test_outbound', jsonb_build_object('ok', true, 'seeded', true, 'checked_at', now()),
      'check_inbound_marker', jsonb_build_object('ok', true, 'seeded', true, 'checked_at', now())
    )
  )
  ON CONFLICT (merchant_id) DO UPDATE
  SET onboarding_step = 3,
      credentials_valid = true,
      webhook_challenge_valid = true,
      connectivity_outbound_ok = true,
      connectivity_inbound_ok = true,
      token_valid = true,
      embedded_signup_status = 'connected',
      meta_waba_id = EXCLUDED.meta_waba_id,
      meta_phone_number_id = EXCLUDED.meta_phone_number_id,
      meta_access_token_last4 = EXCLUDED.meta_access_token_last4,
      meta_token_updated_at = now(),
      credentials_last_checked_at = now(),
      webhook_challenge_last_checked_at = now(),
      connectivity_outbound_last_checked_at = now(),
      connectivity_inbound_last_checked_at = now(),
      last_webhook_received_at = now(),
      last_outbound_success_at = now(),
      embedded_signup_error = null,
      validation_results = EXCLUDED.validation_results,
      updated_at = now();

  SELECT id INTO v_pipeline_id
  FROM public.pipelines
  WHERE org_id = v_org_id AND is_default = true
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    INSERT INTO public.pipelines (org_id, name, is_default)
    VALUES (v_org_id, 'DEV Sales Pipeline', true)
    RETURNING id INTO v_pipeline_id;
  END IF;

  INSERT INTO public.stages (org_id, pipeline_id, name, position)
  SELECT v_org_id, v_pipeline_id, 'Lead', 0
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.stages
    WHERE org_id = v_org_id
      AND pipeline_id = v_pipeline_id
      AND lower(name) = 'lead'
  );

  INSERT INTO public.stages (org_id, pipeline_id, name, position)
  SELECT v_org_id, v_pipeline_id, 'Qualified', 1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.stages
    WHERE org_id = v_org_id
      AND pipeline_id = v_pipeline_id
      AND lower(name) = 'qualified'
  );

  INSERT INTO public.stages (org_id, pipeline_id, name, position)
  SELECT v_org_id, v_pipeline_id, 'Proposal', 2
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.stages
    WHERE org_id = v_org_id
      AND pipeline_id = v_pipeline_id
      AND lower(name) = 'proposal'
  );

  INSERT INTO public.stages (org_id, pipeline_id, name, position)
  SELECT v_org_id, v_pipeline_id, 'Won', 3
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.stages
    WHERE org_id = v_org_id
      AND pipeline_id = v_pipeline_id
      AND lower(name) = 'won'
  );

  INSERT INTO public.stages (org_id, pipeline_id, name, position)
  SELECT v_org_id, v_pipeline_id, 'Lost', 4
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.stages
    WHERE org_id = v_org_id
      AND pipeline_id = v_pipeline_id
      AND lower(name) = 'lost'
  );

  SELECT id INTO v_stage_lead_id FROM public.stages WHERE pipeline_id = v_pipeline_id AND lower(name) = 'lead' LIMIT 1;
  SELECT id INTO v_stage_qualified_id FROM public.stages WHERE pipeline_id = v_pipeline_id AND lower(name) = 'qualified' LIMIT 1;
  SELECT id INTO v_stage_proposal_id FROM public.stages WHERE pipeline_id = v_pipeline_id AND lower(name) = 'proposal' LIMIT 1;
  SELECT id INTO v_stage_won_id FROM public.stages WHERE pipeline_id = v_pipeline_id AND lower(name) = 'won' LIMIT 1;
  SELECT id INTO v_stage_lost_id FROM public.stages WHERE pipeline_id = v_pipeline_id AND lower(name) = 'lost' LIMIT 1;

  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE org_id = v_org_id AND full_name = 'DEV Lead'
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.leads (org_id, full_name, phones, source, status, stage_id, owner_user_id)
    VALUES (v_org_id, 'DEV Lead', jsonb_build_array('18095550001'), 'whatsapp', 'open', v_stage_lead_id, v_user_id)
    RETURNING id INTO v_lead_id;
  END IF;

  SELECT id INTO v_contact_id
  FROM public.contacts
  WHERE org_id = v_org_id AND full_name = 'DEV Contact'
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts (org_id, full_name, phones, emails, tags, owner_user_id)
    VALUES (
      v_org_id,
      'DEV Contact',
      jsonb_build_array('18095550001'),
      jsonb_build_array('dev-contact@example.com'),
      jsonb_build_array('seeded', 'validation'),
      v_user_id
    )
    RETURNING id INTO v_contact_id;
  END IF;

  INSERT INTO public.contact_channels (org_id, channel, external_contact, contact_id)
  SELECT v_org_id, 'whatsapp', '18095550001', v_contact_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.contact_channels
    WHERE org_id = v_org_id
      AND channel = 'whatsapp'
      AND external_contact = '18095550001'
  );

  SELECT id INTO v_opportunity_id
  FROM public.opportunities
  WHERE org_id = v_org_id AND name = 'DEV Opportunity - WhatsApp Demo'
  LIMIT 1;

  IF v_opportunity_id IS NULL THEN
    INSERT INTO public.opportunities (
      org_id, pipeline_id, stage_id, name, amount, expected_close_date, status, owner_user_id
    )
    VALUES (
      v_org_id,
      v_pipeline_id,
      coalesce(v_stage_qualified_id, v_stage_lead_id),
      'DEV Opportunity - WhatsApp Demo',
      1200,
      current_date + interval '14 day',
      'open',
      v_user_id
    )
    RETURNING id INTO v_opportunity_id;
  END IF;

  SELECT id INTO v_existing_conv_id
  FROM public.conversations
  WHERE org_id = v_org_id
    AND merchant_id = v_merchant_id
    AND external_contact = '18095550001'
  LIMIT 1;

  IF v_existing_conv_id IS NULL THEN
    INSERT INTO public.conversations (
      org_id, merchant_id, external_contact, language, intent, last_intent,
      last_entities, lead_score, lead_score_reason,
      status, ai_enabled, ai_paused, ai_status,
      contact_id, opportunity_id, owner_user_id
    )
    VALUES (
      v_org_id,
      v_merchant_id,
      '18095550001',
      'es',
      'pricing',
      'pricing',
      jsonb_build_object('product', 'constitucion-empresa', 'quantity', '1'),
      78,
      jsonb_build_object('signals', jsonb_build_array('asks_price', 'high_intent'), 'notes', 'Seeded validation conversation'),
      'open',
      true,
      false,
      'ready',
      v_contact_id,
      v_opportunity_id,
      v_user_id
    )
    RETURNING id INTO v_conversation_id;
  ELSE
    v_conversation_id := v_existing_conv_id;
  END IF;

  -- Reset fixture timeline for this conversation
  DELETE FROM public.outbound_jobs WHERE conversation_id = v_conversation_id;
  DELETE FROM public.ai_agent_actions
  WHERE run_id IN (SELECT id FROM public.ai_agent_runs WHERE conversation_id = v_conversation_id);
  DELETE FROM public.ai_agent_runs WHERE conversation_id = v_conversation_id;
  DELETE FROM public.conversation_events WHERE conversation_id = v_conversation_id;
  DELETE FROM public.messages WHERE conversation_id = v_conversation_id;

  INSERT INTO public.messages (
    org_id, conversation_id, sender, direction, channel, provider,
    content, send_status, delivery_status
  )
  VALUES (
    v_org_id,
    v_conversation_id,
    'user',
    'inbound',
    'whatsapp',
    'meta',
    'Hola, quiero constituir una empresa. Cuanto cuesta?',
    'sent',
    'delivered'
  )
  RETURNING id INTO v_inbound_msg_id;

  INSERT INTO public.messages (
    org_id, conversation_id, sender, direction, channel, provider,
    content, send_status, delivery_status, sent_at
  )
  VALUES (
    v_org_id,
    v_conversation_id,
    'ai',
    'outbound',
    'whatsapp',
    'meta',
    'Gracias por escribirnos. Para cotizar, me confirma el tipo de empresa y si requiere RNC?',
    'sent',
    'delivered',
    now() - interval '2 minutes'
  )
  RETURNING id INTO v_outbound_sent_msg_id;

  INSERT INTO public.messages (
    org_id, conversation_id, sender, direction, channel, provider,
    content, send_status, delivery_status, metadata
  )
  VALUES (
    v_org_id,
    v_conversation_id,
    'ai',
    'outbound',
    'whatsapp',
    'meta',
    'Perfecto. Si desea, le comparto los requisitos y documentos ahora mismo.',
    'queued',
    'unknown',
    jsonb_build_object('agent_run_seeded', true)
  )
  RETURNING id INTO v_outbound_queued_msg_id;

  INSERT INTO public.outbound_jobs (
    org_id, merchant_id, conversation_id, message_id,
    channel, provider, status, retry_count, max_retries, next_retry_at, idempotency_key
  )
  VALUES (
    v_org_id, v_merchant_id, v_conversation_id, v_outbound_queued_msg_id,
    'whatsapp', 'meta', 'queued', 0, 5, now(), 'seeded:' || v_outbound_queued_msg_id::text
  );

  UPDATE public.conversations
  SET
    ai_status = 'ready',
    ai_last_generated_at = now() - interval '1 minute',
    ai_last_error = null,
    last_inbound_at = now() - interval '3 minutes',
    last_outbound_at = now() - interval '1 minute',
    last_human_outbound_at = now() - interval '4 minutes',
    last_ai_outbound_at = now() - interval '1 minute',
    updated_at = now()
  WHERE id = v_conversation_id;

  INSERT INTO public.conversation_events (org_id, conversation_id, event_type, details)
  VALUES
    (v_org_id, v_conversation_id, 'message_received', jsonb_build_object('message_id', v_inbound_msg_id)),
    (v_org_id, v_conversation_id, 'draft_generated', jsonb_build_object('message_id', v_outbound_queued_msg_id));

  INSERT INTO public.channel_events (
    org_id, merchant_id, channel, provider, event_type, provider_event_id, external_contact, severity, payload
  )
  VALUES
    (
      v_org_id,
      v_merchant_id,
      'whatsapp',
      'meta',
      'message',
      'seeded_inbound_' || extract(epoch from now())::bigint::text,
      '18095550001',
      'info',
      jsonb_build_object('seeded', true, 'type', 'inbound')
    ),
    (
      v_org_id,
      v_merchant_id,
      'whatsapp',
      'meta',
      'status',
      'seeded_status_' || extract(epoch from now())::bigint::text,
      '18095550001',
      'info',
      jsonb_build_object('seeded', true, 'status', 'delivered')
    );

  INSERT INTO public.tasks (org_id, opportunity_id, title, due_at, assigned_to, created_by, completed)
  VALUES (
    v_org_id,
    v_opportunity_id,
    'Follow up seeded opportunity',
    now() + interval '6 hours',
    v_user_id,
    v_user_id,
    false
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.activities (org_id, entity_type, entity_id, activity_type, description, created_by)
  VALUES (
    v_org_id,
    'opportunity',
    v_opportunity_id,
    'note',
    'Seeded activity note for validation flow',
    v_user_id
  );

  INSERT INTO public.ai_agent_runs (
    org_id, merchant_id, conversation_id, trigger_message_id, model, status, input_summary, output
  )
  VALUES (
    v_org_id,
    v_merchant_id,
    v_conversation_id,
    v_inbound_msg_id,
    'google/gemini-3-flash-preview',
    'completed',
    jsonb_build_object('message_count', 3, 'language', 'es'),
    jsonb_build_object(
      'reply', jsonb_build_object('text', 'Le ayudo con eso.', 'should_send', true, 'handoff', false, 'set_status', 'open'),
      'extracted', jsonb_build_object(
        'language', 'es',
        'intent', 'pricing',
        'entities', jsonb_build_object('product', 'constitucion', 'quantity', '1', 'budget', null, 'location', null, 'timeframe', 'esta semana'),
        'lead_score', 78,
        'lead_score_reason', jsonb_build_object('signals', jsonb_build_array('asks_price', 'ready_to_buy'), 'notes', 'seeded')
      ),
      'actions', jsonb_build_array(
        jsonb_build_object('type', 'move_stage', 'stage_key', 'qualified', 'reason', 'High buying intent'),
        jsonb_build_object('type', 'create_task', 'title', 'Call lead', 'due_in_hours', 6, 'notes', 'Seeded follow-up'),
        jsonb_build_object('type', 'send_message', 'text', 'Le comparto los detalles ahora mismo.')
      )
    )
  )
  RETURNING id INTO v_run_id;

  INSERT INTO public.ai_agent_actions (org_id, run_id, action_type, payload, status, executed_at)
  VALUES
    (v_org_id, v_run_id, 'move_stage', jsonb_build_object('stage_key', 'qualified'), 'executed', now()),
    (v_org_id, v_run_id, 'create_task', jsonb_build_object('title', 'Call lead', 'due_in_hours', 6), 'executed', now()),
    (v_org_id, v_run_id, 'send_message', jsonb_build_object('text', 'Le comparto los detalles ahora mismo.'), 'executed', now());

  RAISE NOTICE 'DEV validation seed complete: user_id=% org_id=% merchant_id=% conversation_id=% opportunity_id=%',
    v_user_id, v_org_id, v_merchant_id, v_conversation_id, v_opportunity_id;
END $$;
