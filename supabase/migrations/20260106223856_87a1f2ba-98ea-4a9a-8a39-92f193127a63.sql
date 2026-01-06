-- Adicionar avatar_url na tabela customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Adicionar avatar_url na tabela leads  
ALTER TABLE leads ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Adicionar sender_avatar_url na tabela whatsapp_messages
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_avatar_url TEXT;