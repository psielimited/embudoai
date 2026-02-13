export interface Merchant {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  org_id: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  merchant_id: string;
  org_id: string;
  external_contact: string;
  language: string;
  intent: string | null;
  status: 'open' | 'closed' | 'needs_handoff';
  contact_id: string | null;
  lead_id: string | null;
  opportunity_id: string | null;
  ai_enabled: boolean;
  ai_status: 'idle' | 'queued' | 'generating' | 'ready' | 'failed';
  ai_last_error: string | null;
  ai_last_generated_at: string | null;
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
