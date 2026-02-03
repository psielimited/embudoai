-- Create merchants table
CREATE TABLE public.merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  external_contact TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  intent TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'needs_handoff')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai', 'human')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (public read for admin dashboard)
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create public read policies (admin dashboard - no auth required for this phase)
CREATE POLICY "Allow public read access to merchants" 
  ON public.merchants FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to conversations" 
  ON public.conversations FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to messages" 
  ON public.messages FOR SELECT 
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_conversations_merchant_id ON public.conversations(merchant_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for conversations updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data for testing
INSERT INTO public.merchants (id, name, status) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Café Aromático', 'active'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'TechStore MX', 'active'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Farmacia Salud', 'inactive');

INSERT INTO public.conversations (id, merchant_id, external_contact, language, intent, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '+52 55 1234 5678', 'es', 'order_inquiry', 'open'),
  ('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '+52 55 8765 4321', 'es', 'support', 'needs_handoff'),
  ('33333333-3333-3333-3333-333333333333', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '+1 415 555 0123', 'en', 'product_question', 'closed'),
  ('44444444-4444-4444-4444-444444444444', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '+52 33 9876 5432', 'es', 'returns', 'open');

INSERT INTO public.messages (conversation_id, sender, content, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user', 'Hola, quisiera saber el estado de mi pedido', now() - interval '2 hours'),
  ('11111111-1111-1111-1111-111111111111', 'ai', '¡Hola! Con gusto te ayudo. ¿Podrías proporcionarme tu número de pedido?', now() - interval '1 hour 55 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'user', 'Es el pedido #12345', now() - interval '1 hour 50 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'ai', 'Tu pedido #12345 está en camino y llegará mañana entre 9am y 12pm.', now() - interval '1 hour 45 minutes'),
  ('22222222-2222-2222-2222-222222222222', 'user', 'Necesito hablar con alguien sobre un problema con mi cuenta', now() - interval '30 minutes'),
  ('22222222-2222-2222-2222-222222222222', 'ai', 'Entiendo que tienes un problema con tu cuenta. ¿Podrías describir el problema?', now() - interval '28 minutes'),
  ('22222222-2222-2222-2222-222222222222', 'user', 'No puedo acceder, me dice que mi contraseña es incorrecta', now() - interval '25 minutes'),
  ('22222222-2222-2222-2222-222222222222', 'human', 'Hola, soy Carlos del equipo de soporte. Voy a ayudarte a restablecer tu contraseña.', now() - interval '20 minutes'),
  ('33333333-3333-3333-3333-333333333333', 'user', 'Do you have the iPhone 15 Pro in stock?', now() - interval '1 day'),
  ('33333333-3333-3333-3333-333333333333', 'ai', 'Yes! We have the iPhone 15 Pro available in all colors. Would you like me to check a specific configuration?', now() - interval '1 day' + interval '2 minutes'),
  ('33333333-3333-3333-3333-333333333333', 'user', 'Great, I will come by the store tomorrow', now() - interval '1 day' + interval '5 minutes'),
  ('33333333-3333-3333-3333-333333333333', 'ai', 'Perfect! We are open from 10am to 8pm. See you tomorrow!', now() - interval '1 day' + interval '6 minutes');