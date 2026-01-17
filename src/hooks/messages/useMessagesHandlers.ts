/**
 * Hook for Messages page event handlers
 * 
 * Feature: project-refactoring
 * Requirements: 6.1
 * 
 * Extracts event handler logic from Messages.tsx
 */

import { useCallback } from 'react';
import { ConversationStatus } from '@/components/chat/ConversationsList';
import { Conversation } from '@/components/chat/ConversationsList';

interface UseMessagesHandlersProps {
  mutations: {
    updateStatus: {
      mutate: (params: { phone: string; status: ConversationStatus }) => void;
    };
    rejectConversation: {
      mutate: (phone: string) => void;
    };
    sendMessage: {
      mutate: (params: {
        selectedPhone: string;
        businessId: string;
        leadId?: string | null;
        customerId?: string | null;
        message: string;
        media?: { file: File; type: string };
        buttons?: Array<{ text: string; type: 'reply' | 'link'; url?: string }>;
      }) => void;
      isPending: boolean;
    };
  };
  selectedPhone: string | null;
  selectedConversation: Conversation | undefined;
  businessId: string | undefined;
  isMobileView: boolean;
  setSelectedPhone: (phone: string | null) => void;
  setShowChat: (show: boolean) => void;
}

export function useMessagesHandlers({
  mutations,
  selectedPhone,
  selectedConversation,
  businessId,
  isMobileView,
  setSelectedPhone,
  setShowChat,
}: UseMessagesHandlersProps) {
  const handleApproveConversation = useCallback(
    (phone: string) => {
      mutations.updateStatus.mutate({ phone, status: 'inbox' });
    },
    [mutations.updateStatus]
  );

  const handleUpdateStatus = useCallback(
    (phone: string, status: ConversationStatus) => {
      mutations.updateStatus.mutate({ phone, status });
    },
    [mutations.updateStatus]
  );

  const handleRejectConversation = useCallback(
    (phone: string) => {
      mutations.rejectConversation.mutate(phone);
    },
    [mutations.rejectConversation]
  );

  const handleSelectConversation = useCallback(
    (phone: string) => {
      setSelectedPhone(phone);
      if (isMobileView) {
        setShowChat(true);
      }
    },
    [isMobileView, setSelectedPhone, setShowChat]
  );

  const handleBack = useCallback(() => {
    setShowChat(false);
    setSelectedPhone(null);
  }, [setShowChat, setSelectedPhone]);

  const handleSendMessage = useCallback(
    (
      message: string,
      media?: { file: File; type: string },
      buttons?: Array<{ text: string; type: 'reply' | 'link'; url?: string }>
    ) => {
      if (!selectedPhone || !businessId) return;

      mutations.sendMessage.mutate({
        selectedPhone,
        businessId,
        leadId: selectedConversation?.lead_id,
        customerId: selectedConversation?.customer_id,
        message,
        media,
        buttons,
      });
    },
    [selectedPhone, businessId, selectedConversation, mutations.sendMessage]
  );

  return {
    handleApproveConversation,
    handleUpdateStatus,
    handleRejectConversation,
    handleSelectConversation,
    handleBack,
    handleSendMessage,
  };
}
