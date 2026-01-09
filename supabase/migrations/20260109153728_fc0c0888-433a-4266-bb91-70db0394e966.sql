-- Add WhatsApp connection status fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS whatsapp_status text DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS whatsapp_phone text,
ADD COLUMN IF NOT EXISTS whatsapp_connected_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.businesses.whatsapp_status IS 'Status da conexão WhatsApp: disconnected, waiting_qr, connected';
COMMENT ON COLUMN public.businesses.whatsapp_phone IS 'Número do WhatsApp conectado';
COMMENT ON COLUMN public.businesses.whatsapp_connected_at IS 'Data/hora da última conexão';