-- Adicionar colunas de stage, first_name, last_name na tabela leads_externos
ALTER TABLE leads_externos 
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Criar índice para performance no stage
CREATE INDEX IF NOT EXISTS idx_leads_externos_stage ON leads_externos(stage);

-- Atualizar leads existentes para extrair first_name e last_name do full_name
UPDATE leads_externos 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE NULL
  END
WHERE full_name IS NOT NULL AND first_name IS NULL;