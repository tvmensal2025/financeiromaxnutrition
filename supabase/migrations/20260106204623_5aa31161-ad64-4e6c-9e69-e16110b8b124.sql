-- Enable realtime for whatsapp_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- Add index for better performance on phone lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);