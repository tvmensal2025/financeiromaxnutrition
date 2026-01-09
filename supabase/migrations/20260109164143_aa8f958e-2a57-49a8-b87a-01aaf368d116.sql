-- Remover políticas baseadas em business_id para SELECT e UPDATE (duplicadas)
DROP POLICY IF EXISTS "Users can view whatsapp messages from their business" ON whatsapp_messages;
DROP POLICY IF EXISTS "Users can update whatsapp messages from their business" ON whatsapp_messages;
DROP POLICY IF EXISTS "Users can delete whatsapp messages from their business" ON whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert whatsapp messages to their business" ON whatsapp_messages;

-- Política de INSERT - webhook usa service role, então não precisa de política específica
-- Mas mantemos para caso de inserções do frontend
DROP POLICY IF EXISTS "Users can insert their own messages" ON whatsapp_messages;
CREATE POLICY "Users can insert their own messages" 
ON whatsapp_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Manter apenas políticas baseadas em user_id
-- A política "Users can view their own messages" já existe
-- A política "Users can update their own messages" já existe

-- Adicionar política de DELETE para user_id
DROP POLICY IF EXISTS "Users can delete their own messages" ON whatsapp_messages;
CREATE POLICY "Users can delete their own messages" 
ON whatsapp_messages 
FOR DELETE 
USING (auth.uid() = user_id);

-- Política para admins verem todas as mensagens do business (supervisão)
CREATE POLICY "Admins can view all business messages" 
ON whatsapp_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.business_id = whatsapp_messages.business_id
    AND profiles.role = 'admin'
  )
);