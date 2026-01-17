/**
 * Hook for building conversations list from WhatsApp messages
 * 
 * Feature: project-refactoring
 * Requirements: 6.1
 * 
 * Extracts conversation building logic from Messages.tsx:
 * - Builds conversations map from messages array
 * - Calculates unread counts per phone
 * - Sorts by last message timestamp
 */

import { useMemo } from 'react';
import { Conversation, ConversationStatus } from '@/components/chat/ConversationsList';

interface WhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  media_url: string | null;
  media_type: string | null;
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
}

/**
 * Hook to build conversations list from WhatsApp messages
 * 
 * @param allMessages - Array of WhatsApp messages (should be ordered by created_at desc)
 * @returns Array of conversations sorted by last message timestamp
 */
export function useConversations(allMessages: WhatsAppMessage[]): Conversation[] {
  return useMemo(() => {
    // Calculate unread counts by phone
    const unreadCountByPhone = new Map<string, number>();

    for (const m of allMessages) {
      if (m.direction === 'inbound' && m.status === 'pending') {
        unreadCountByPhone.set(m.phone, (unreadCountByPhone.get(m.phone) || 0) + 1);
      }
    }

    const phoneMap = new Map<string, Conversation>();

    // allMessages comes in desc order (most recent first)
    for (const msg of allMessages) {
      const isGroup = msg.phone.startsWith('group:') || msg.is_group;
      const existing = phoneMap.get(msg.phone);

      // First record for this phone is the latest message (due to desc order)
      if (!existing) {
        phoneMap.set(msg.phone, {
          phone: msg.phone,
          sender_name: msg.sender_name,
          lead_id: msg.lead_id,
          customer_id: msg.customer_id,
          last_message: msg.message,
          last_message_at: msg.created_at,
          unread_count: unreadCountByPhone.get(msg.phone) || 0,
          direction: msg.direction,
          is_group: isGroup,
          group_name: msg.group_name,
          participant_count: msg.participant_count || 0,
          avatar_url: msg.sender_avatar_url,
          conversation_status: msg.conversation_status || 'pending',
        });
        continue;
      }

      // Fill in missing data (mainly for groups)
      if (isGroup) {
        if (!existing.group_name && msg.group_name) {
          existing.group_name = msg.group_name;
        }
        if ((msg.participant_count || 0) > (existing.participant_count || 0)) {
          existing.participant_count = msg.participant_count || existing.participant_count || 0;
        }
      }

      // Fill in other missing data
      if (!existing.sender_name && msg.sender_name) existing.sender_name = msg.sender_name;
      if (!existing.lead_id && msg.lead_id) existing.lead_id = msg.lead_id;
      if (!existing.customer_id && msg.customer_id) existing.customer_id = msg.customer_id;
      if (!existing.avatar_url && msg.sender_avatar_url) existing.avatar_url = msg.sender_avatar_url;
    }

    // Convert to array and sort by last message timestamp (most recent first)
    return Array.from(phoneMap.values()).sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
  }, [allMessages]);
}