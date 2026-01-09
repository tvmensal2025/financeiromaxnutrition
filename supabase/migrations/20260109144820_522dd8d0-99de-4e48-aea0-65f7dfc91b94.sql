-- Add extra fields to customers table to preserve lead data when converted
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS height_cm numeric,
ADD COLUMN IF NOT EXISTS current_weight_kg numeric,
ADD COLUMN IF NOT EXISTS target_weight_kg numeric,
ADD COLUMN IF NOT EXISTS activity_level text,
ADD COLUMN IF NOT EXISTS fitness_level text,
ADD COLUMN IF NOT EXISTS points integer,
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS lead_data jsonb;