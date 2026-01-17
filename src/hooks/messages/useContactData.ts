/**
 * Hook for fetching contact-related data
 * 
 * Feature: project-refactoring
 * Requirements: 6.3, 6.4
 * 
 * Extracts contact data fetching logic from Messages.tsx:
 * - Fetches customer invoices
 * - Fetches customer opportunities
 * - Fetches scheduled messages
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/components/chat/ConversationsList';

/**
 * Hook to fetch invoices for selected customer
 */
export function useCustomerInvoices(
  businessId: string | undefined,
  customerId: string | undefined
) {
  return useQuery({
    queryKey: ['customer-invoices', customerId],
    queryFn: async () => {
      if (!businessId || !customerId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('business_id', businessId)
        .eq('customer_id', customerId);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!customerId,
  });
}

/**
 * Hook to fetch won opportunities for selected customer
 */
export function useCustomerOpportunities(
  businessId: string | undefined,
  customerId: string | undefined
) {
  return useQuery({
    queryKey: ['customer-opportunities', customerId],
    queryFn: async () => {
      if (!businessId || !customerId) return [];
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('business_id', businessId)
        .eq('customer_id', customerId)
        .eq('stage', 'closed_won');
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!customerId,
  });
}

/**
 * Hook to fetch scheduled messages for selected contact
 */
export function useScheduledMessages(
  businessId: string | undefined,
  selectedConversation: Conversation | undefined,
  selectedPhone: string | null
) {
  return useQuery({
    queryKey: [
      'scheduled-messages',
      selectedConversation?.lead_id,
      selectedConversation?.customer_id,
      selectedPhone,
    ],
    queryFn: async () => {
      if (!businessId) return [];

      let query = supabase
        .from('scheduled_messages')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });

      if (selectedConversation?.customer_id) {
        query = query.eq('customer_id', selectedConversation.customer_id);
      } else if (selectedConversation?.lead_id) {
        query = query.eq('lead_id', selectedConversation.lead_id);
      } else if (selectedPhone) {
        query = query.eq('phone', selectedPhone);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!selectedPhone,
  });
}
