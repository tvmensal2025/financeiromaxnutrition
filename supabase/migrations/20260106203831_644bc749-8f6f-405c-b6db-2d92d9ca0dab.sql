-- Enum para direção da mensagem
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');

-- Enum para status da mensagem WhatsApp
CREATE TYPE public.whatsapp_message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- Tabela para mensagens do WhatsApp
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  direction message_direction NOT NULL DEFAULT 'inbound',
  media_url TEXT,
  media_type TEXT,
  status whatsapp_message_status NOT NULL DEFAULT 'pending',
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view whatsapp messages from their business"
ON public.whatsapp_messages FOR SELECT
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert whatsapp messages to their business"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update whatsapp messages from their business"
ON public.whatsapp_messages FOR UPDATE
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete whatsapp messages from their business"
ON public.whatsapp_messages FOR DELETE
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- Policy for edge functions (service role can insert)
CREATE POLICY "Service role can insert whatsapp messages"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update whatsapp messages"
ON public.whatsapp_messages FOR UPDATE
USING (true);

-- Index for faster lookups
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX idx_whatsapp_messages_lead_id ON public.whatsapp_messages(lead_id);
CREATE INDEX idx_whatsapp_messages_business_id ON public.whatsapp_messages(business_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_messages_updated_at
BEFORE UPDATE ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();