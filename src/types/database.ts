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
  external_contact: string;
  language: string;
  intent: string | null;
  status: 'open' | 'waiting_on_customer' | 'needs_handoff' | 'resolved' | 'closed';
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
