-- Cleanup script for dev validation fixture created by dev_validation_seed.sql

DO $$
DECLARE
  target_email text := 'allen.rodriguez@gmail.com';
  v_user_id uuid;
  v_org_id uuid;
  v_conv_ids uuid[];
  v_opp_ids uuid[];
  v_lead_ids uuid[];
  v_contact_ids uuid[];
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = target_email
  LIMIT 1;

  SELECT id INTO v_org_id
  FROM public.orgs
  WHERE name = 'DEV Validation Org'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No DEV Validation Org found. Nothing to clean.';
    RETURN;
  END IF;

  SELECT array_agg(id) INTO v_conv_ids
  FROM public.conversations
  WHERE org_id = v_org_id
    AND external_contact = '18095550001';

  SELECT array_agg(id) INTO v_opp_ids
  FROM public.opportunities
  WHERE org_id = v_org_id
    AND name = 'DEV Opportunity - WhatsApp Demo';

  SELECT array_agg(id) INTO v_lead_ids
  FROM public.leads
  WHERE org_id = v_org_id
    AND full_name = 'DEV Lead';

  SELECT array_agg(id) INTO v_contact_ids
  FROM public.contacts
  WHERE org_id = v_org_id
    AND full_name = 'DEV Contact';

  IF v_conv_ids IS NOT NULL THEN
    DELETE FROM public.outbound_jobs WHERE conversation_id = ANY(v_conv_ids);
    DELETE FROM public.ai_agent_actions
    WHERE run_id IN (SELECT id FROM public.ai_agent_runs WHERE conversation_id = ANY(v_conv_ids));
    DELETE FROM public.ai_agent_runs WHERE conversation_id = ANY(v_conv_ids);
    DELETE FROM public.conversation_events WHERE conversation_id = ANY(v_conv_ids);
    DELETE FROM public.messages WHERE conversation_id = ANY(v_conv_ids);
    DELETE FROM public.conversations WHERE id = ANY(v_conv_ids);
  END IF;

  IF v_opp_ids IS NOT NULL THEN
    DELETE FROM public.tasks WHERE opportunity_id = ANY(v_opp_ids);
    DELETE FROM public.activities WHERE entity_type = 'opportunity' AND entity_id = ANY(v_opp_ids);
    DELETE FROM public.opportunities WHERE id = ANY(v_opp_ids);
  END IF;

  IF v_lead_ids IS NOT NULL THEN
    DELETE FROM public.contact_channels WHERE lead_id = ANY(v_lead_ids);
    DELETE FROM public.leads WHERE id = ANY(v_lead_ids);
  END IF;

  IF v_contact_ids IS NOT NULL THEN
    DELETE FROM public.contact_channels WHERE contact_id = ANY(v_contact_ids);
    DELETE FROM public.contacts WHERE id = ANY(v_contact_ids);
  END IF;

  DELETE FROM public.channel_events
  WHERE org_id = v_org_id
    AND payload->>'seeded' = 'true';

  DELETE FROM public.merchant_settings
  WHERE merchant_id IN (
    SELECT id FROM public.merchants WHERE org_id = v_org_id AND name = 'DEV Merchant'
  );

  DELETE FROM public.merchants
  WHERE org_id = v_org_id AND name = 'DEV Merchant';

  DELETE FROM public.org_subscriptions
  WHERE org_id = v_org_id;

  DELETE FROM public.org_settings
  WHERE org_id = v_org_id;

  DELETE FROM public.org_members
  WHERE org_id = v_org_id AND user_id = v_user_id;

  DELETE FROM public.orgs
  WHERE id = v_org_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET active_org_id = NULL,
        updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  RAISE NOTICE 'DEV validation fixture cleaned for %', target_email;
END $$;
