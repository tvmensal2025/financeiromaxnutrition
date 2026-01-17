/**
 * Hook for fetching messages data
 * 
 * Feature: project-refactoring
 * Requirements: 6.1
 * 
 * Extracts data fetching logic from Messages.tsx:
 * - Fetches WhatsApp messages with pagination
 * - Fetches leads and customers
 * - Sets up real-time subscription
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConversationStatus } from '@/components/chat/ConversationsList';

export interface WhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  media_metadata?: any;
  sender_name: string | null;
  lead_id: string | null;
  customer_id: string | null;
  business_id: string;
  is_group?: boolean;
  group_name?: string | null;
  participant_phone?: string | null;
  sender_avatar_url?: string | null;
  participant_count?: number;
  conversation_status?: ConversationStatus;
  transcribed_text?: string | null;
  transcription_error?: string | null;
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  source: string | null;
  temperature: 'cold' | 'warm' | 'hot' | null;
  status: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  created_at: string;
  recurring_due_date?: string | null;
  recurring_reminder_days?: number | null;
  recurring_message_time?: string | null;
  recurring_message_type?: string | null;
}

/**
 * Hook to fetch all messages for current user with pagination
 */
export function useWhatsAppMessages(userId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-messages', userId],
    queryFn: async () => {
      if (!userId) return [];

      const pageSize = 1000;
      let from = 0;
      const results: WhatsAppMessage[] = [];

      while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (!data || data.length === 0) break;

        results.push(...(data as WhatsAppMessage[]));

        if (data.length < pageSize) break;
        from += pageSize;
      }

      return results;
    },
    enabled: !!userId,
  });
}

/**
 * Hook to fetch leads for current business
 */
export function useLeadsData(businessId: string | undefined) {
  return useQuery({
    queryKey: ['leads', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('business_id', businessId);
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!businessId,
  });
}

/**
 * Hook to fetch customers for current business
 */
export function useCustomersData(businessId: string | undefined) {
  return useQuery({
    queryKey: ['customers', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId);
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!businessId,
  });
}

/**
 * Hook to set up real-time subscription for messages
 */
export function useMessagesRealtime(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Query invalidation is handled by mutations hook
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
