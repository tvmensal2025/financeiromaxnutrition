-- Remove overly permissive policies
DROP POLICY IF EXISTS "Service role can insert whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Service role can update whatsapp messages" ON public.whatsapp_messages;