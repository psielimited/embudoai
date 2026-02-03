-- Add unique constraint on (merchant_id, external_contact) for upsert logic
ALTER TABLE public.conversations 
ADD CONSTRAINT conversations_merchant_external_unique 
UNIQUE (merchant_id, external_contact);