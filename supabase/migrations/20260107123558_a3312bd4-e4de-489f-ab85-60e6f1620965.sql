-- Add column to store transcription errors for better debugging
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS transcription_error TEXT;