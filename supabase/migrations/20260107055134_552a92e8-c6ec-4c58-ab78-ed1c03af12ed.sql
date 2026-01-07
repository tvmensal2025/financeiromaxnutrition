-- Add interest columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS interest_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS interested_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS interested_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS interest_is_recurring BOOLEAN DEFAULT false;

-- Add interest columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS interest_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS interested_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS interested_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS interest_is_recurring BOOLEAN DEFAULT false;