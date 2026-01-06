-- Adicionar campo para instância do Evolution API
ALTER TABLE businesses ADD COLUMN evolution_instance TEXT;

-- Criar tabela para mensagens agendadas
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT,
  recurrence_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view scheduled messages from their business"
ON scheduled_messages FOR SELECT
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert scheduled messages to their business"
ON scheduled_messages FOR INSERT
WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update scheduled messages from their business"
ON scheduled_messages FOR UPDATE
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete scheduled messages from their business"
ON scheduled_messages FOR DELETE
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_messages_updated_at
BEFORE UPDATE ON scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();