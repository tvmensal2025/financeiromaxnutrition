/**
 * Hook for managing modal states in Messages page
 * 
 * Feature: project-refactoring
 * Requirements: 6.6
 * 
 * Extracts modal state management logic from Messages.tsx:
 * - Provides openModal, closeModal, toggleModal functions
 * - Manages all modal states in a centralized way
 */

import { useState, useCallback } from 'react';

export interface MessagesModalsState {
  showAddCustomerModal: boolean;
  showOpportunityModal: boolean;
  showInvoiceModal: boolean;
  showScheduleModal: boolean;
  showTemplatesModal: boolean;
  showBulkMessageModal: boolean;
  showExtractContactsModal: boolean;
  showScheduledListModal: boolean;
}

export type ModalName = keyof MessagesModalsState;

export interface MessagesModalsActions {
  openModal: (modalName: ModalName) => void;
  closeModal: (modalName: ModalName) => void;
  toggleModal: (modalName: ModalName) => void;
  closeAllModals: () => void;
}

const initialState: MessagesModalsState = {
  showAddCustomerModal: false,
  showOpportunityModal: false,
  showInvoiceModal: false,
  showScheduleModal: false,
  showTemplatesModal: false,
  showBulkMessageModal: false,
  showExtractContactsModal: false,
  showScheduledListModal: false,
};

/**
 * Hook to manage modal states for Messages page
 * 
 * @returns Object containing modal states and actions
 */
export function useMessagesModals(): MessagesModalsState & MessagesModalsActions {
  const [modals, setModals] = useState<MessagesModalsState>(initialState);

  const openModal = useCallback((modalName: ModalName) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
  }, []);

  const closeModal = useCallback((modalName: ModalName) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
  }, []);

  const toggleModal = useCallback((modalName: ModalName) => {
    setModals(prev => ({ ...prev, [modalName]: !prev[modalName] }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(initialState);
  }, []);

  return {
    ...modals,
    openModal,
    closeModal,
    toggleModal,
    closeAllModals,
  };
}