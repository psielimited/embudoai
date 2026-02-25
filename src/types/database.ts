export interface Merchant {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  org_id: string;
  created_at: string;
  whatsapp_phone_number_id: string | null;
  whatsapp_verify_token: string | null;
  whatsapp_app_secret: string | null;
  whatsapp_access_token: string | null;
}

export interface Conversation {
  id: string;
  merchant_id: string;
  org_id: string;
  automation_mode: 'ai' | 'human' | 'hybrid';
  external_contact: string;
  language: string;
  intent: string | null;
  last_intent: string | null;
  last_entities: Record<string, unknown>;
  lead_score: number;
  lead_score_reason: Record<string, unknown>;
  status: 'open' | 'waiting_on_customer' | 'needs_handoff' | 'resolved' | 'closed';
  handoff_active: boolean;
  handoff_reason_code: string | null;
  handoff_reason_text: string | null;
  contact_id: string | null;
  lead_id: string | null;
  opportunity_id: string | null;
  ai_enabled: boolean;
  ai_status: 'idle' | 'queued' | 'generating' | 'ready' | 'failed';
  ai_last_error: string | null;
  ai_last_generated_at: string | null;
  ai_paused: boolean;
  owner_user_id: string | null;
  owner_team_id: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  outcome: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_human_outbound_at: string | null;
  last_ai_outbound_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  org_id: string;
  full_name: string;
  status: string;
  lead_stage: 'new' | 'contacted' | 'qualified' | 'negotiating' | 'won' | 'lost';
  source: string;
  emails: unknown;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  org_id: string;
  sender: 'user' | 'ai' | 'human';
  content: string;
  metadata: Record<string, unknown>;
  reply_to_message_id: string | null;
  channel: string;
  provider: string | null;
  provider_message_id: string | null;
  delivery_status: 'unknown' | 'sent' | 'delivered' | 'read' | 'failed';
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  direction: 'inbound' | 'outbound';
  send_status: 'unsent' | 'queued' | 'sending' | 'sent' | 'failed';
  send_error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface ContactChannel {
  id: string;
  org_id: string;
  channel: string;
  external_contact: string;
  contact_id: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelEvent {
  id: string;
  org_id: string;
  merchant_id: string;
  channel: string;
  provider: string;
  event_type: string;
  provider_event_id: string;
  external_contact: string | null;
  payload: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
}

export interface AiAgentRun {
  id: string;
  org_id: string;
  merchant_id: string;
  conversation_id: string;
  trigger_message_id: string | null;
  model: string;
  status: "started" | "completed" | "failed" | "skipped";
  input_summary: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  created_at: string;
}

export interface AiAgentAction {
  id: string;
  org_id: string;
  run_id: string;
  action_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "executed" | "failed" | "skipped";
  error: string | null;
  executed_at: string | null;
  created_at: string;
}

export interface ConversationHandoff {
  id: string;
  org_id: string;
  merchant_id: string;
  conversation_id: string;
  run_id: string | null;
  created_by_user_id: string | null;
  reason_code:
    | "abuse"
    | "legal_threat"
    | "billing_dispute"
    | "refund_dispute"
    | "low_confidence"
    | "policy_unknown"
    | "ai_error"
    | "merchant_pause"
    | "manual_request"
    | "other";
  reason_text: string | null;
  packet: Record<string, unknown>;
  status: "open" | "acknowledged" | "resolved";
  acknowledged_by_user_id: string | null;
  acknowledged_at: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ConversationSuggestion {
  id: string;
  org_id: string;
  merchant_id: string;
  conversation_id: string;
  handoff_id: string | null;
  source_run_id: string | null;
  status: "active" | "expired" | "used";
  language: string | null;
  suggestions: Record<string, unknown>;
  created_at: string;
}
