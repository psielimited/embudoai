-- Drop existing public read policies
DROP POLICY IF EXISTS "Allow public read access to merchants" ON public.merchants;
DROP POLICY IF EXISTS "Allow public read access to conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow public read access to messages" ON public.messages;

-- Create authenticated-only read policies
CREATE POLICY "Authenticated users can read merchants"
  ON public.merchants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (true);

-- Add service role write policies for backend operations (edge functions)
-- Merchants
CREATE POLICY "Service role can insert merchants"
  ON public.merchants FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update merchants"
  ON public.merchants FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete merchants"
  ON public.merchants FOR DELETE
  TO service_role
  USING (true);

-- Conversations
CREATE POLICY "Service role can insert conversations"
  ON public.conversations FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update conversations"
  ON public.conversations FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete conversations"
  ON public.conversations FOR DELETE
  TO service_role
  USING (true);

-- Messages
CREATE POLICY "Service role can insert messages"
  ON public.messages FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update messages"
  ON public.messages FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete messages"
  ON public.messages FOR DELETE
  TO service_role
  USING (true);