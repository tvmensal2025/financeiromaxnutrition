-- Add discount column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;