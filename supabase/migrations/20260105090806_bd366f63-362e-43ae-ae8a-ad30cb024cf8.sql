-- Adicionar campos de configuração de lembretes automáticos na tabela businesses
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS reminder_days_before integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS low_credits_threshold integer DEFAULT 20,
ADD COLUMN IF NOT EXISTS auto_reminders_enabled boolean DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.businesses.reminder_days_before IS 'Quantos dias antes do vencimento enviar lembrete';
COMMENT ON COLUMN public.businesses.low_credits_threshold IS 'Percentual de créditos restantes para enviar alerta';
COMMENT ON COLUMN public.businesses.auto_reminders_enabled IS 'Se lembretes automáticos estão habilitados';