-- Adicionar coluna participant_count na tabela whatsapp_messages
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS participant_count INTEGER DEFAULT 0;