-- Adicionar campo para webhook do n8n na tabela businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;