-- Alterar admin_phone de TEXT para TEXT[] para suportar múltiplos números
ALTER TABLE public.ai_settings 
ADD COLUMN admin_phones TEXT[] DEFAULT '{}';

-- Migrar dados existentes se houver
UPDATE public.ai_settings 
SET admin_phones = ARRAY[admin_phone] 
WHERE admin_phone IS NOT NULL AND admin_phone != '';

-- Remover coluna antiga (opcional, mantemos por compatibilidade)
-- ALTER TABLE public.ai_settings DROP COLUMN admin_phone;