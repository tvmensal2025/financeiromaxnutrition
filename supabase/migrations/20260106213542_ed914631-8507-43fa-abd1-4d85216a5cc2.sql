-- Add is_group column to whatsapp_messages
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;

-- Add group_name column to store group names
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Add participant_phone column to store who sent the message in a group
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS participant_phone TEXT;