/**
 * Hook for Messages page mutations
 * 
 * Feature: project-refactoring
 * Requirements: 6.7
 * 
 * Extracts mutation logic from Messages.tsx:
 * - sendMessage mutation
 * - updateStatus mutation
 * - rejectConversation mutation
 * - Uses useMutationWithToast for consistent toast handling
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ConversationStatus } from '@/components/chat/ConversationsList';

interface SendMessageParams {
  message: string;
  media?: { file: File; type: string };
  buttons?: Array<{ text: string; type: 'reply' | 'link'; url?: string }>;
}

interface SendMessageMutationParams extends SendMessageParams {
  selectedPhone: string;
  businessId: string;
  leadId?: string | null;
  customerId?: string | null;
}

interface UpdateStatusParams {
  phone: string;
  status: ConversationStatus;
}

/**
 * Hook for Messages page mutations
 * 
 * @param userId - Current user ID
 * @param businessId - Current business ID
 * @returns Object containing mutation functions
 */
export function useMessagesMutations(userId?: string, businessId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ 
      selectedPhone, 
      businessId, 
      leadId, 
      customerId, 
      message, 
      media, 
      buttons 
    }: SendMessageMutationParams) => {
      if (!selectedPhone || !businessId) throw new Error('Missing data');

      let mediaBase64: string | undefined;
      let mediaType: string | undefined;
      let mediaFilename: string | undefined;

      if (media) {
        // Convert file to base64
        const buffer = await media.file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        mediaBase64 = btoa(binary);
        mediaType = media.type;
        mediaFilename = media.file.name;
      }

      const { data, error } = await supabase.functions.invoke('send-evolution-message', {
        body: {
          phone: selectedPhone,
          message,
          business_id: businessId,
          lead_id: leadId,
          customer_id: customerId,
          media_base64: mediaBase64,
          media_type: mediaType,
          media_filename: mediaFilename,
          buttons: buttons,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', userId] });
        return;
      }

      toast({
        title: 'Erro ao enviar',
        description:
          data?.user_message || 'Não foi possível enviar a mensagem. Tente novamente.',
        variant: 'destructive',
      });
    },
    onError: (error) => {
      console.error('Send message error:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a mensagem. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Update conversation status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ phone, status }: UpdateStatusParams) => {
      if (!userId) throw new Error('User not found');

      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ conversation_status: status })
        .eq('phone', phone);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', userId] });
    },
    onError: (error) => {
      console.error('Update status error:', error);
      toast({
        title: 'Erro ao atualizar status',
        description: 'Não foi possível atualizar o status da conversa.',
        variant: 'destructive',
      });
    },
  });

  // Reject (delete) conversation mutation
  const rejectConversation = useMutation({
    mutationFn: async (phone: string) => {
      if (!userId) throw new Error('User not found');

      const { error } = await supabase
        .from('whatsapp_messages')
        .delete()
        .eq('phone', phone);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', userId] });
      toast({
        title: 'Conversa excluída',
        description: 'A conversa foi removida.',
      });
    },
    onError: (error) => {
      console.error('Reject conversation error:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a conversa.',
        variant: 'destructive',
      });
    },
  });

  // Test webhook mutation
  const testWebhook = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error('Business not found');

      const testPayload = {
        event: 'messages.upsert',
        instance: 'test',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
            id: `test-${Date.now()}`,
          },
          pushName: 'Teste Manual',
          message: {
            conversation: `Mensagem de teste - ${new Date().toLocaleTimeString('pt-BR')}`,
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      };

      const { data, error } = await supabase.functions.invoke('whatsapp-webhook', {
        body: testPayload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Webhook testado!',
        description: 'Mensagem de teste inserida com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', userId] });
    },
    onError: (error) => {
      console.error('Test webhook error:', error);
      toast({
        title: 'Erro no teste',
        description: error instanceof Error ? error.message : 'Falha ao testar webhook',
        variant: 'destructive',
      });
    },
  });

  // Process scheduled messages mutation
  const processScheduled = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-scheduled-messages');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Agendamentos processados!',
        description: `${data?.results?.length || 0} mensagem(ns) processada(s).`,
      });
    },
    onError: (error) => {
      console.error('Process scheduled error:', error);
      toast({
        title: 'Erro ao processar',
        description: 'Falha ao processar mensagens agendadas.',
        variant: 'destructive',
      });
    },
  });

  return {
    sendMessage,
    updateStatus,
    rejectConversation,
    testWebhook,
    processScheduled,
  };
}