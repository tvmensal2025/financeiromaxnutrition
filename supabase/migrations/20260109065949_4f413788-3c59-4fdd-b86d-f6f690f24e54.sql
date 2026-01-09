-- Tabela de fornecedores
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  nome_fornecedor TEXT NOT NULL,
  tipo_fornecedor TEXT NOT NULL DEFAULT 'industrial',
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de produtos e serviços dos fornecedores
CREATE TABLE public.produtos_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  nome_item TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'produto',
  descricao TEXT,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  quantidade INTEGER NOT NULL DEFAULT 0,
  quantidade_paga INTEGER NOT NULL DEFAULT 0,
  quantidade_estoque INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC GENERATED ALWAYS AS (valor_unitario * quantidade) STORED,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  condicao_pagamento TEXT,
  status_pagamento TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de contratos e taxas
CREATE TABLE public.contratos_taxas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  status_pagamento TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pagamentos (para rastrear pagamentos e liberar estoque)
CREATE TABLE public.pagamentos_fornecedor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  produto_servico_id UUID REFERENCES public.produtos_servicos(id) ON DELETE SET NULL,
  contrato_taxa_id UUID REFERENCES public.contratos_taxas(id) ON DELETE SET NULL,
  valor_pago NUMERIC NOT NULL,
  quantidade_liberada INTEGER DEFAULT 0,
  data_pagamento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metodo_pagamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_taxas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_fornecedor ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fornecedores
CREATE POLICY "Users can view fornecedores from their business" ON public.fornecedores
  FOR SELECT USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert fornecedores to their business" ON public.fornecedores
  FOR INSERT WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update fornecedores from their business" ON public.fornecedores
  FOR UPDATE USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete fornecedores from their business" ON public.fornecedores
  FOR DELETE USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for produtos_servicos
CREATE POLICY "Users can view produtos_servicos from their business" ON public.produtos_servicos
  FOR SELECT USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert produtos_servicos to their business" ON public.produtos_servicos
  FOR INSERT WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update produtos_servicos from their business" ON public.produtos_servicos
  FOR UPDATE USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete produtos_servicos from their business" ON public.produtos_servicos
  FOR DELETE USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for contratos_taxas
CREATE POLICY "Users can view contratos_taxas from their business" ON public.contratos_taxas
  FOR SELECT USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert contratos_taxas to their business" ON public.contratos_taxas
  FOR INSERT WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update contratos_taxas from their business" ON public.contratos_taxas
  FOR UPDATE USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete contratos_taxas from their business" ON public.contratos_taxas
  FOR DELETE USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for pagamentos_fornecedor
CREATE POLICY "Users can view pagamentos_fornecedor from their business" ON public.pagamentos_fornecedor
  FOR SELECT USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert pagamentos_fornecedor to their business" ON public.pagamentos_fornecedor
  FOR INSERT WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update pagamentos_fornecedor from their business" ON public.pagamentos_fornecedor
  FOR UPDATE USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete pagamentos_fornecedor from their business" ON public.pagamentos_fornecedor
  FOR DELETE USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_produtos_servicos_updated_at
  BEFORE UPDATE ON public.produtos_servicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();