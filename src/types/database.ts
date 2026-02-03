export interface Merchant {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Conversation {
  id: string;
  merchant_id: string;
  external_contact: string;
  language: string;
  intent: string | null;
  status: 'open' | 'closed' | 'needs_handoff';
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai' | 'human';
  content: string;
  created_at: string;
}
