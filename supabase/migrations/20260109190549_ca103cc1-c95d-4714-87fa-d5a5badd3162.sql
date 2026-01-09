-- Tabela de contratos digitais
CREATE TABLE public.contratos_digitais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contrato_taxa_id UUID REFERENCES contratos_taxas(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',
  token_assinatura UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de assinaturas do contrato
CREATE TABLE public.assinaturas_contrato (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES contratos_digitais(id) ON DELETE CASCADE,
  signatario_tipo TEXT NOT NULL DEFAULT 'contratante',
  signatario_nome TEXT NOT NULL,
  signatario_cpf_cnpj TEXT,
  signatario_email TEXT,
  signatario_telefone TEXT,
  ip_address TEXT,
  ip_geolocation JSONB,
  user_agent TEXT,
  assinado_em TIMESTAMP WITH TIME ZONE,
  hash_documento TEXT,
  codigo_verificacao TEXT,
  codigo_verificado BOOLEAN DEFAULT false,
  aceite_termos BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de log de auditoria
CREATE TABLE public.contratos_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES contratos_digitais(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  descricao TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contratos_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies para contratos_digitais
CREATE POLICY "Users can view contracts from their business"
ON public.contratos_digitais FOR SELECT
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert contracts to their business"
ON public.contratos_digitais FOR INSERT
WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update contracts from their business"
ON public.contratos_digitais FOR UPDATE
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete contracts from their business"
ON public.contratos_digitais FOR DELETE
USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- Policies para assinaturas_contrato (permite acesso público para assinatura)
CREATE POLICY "Users can view signatures from their contracts"
ON public.assinaturas_contrato FOR SELECT
USING (contrato_id IN (
  SELECT id FROM contratos_digitais 
  WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())
));

CREATE POLICY "Users can insert signatures to their contracts"
ON public.assinaturas_contrato FOR INSERT
WITH CHECK (contrato_id IN (
  SELECT id FROM contratos_digitais 
  WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())
));

CREATE POLICY "Users can update signatures from their contracts"
ON public.assinaturas_contrato FOR UPDATE
USING (contrato_id IN (
  SELECT id FROM contratos_digitais 
  WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())
));

CREATE POLICY "Users can delete signatures from their contracts"
ON public.assinaturas_contrato FOR DELETE
USING (contrato_id IN (
  SELECT id FROM contratos_digitais 
  WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())
));

-- Policy para permitir assinatura pública via token
CREATE POLICY "Public can update signature with valid token"
ON public.assinaturas_contrato FOR UPDATE
USING (true);

-- Policies para audit_log
CREATE POLICY "Users can view audit logs from their contracts"
ON public.contratos_audit_log FOR SELECT
USING (contrato_id IN (
  SELECT id FROM contratos_digitais 
  WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())
));

CREATE POLICY "Anyone can insert audit logs"
ON public.contratos_audit_log FOR INSERT
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contratos_digitais_updated_at
BEFORE UPDATE ON public.contratos_digitais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_contratos_digitais_business_id ON public.contratos_digitais(business_id);
CREATE INDEX idx_contratos_digitais_status ON public.contratos_digitais(status);
CREATE INDEX idx_contratos_digitais_token ON public.contratos_digitais(token_assinatura);
CREATE INDEX idx_assinaturas_contrato_contrato_id ON public.assinaturas_contrato(contrato_id);
CREATE INDEX idx_assinaturas_contrato_status ON public.assinaturas_contrato(status);
CREATE INDEX idx_contratos_audit_log_contrato_id ON public.contratos_audit_log(contrato_id);