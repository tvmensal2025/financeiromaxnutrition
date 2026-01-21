import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Lead } from '../queries/useLeads';

/**
 * Hook for converting a lead to a customer.
 * Creates a customer record and updates the lead status to 'converted'.
 * 
 * @returns A React Query mutation object for converting leads
 */
export function useConvertLead() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Lead) => {
      if (!business?.id) throw new Error('Business not found');

      // Create customer from lead
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: business.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          notes: lead.notes,
        })
        .select()
        .single();
      
      if (customerError) throw customerError;

      // Update lead status
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'converted', converted_customer_id: customer.id })
        .eq('id', lead.id);
      
      if (leadError) throw leadError;
      
      return customer;
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Lead convertido em cliente!' });
      return customer;
    },
    onError: () => {
      toast({ title: 'Erro ao converter lead', variant: 'destructive' });
    },
  });
}

/**
 * Hook for sending WhatsApp messages to leads.
 * Uses the Evolution API to send messages.
 * 
 * @returns A React Query mutation object for sending messages
 */
export function useSendLeadMessage() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, phone, message }: { leadId: string; phone: string; message: string }) => {
      if (!business?.id) throw new Error('Business not found');

      const { data, error } = await supabase.functions.invoke('send-evolution-message', {
        body: {
          phone,
          message,
          business_id: business.id,
          lead_id: leadId,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', variables.leadId] });
      toast({ title: 'Mensagem enviada!' });
    },
    onError: () => {
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
    },
  });
}