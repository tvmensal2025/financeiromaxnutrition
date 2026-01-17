/**
 * Messages hooks barrel export
 * 
 * Feature: project-refactoring
 * Requirements: 6.1-6.7
 * 
 * Re-exports all messages hooks from single entry point
 */

export { useConversations } from './useConversations';
export { useSelectedMessages } from './useSelectedMessages';
export { useContactInfo, type ContactType } from './useContactInfo';
export { useCustomerStats, type CustomerStats } from './useCustomerStats';
export { 
  useMessagesModals, 
  type MessagesModalsState, 
  type MessagesModalsActions, 
  type ModalName 
} from './useMessagesModals';
export { useMessagesMutations } from './useMessagesMutations';
export {
  useWhatsAppMessages,
  useLeadsData,
  useCustomersData,
  useMessagesRealtime,
  type WhatsAppMessage,
  type Lead,
  type Customer,
} from './useMessagesData';
export {
  useCustomerInvoices,
  useCustomerOpportunities,
  useScheduledMessages,
} from './useContactData';
export { useMessagesHandlers } from './useMessagesHandlers';