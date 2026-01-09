-- Criar perfil para o usuário existente
INSERT INTO profiles (id, business_id, full_name, role)
VALUES (
  'cf12ea5e-480a-4cf6-9bcc-3075cbbd72db',
  '00000000-0000-0000-0000-000000000001',
  'Rafael',
  'admin'
)
ON CONFLICT (id) DO UPDATE SET
  business_id = '00000000-0000-0000-0000-000000000001';

-- Criar trigger no schema auth para novos usuários
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();