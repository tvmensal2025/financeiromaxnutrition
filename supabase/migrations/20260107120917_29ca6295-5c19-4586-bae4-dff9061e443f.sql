-- Tabela para configurações da IA por negócio
CREATE TABLE public.ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  admin_phone TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN DEFAULT false,
  auto_transcribe BOOLEAN DEFAULT true,
  auto_respond BOOLEAN DEFAULT true,
  greeting_style TEXT DEFAULT 'friendly',
  default_categories TEXT[] DEFAULT ARRAY['Recebimentos', 'Vendas', 'Serviços', 'Pagamentos', 'Outros'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para transações financeiras registradas pela IA
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category TEXT DEFAULT 'Outros',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'paid')),
  due_date DATE,
  transaction_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para controle de contexto das conversas com IA
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  stage TEXT DEFAULT 'idle' CHECK (stage IN ('idle', 'collecting_name', 'collecting_value', 'collecting_category', 'collecting_date', 'collecting_status', 'confirming')),
  pending_data JSONB DEFAULT '{}',
  last_intent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar coluna transcribed_text em whatsapp_messages
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS transcribed_text TEXT;

-- Enable RLS
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ai_settings
CREATE POLICY "Users can view ai_settings of their business" 
ON public.ai_settings 
FOR SELECT 
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert ai_settings for their business" 
ON public.ai_settings 
FOR INSERT 
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update ai_settings of their business" 
ON public.ai_settings 
FOR UPDATE 
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- RLS Policies para transactions
CREATE POLICY "Users can view transactions of their business" 
ON public.transactions 
FOR SELECT 
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert transactions for their business" 
ON public.transactions 
FOR INSERT 
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update transactions of their business" 
ON public.transactions 
FOR UPDATE 
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete transactions of their business" 
ON public.transactions 
FOR DELETE 
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- RLS Policies para ai_conversations (service role only - usado pelo webhook)
CREATE POLICY "Service role can manage ai_conversations" 
ON public.ai_conversations 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_ai_settings_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_transactions_business_id ON public.transactions(business_id);
CREATE INDEX idx_transactions_customer_id ON public.transactions(customer_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_transaction_date ON public.transactions(transaction_date);
CREATE INDEX idx_ai_conversations_phone ON public.ai_conversations(phone);
CREATE INDEX idx_ai_conversations_business_id ON public.ai_conversations(business_id);