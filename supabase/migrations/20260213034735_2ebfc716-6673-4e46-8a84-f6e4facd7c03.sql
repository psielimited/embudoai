
-- =====================================================
-- Phase: Org-scope messaging tables
-- =====================================================

-- 1. Add org_id columns (nullable first for backfill)
ALTER TABLE merchants ADD COLUMN org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;

-- 2. Backfill with single org
UPDATE merchants SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE conversations SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE messages SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- 3. Make NOT NULL
ALTER TABLE merchants ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN org_id SET NOT NULL;

-- 4. Indexes
CREATE INDEX idx_merchants_org ON merchants(org_id);
CREATE INDEX idx_conversations_org ON conversations(org_id);
CREATE INDEX idx_messages_org ON messages(org_id);

-- 5. Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can read merchants" ON merchants;
DROP POLICY IF EXISTS "Service role can delete merchants" ON merchants;
DROP POLICY IF EXISTS "Service role can insert merchants" ON merchants;
DROP POLICY IF EXISTS "Service role can update merchants" ON merchants;

DROP POLICY IF EXISTS "Authenticated users can read conversations" ON conversations;
DROP POLICY IF EXISTS "Service role can delete conversations" ON conversations;
DROP POLICY IF EXISTS "Service role can insert conversations" ON conversations;
DROP POLICY IF EXISTS "Service role can update conversations" ON conversations;

DROP POLICY IF EXISTS "Authenticated users can read messages" ON messages;
DROP POLICY IF EXISTS "Service role can delete messages" ON messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON messages;
DROP POLICY IF EXISTS "Service role can update messages" ON messages;

-- 6. New org-scoped RLS policies

-- MERCHANTS
CREATE POLICY "Org members read merchants"
  ON merchants FOR SELECT
  USING (org_id = get_active_org_id());

CREATE POLICY "Org members insert merchants"
  ON merchants FOR INSERT
  WITH CHECK (org_id = get_active_org_id());

CREATE POLICY "Org members update merchants"
  ON merchants FOR UPDATE
  USING (org_id = get_active_org_id());

CREATE POLICY "Org members delete merchants"
  ON merchants FOR DELETE
  USING (org_id = get_active_org_id());

-- Service role (unrestricted for edge functions)
CREATE POLICY "Service role full merchants"
  ON merchants FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- CONVERSATIONS
CREATE POLICY "Org members read conversations"
  ON conversations FOR SELECT
  USING (org_id = get_active_org_id());

CREATE POLICY "Org members insert conversations"
  ON conversations FOR INSERT
  WITH CHECK (org_id = get_active_org_id());

CREATE POLICY "Org members update conversations"
  ON conversations FOR UPDATE
  USING (org_id = get_active_org_id());

CREATE POLICY "Org members delete conversations"
  ON conversations FOR DELETE
  USING (org_id = get_active_org_id());

CREATE POLICY "Service role full conversations"
  ON conversations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- MESSAGES
CREATE POLICY "Org members read messages"
  ON messages FOR SELECT
  USING (org_id = get_active_org_id());

CREATE POLICY "Org members insert messages"
  ON messages FOR INSERT
  WITH CHECK (org_id = get_active_org_id());

CREATE POLICY "Org members update messages"
  ON messages FOR UPDATE
  USING (org_id = get_active_org_id());

CREATE POLICY "Org members delete messages"
  ON messages FOR DELETE
  USING (org_id = get_active_org_id());

CREATE POLICY "Service role full messages"
  ON messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 7. Cross-table org consistency triggers

-- Conversations must match merchant org_id
CREATE OR REPLACE FUNCTION public.enforce_conversation_org_match()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_merchant_org uuid;
BEGIN
  SELECT org_id INTO v_merchant_org FROM merchants WHERE id = NEW.merchant_id;
  IF v_merchant_org IS NULL THEN
    RAISE EXCEPTION 'Merchant % not found', NEW.merchant_id;
  END IF;
  IF NEW.org_id != v_merchant_org THEN
    RAISE EXCEPTION 'Conversation org_id (%) does not match merchant org_id (%)', NEW.org_id, v_merchant_org;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversation_org_match
  BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION enforce_conversation_org_match();

-- Messages must match conversation org_id
CREATE OR REPLACE FUNCTION public.enforce_message_org_match()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_conv_org uuid;
BEGIN
  SELECT org_id INTO v_conv_org FROM conversations WHERE id = NEW.conversation_id;
  IF v_conv_org IS NULL THEN
    RAISE EXCEPTION 'Conversation % not found', NEW.conversation_id;
  END IF;
  IF NEW.org_id != v_conv_org THEN
    RAISE EXCEPTION 'Message org_id (%) does not match conversation org_id (%)', NEW.org_id, v_conv_org;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_org_match
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION enforce_message_org_match();
