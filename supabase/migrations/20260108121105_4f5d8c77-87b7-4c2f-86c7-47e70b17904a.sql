-- =====================================================
-- FASE 1: Sistema de Notas Internas por Contato
-- =====================================================
CREATE TABLE public.contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes from their business" ON public.contact_notes
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert notes to their business" ON public.contact_notes
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update notes from their business" ON public.contact_notes
  FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete notes from their business" ON public.contact_notes
  FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE INDEX idx_contact_notes_phone ON public.contact_notes(phone);
CREATE INDEX idx_contact_notes_business ON public.contact_notes(business_id);

-- =====================================================
-- FASE 2: Sistema de Lembretes
-- =====================================================
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reminders from their business" ON public.reminders
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert reminders to their business" ON public.reminders
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update reminders from their business" ON public.reminders
  FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete reminders from their business" ON public.reminders
  FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE INDEX idx_reminders_remind_at ON public.reminders(remind_at);
CREATE INDEX idx_reminders_business ON public.reminders(business_id);

-- =====================================================
-- FASE 7: Gerenciador de Webhooks
-- =====================================================
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('inbound', 'outbound')),
  events TEXT[] DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  secret_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view webhooks from their business" ON public.webhooks
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert webhooks to their business" ON public.webhooks
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update webhooks from their business" ON public.webhooks
  FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete webhooks from their business" ON public.webhooks
  FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view webhook logs from their business" ON public.webhook_logs
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert webhook logs to their business" ON public.webhook_logs
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE INDEX idx_webhook_logs_webhook ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_executed ON public.webhook_logs(executed_at DESC);

-- =====================================================
-- FASE 8: Transmissões Agendadas em Massa
-- =====================================================
CREATE TABLE public.broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaigns from their business" ON public.broadcast_campaigns
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert campaigns to their business" ON public.broadcast_campaigns
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update campaigns from their business" ON public.broadcast_campaigns
  FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete campaigns from their business" ON public.broadcast_campaigns
  FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE TABLE public.broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recipients from their business" ON public.broadcast_recipients
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert recipients to their business" ON public.broadcast_recipients
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update recipients from their business" ON public.broadcast_recipients
  FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete recipients from their business" ON public.broadcast_recipients
  FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE INDEX idx_broadcast_recipients_campaign ON public.broadcast_recipients(campaign_id);
CREATE INDEX idx_broadcast_recipients_status ON public.broadcast_recipients(status);

-- Triggers para updated_at
CREATE TRIGGER update_contact_notes_updated_at BEFORE UPDATE ON public.contact_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broadcast_campaigns_updated_at BEFORE UPDATE ON public.broadcast_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();