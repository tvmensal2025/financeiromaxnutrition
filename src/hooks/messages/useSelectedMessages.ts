/**
 * Hook for filtering messages for selected conversation
 * 
 * Feature: project-refactoring
 * Requirements: 6.2
 * 
 * Extracts message filtering logic from Messages.tsx:
 * - Filters messages for selected conversation
 * - Sorts messages by timestamp ascending
 * - Maps to Message interface
 */

import { useMemo } from 'react';
import { Message } from '@/components/chat/ChatMessage';

interface WhatsAppMessage {
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
  participant_phone?: string | null;
  transcribed_text?: string | null;
  transcription_error?: string | null;
}

/**
 * Hook to get messages for selected conversation
 * 
 * @param allMessages - Array of all WhatsApp messages
 * @param selectedPhone - Phone number of selected conversation
 * @returns Array of messages for the selected conversation, sorted chronologically
 */
export function useSelectedMessages(
  allMessages: WhatsAppMessage[], 
  selectedPhone: string | null
): Message[] {
  return useMemo(() => {
    if (!selectedPhone) return [];
    
    return allMessages
      .filter((m) => m.phone === selectedPhone)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((m): Message => ({
        id: m.id,
        message: m.message,
        direction: m.direction,
        status: m.status,
        created_at: m.created_at,
        media_url: m.media_url,
        media_type: m.media_type,
        media_metadata: m.media_metadata,
        sender_name: m.sender_name,
        is_group: m.is_group,
        participant_phone: m.participant_phone,
        transcribed_text: m.transcribed_text,
        transcription_error: m.transcription_error,
      }));
  }, [allMessages, selectedPhone]);
}