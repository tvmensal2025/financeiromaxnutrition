-- Tabela para leads recebidos de outros sistemas
CREATE TABLE leads_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'mission-health-nexus',
  external_user_id uuid,
  event_type text,
  full_name text,
  email text,
  phone text,
  city text,
  state text,
  birth_date date,
  gender text,
  height_cm numeric,
  current_weight_kg numeric,
  target_weight_kg numeric,
  activity_level text,
  fitness_level text,
  points int DEFAULT 0,
  signup_date timestamptz,
  raw_payload jsonb,
  received_at timestamptz DEFAULT now(),
  converted boolean DEFAULT false,
  conversion_date timestamptz,
  notes text
);

-- Habilitar RLS
ALTER TABLE leads_externos ENABLE ROW LEVEL SECURITY;

-- Política para admins verem tudo
CREATE POLICY "Admins podem ver leads" ON leads_externos
  FOR ALL USING (true);

-- Índices para busca rápida
CREATE INDEX idx_leads_email ON leads_externos(email);
CREATE INDEX idx_leads_phone ON leads_externos(phone);
CREATE INDEX idx_leads_received ON leads_externos(received_at DESC);