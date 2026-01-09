-- Create whatsapp_instances table for individual user instances
CREATE TABLE public.whatsapp_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    instance_name TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    phone TEXT,
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Add user_id to whatsapp_messages for individual message ownership
ALTER TABLE public.whatsapp_messages 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Enable RLS on whatsapp_instances
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Users can only see their own WhatsApp instance
CREATE POLICY "Users can view own whatsapp instance"
ON public.whatsapp_instances
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp instance"
ON public.whatsapp_instances
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp instance"
ON public.whatsapp_instances
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp instance"
ON public.whatsapp_instances
FOR DELETE
USING (auth.uid() = user_id);

-- Update whatsapp_messages RLS to be user-specific
DROP POLICY IF EXISTS "Users can view messages from their business" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert messages for their business" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can update messages from their business" ON public.whatsapp_messages;

CREATE POLICY "Users can view their own messages"
ON public.whatsapp_messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
ON public.whatsapp_messages
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();