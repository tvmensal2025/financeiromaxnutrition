-- Create socios table
CREATE TABLE IF NOT EXISTS public.socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  telefone TEXT,
  percentual_participacao NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view socios from their business"
ON public.socios FOR SELECT
USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert socios to their business"
ON public.socios FOR INSERT
WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update socios from their business"
ON public.socios FOR UPDATE
USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete socios from their business"
ON public.socios FOR DELETE
USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

-- Add socio_id to pagamentos_fornecedor
ALTER TABLE public.pagamentos_fornecedor 
ADD COLUMN IF NOT EXISTS socio_id UUID REFERENCES public.socios(id);