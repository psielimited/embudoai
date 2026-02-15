
CREATE OR REPLACE FUNCTION public.rpc_move_opportunity_stage(p_opportunity_id uuid, p_to_stage_id uuid, p_expected_version integer, p_actor_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_opp RECORD;
  v_gate RECORD;
  v_missing_fields text[] := '{}';
  v_missing_activities text[] := '{}';
  v_field text;
  v_act_type text;
  v_has_activity boolean;
  v_from_snapshot jsonb;
  v_to_snapshot jsonb;
  v_new_version int;
BEGIN
  SELECT * INTO v_opp
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND', 'error', 'Opportunity not found');
  END IF;

  IF v_opp.version != p_expected_version THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'VERSION_CONFLICT',
      'error', 'Version mismatch', 'current_version', v_opp.version);
  END IF;

  SELECT * INTO v_gate
  FROM public.stage_gates
  WHERE stage_id = p_to_stage_id;

  IF FOUND THEN
    IF array_length(v_gate.required_fields, 1) IS NOT NULL THEN
      FOREACH v_field IN ARRAY v_gate.required_fields LOOP
        IF v_field = 'amount' AND v_opp.amount IS NULL THEN
          v_missing_fields := array_append(v_missing_fields, v_field);
        ELSIF v_field = 'expected_close_date' AND v_opp.expected_close_date IS NULL THEN
          v_missing_fields := array_append(v_missing_fields, v_field);
        END IF;
      END LOOP;
    END IF;

    IF array_length(v_gate.required_activity_types, 1) IS NOT NULL THEN
      FOREACH v_act_type IN ARRAY v_gate.required_activity_types LOOP
        SELECT EXISTS(
          SELECT 1 FROM public.activities
          WHERE entity_type = 'opportunity'
            AND entity_id = p_opportunity_id
            AND activity_type = v_act_type
        ) INTO v_has_activity;
        IF NOT v_has_activity THEN
          v_missing_activities := array_append(v_missing_activities, v_act_type);
        END IF;
      END LOOP;
    END IF;

    IF array_length(v_missing_fields, 1) IS NOT NULL OR array_length(v_missing_activities, 1) IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'STAGE_GATE_FAILED',
        'missing_fields', to_jsonb(v_missing_fields),
        'missing_activities', to_jsonb(v_missing_activities)
      );
    END IF;
  END IF;

  v_from_snapshot := jsonb_build_object(
    'stage_id', v_opp.stage_id,
    'name', v_opp.name,
    'amount', v_opp.amount,
    'status', v_opp.status,
    'version', v_opp.version
  );

  v_new_version := v_opp.version + 1;

  UPDATE public.opportunities
  SET stage_id = p_to_stage_id,
      version = v_new_version,
      updated_at = now()
  WHERE id = p_opportunity_id;

  v_to_snapshot := jsonb_build_object(
    'stage_id', p_to_stage_id,
    'name', v_opp.name,
    'amount', v_opp.amount,
    'status', v_opp.status,
    'version', v_new_version
  );

  -- Fixed: include org_id from the opportunity record
  INSERT INTO public.audit_events (opportunity_id, actor_user_id, event_type, diff, org_id)
  VALUES (
    p_opportunity_id,
    p_actor_user_id,
    'stage_changed',
    jsonb_build_object(
      'from_stage_id', v_opp.stage_id,
      'to_stage_id', p_to_stage_id,
      'from_snapshot', v_from_snapshot,
      'to_snapshot', v_to_snapshot
    ),
    v_opp.org_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'opportunity_id', p_opportunity_id,
    'from_stage_id', v_opp.stage_id,
    'to_stage_id', p_to_stage_id,
    'version', v_new_version,
    'name', v_opp.name,
    'amount', v_opp.amount
  );
END;
$function$;
