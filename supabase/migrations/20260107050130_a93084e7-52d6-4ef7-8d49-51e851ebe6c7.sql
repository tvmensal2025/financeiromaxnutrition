-- Create enum for conversation status
CREATE TYPE public.conversation_status AS ENUM ('pending', 'inbox', 'waiting', 'finished');

-- Add conversation_status column to whatsapp_messages table
ALTER TABLE public.whatsapp_messages 
ADD COLUMN conversation_status public.conversation_status DEFAULT 'pending';

-- Update existing messages: inbound = pending (need approval), outbound = inbox
UPDATE public.whatsapp_messages 
SET conversation_status = CASE 
  WHEN direction = 'inbound' THEN 'pending'::public.conversation_status
  ELSE 'inbox'::public.conversation_status
END;