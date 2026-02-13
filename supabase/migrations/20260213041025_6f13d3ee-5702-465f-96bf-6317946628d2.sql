
-- A) Add AI columns to conversations
ALTER TABLE conversations
  ADD COLUMN ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN ai_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN ai_last_error text NULL,
  ADD COLUMN ai_last_generated_at timestamptz NULL;

CREATE INDEX idx_conversations_ai_status ON conversations(org_id, ai_status);

-- B) Add metadata columns to messages
ALTER TABLE messages
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN reply_to_message_id uuid NULL REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX idx_messages_reply_to ON messages(reply_to_message_id);
CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at);

-- Enable realtime for messages so drafts appear live
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
