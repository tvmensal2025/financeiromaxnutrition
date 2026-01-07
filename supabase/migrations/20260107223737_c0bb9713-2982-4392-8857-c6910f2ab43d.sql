-- Add emoji and buttons columns to message_templates
ALTER TABLE public.message_templates 
ADD COLUMN emoji TEXT DEFAULT '📝',
ADD COLUMN buttons JSONB DEFAULT '[]'::jsonb;