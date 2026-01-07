-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to whatsapp-media bucket
CREATE POLICY "WhatsApp media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to upload media
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

-- Allow service role to upload media (for edge functions)
CREATE POLICY "Service role can manage whatsapp media"
ON storage.objects FOR ALL
USING (bucket_id = 'whatsapp-media')
WITH CHECK (bucket_id = 'whatsapp-media');

-- Add media_metadata column for storing duration, dimensions, filename, etc.
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS media_metadata JSONB DEFAULT NULL;