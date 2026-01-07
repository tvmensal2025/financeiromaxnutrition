-- Add quantity, pricing and discount columns to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN quantity integer NOT NULL DEFAULT 1,
ADD COLUMN unit_price numeric NOT NULL DEFAULT 0,
ADD COLUMN subtotal numeric NOT NULL DEFAULT 0,
ADD COLUMN discount numeric NOT NULL DEFAULT 0,
ADD COLUMN total numeric NOT NULL DEFAULT 0;