-- Adicionar campo para identificar quem pagou
ALTER TABLE pagamentos_fornecedor 
ADD COLUMN pago_por_user_id UUID REFERENCES profiles(id);

-- Adicionar campo para vincular ao fornecedor diretamente (para facilitar queries)
ALTER TABLE pagamentos_fornecedor
ADD COLUMN fornecedor_id UUID REFERENCES fornecedores(id);