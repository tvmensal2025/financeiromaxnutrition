# Implementation Plan: Project Refactoring

## Overview

This implementation plan breaks down the WhatsApp Business CRM refactoring into discrete, incremental tasks. The approach is bottom-up: first creating foundational utilities and hooks, then building common components, and finally refactoring existing pages to use these new abstractions.

## Tasks

- [x] 1. Set up utility functions module
  - [x] 1.1 Create `src/lib/formatters.ts` with currency, phone, date, and datetime formatters
    - Implement `formatCurrency` using Intl.NumberFormat for BRL
    - Implement `formatPhone` with Brazilian format (XX) XXXXX-XXXX
    - Implement `formatDate` using date-fns with pt-BR locale
    - Implement `formatDateTime` combining date and time formatting
    - Implement `formatRelativeTime` for relative time display
    - Handle null/undefined inputs with configurable fallback
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8_
  
  - [x] 1.2 Write property tests for formatters
    - **Property 1: Formatter Output Format Validity**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  
  - [x] 1.3 Create `src/lib/validators.ts` with email, phone, and required validators
    - Implement `validateEmail` with regex pattern matching
    - Implement `validatePhone` for Brazilian phone numbers
    - Implement `validateRequired` for non-empty string validation
    - Implement `validateCPF` and `validateCNPJ` for Brazilian documents
    - Return false for null/undefined inputs
    - _Requirements: 1.5, 1.6, 1.7, 1.9_
  
  - [x] 1.4 Write property tests for validators
    - **Property 2: Validator Correctness**
    - **Property 3: Null/Undefined Handling Consistency**
    - **Validates: Requirements 1.5, 1.6, 1.7, 1.8, 1.9**

- [x] 2. Checkpoint - Ensure utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create custom query hooks
  - [x] 3.1 Create `src/hooks/queries/useCustomers.ts`
    - Implement hook with business ID filtering
    - Use consistent query key pattern `['customers', businessId]`
    - Return empty array when business ID is missing
    - _Requirements: 2.1, 2.7, 2.8_
  
  - [x] 3.2 Create `src/hooks/queries/useLeads.ts`
    - Implement hook with business ID filtering
    - Use consistent query key pattern `['leads', businessId]`
    - _Requirements: 2.2, 2.8_
  
  - [x] 3.3 Create `src/hooks/queries/useProducts.ts`
    - Implement hook filtering for active products only
    - Use consistent query key pattern `['products', businessId]`
    - _Requirements: 2.3, 2.8_
  
  - [x] 3.4 Create `src/hooks/queries/useServices.ts`
    - Implement hook filtering for active services only
    - Use consistent query key pattern `['services', businessId]`
    - _Requirements: 2.4, 2.8_
  
  - [x] 3.5 Create `src/hooks/queries/usePlans.ts`
    - Implement hook filtering for active plans only
    - Use consistent query key pattern `['plans', businessId]`
    - _Requirements: 2.5, 2.8_
  
  - [x] 3.6 Create `src/hooks/queries/useInvoices.ts`
    - Implement hook with optional customer ID filtering
    - Use consistent query key pattern `['invoices', businessId, customerId?]`
    - _Requirements: 2.6, 2.8_
  
  - [x] 3.7 Create `src/hooks/queries/index.ts` barrel export
    - Re-export all query hooks from single entry point
    - _Requirements: 2.1-2.6_
  
  - [x] 3.8 Write unit tests for query hooks
    - Test empty business ID returns empty array
    - Test error exposure through returned object
    - _Requirements: 2.7, 2.9_

- [x] 4. Create custom mutation hooks
  - [x] 4.1 Create `src/hooks/mutations/useMutationWithToast.ts`
    - Implement factory function accepting mutation config
    - Display success toast on mutation success
    - Display error toast on mutation failure
    - Automatically invalidate specified query keys
    - Support onSuccess and onError callbacks
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 3.7, 3.8_
  
  - [x] 4.2 Create `src/hooks/mutations/useCustomerMutations.ts`
    - Implement `useCreateCustomer` using useMutationWithToast
    - Implement `useUpdateCustomer` using useMutationWithToast
    - Implement `useDeleteCustomer` using useMutationWithToast
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.3 Create `src/hooks/mutations/useLeadMutations.ts`
    - Implement `useCreateLead` using useMutationWithToast
    - Implement `useUpdateLead` using useMutationWithToast
    - Implement `useDeleteLead` using useMutationWithToast
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.4 Create `src/hooks/mutations/index.ts` barrel export
    - Re-export all mutation hooks from single entry point
    - _Requirements: 3.1-3.3_
  
  - [x] 4.5 Write unit tests for mutation hooks
    - Test success toast display
    - Test error toast display
    - Test query invalidation
    - Test callback invocation
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 5. Checkpoint - Ensure hook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create common UI components
  - [x] 6.1 Create `src/components/common/LoadingState.tsx`
    - Implement centered spinner with optional message
    - Support size prop (sm, md, lg)
    - _Requirements: 5.1, 5.4_
  
  - [x] 6.2 Create `src/components/common/EmptyState.tsx`
    - Implement icon, title, description display
    - Support optional action button with onClick handler
    - _Requirements: 5.2, 5.5, 5.6_
  
  - [x] 6.3 Create `src/components/common/DataTable.tsx`
    - Implement table with columns configuration
    - Support accessor functions and custom renderers
    - Integrate LoadingState for loading prop
    - Integrate EmptyState for empty data
    - Support onRowClick callback
    - _Requirements: 5.3, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12_
  
  - [x] 6.4 Write property tests for DataTable
    - **Property 7: DataTable Data Rendering Consistency**
    - **Validates: Requirements 5.3, 5.7, 5.8**
  
  - [x] 6.5 Create `src/components/common/index.ts` barrel export
    - Re-export LoadingState, EmptyState, DataTable
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Create FormModal component
  - [x] 7.1 Create `src/components/common/FormModal.tsx`
    - Implement Dialog wrapper with title, description, icon props
    - Implement field rendering for all supported types
    - Implement form state management with useState
    - Implement required field validation
    - Implement conditional field visibility via visibleWhen
    - Implement custom validation with error messages
    - Reset form state when modal closes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_
  
  - [x] 7.2 Write property tests for FormModal
    - **Property 4: FormModal Field Rendering**
    - **Property 5: FormModal Required Field Validation**
    - **Property 6: FormModal Conditional Field Visibility**
    - **Validates: Requirements 4.4, 4.9, 4.11**
  
  - [x] 7.3 Write unit tests for FormModal
    - Test each field type renders correctly
    - Test form submission with valid data
    - Test form reset on close
    - Test custom validation error display
    - _Requirements: 4.5, 4.6, 4.10, 4.12_

- [x] 8. Checkpoint - Ensure component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create Messages page hooks
  - [x] 9.1 Create `src/hooks/messages/useConversations.ts`
    - Extract conversation building logic from Messages.tsx
    - Build conversations map from messages array
    - Calculate unread counts per phone
    - Sort by last message timestamp
    - _Requirements: 6.1_
  
  - [x] 9.2 Create `src/hooks/messages/useSelectedMessages.ts`
    - Extract message filtering for selected conversation
    - Sort messages by timestamp ascending
    - Map to Message interface
    - _Requirements: 6.2_
  
  - [x] 9.3 Create `src/hooks/messages/useContactInfo.ts`
    - Extract contact info derivation logic
    - Look up customer or lead by ID
    - Return unified contact info object
    - _Requirements: 6.3_
  
  - [x] 9.4 Create `src/hooks/messages/useCustomerStats.ts`
    - Extract customer stats calculation
    - Calculate totals from invoices and opportunities
    - Return CustomerStats object
    - _Requirements: 6.4_
  
  - [x] 9.5 Create `src/hooks/messages/useMessagesModals.ts`
    - Extract modal state management
    - Provide openModal, closeModal, toggleModal functions
    - _Requirements: 6.6_
  
  - [x] 9.6 Create `src/hooks/messages/useMessagesMutations.ts`
    - Extract sendMessage mutation
    - Extract updateStatus mutation
    - Extract rejectConversation mutation
    - Use useMutationWithToast for consistent toast handling
    - _Requirements: 6.7_
  
  - [x] 9.7 Create `src/hooks/messages/index.ts` barrel export
    - Re-export all messages hooks
    - _Requirements: 6.1-6.7_

- [x] 10. Create Messages page components
  - [x] 10.1 Create `src/components/messages/MessagesHeader.tsx`
    - Extract header section from Messages.tsx
    - Include bulk message, templates, scheduled buttons
    - Include info panel toggle
    - _Requirements: 6.5_
  
  - [x] 10.2 Create `src/components/messages/index.ts` barrel export
    - Re-export MessagesHeader
    - _Requirements: 6.5_

- [x] 11. Refactor Messages.tsx
  - [x] 11.1 Refactor Messages.tsx to use new hooks and components
    - Replace inline conversation building with useConversations
    - Replace inline message filtering with useSelectedMessages
    - Replace inline contact info with useContactInfo
    - Replace inline customer stats with useCustomerStats
    - Replace inline modal state with useMessagesModals
    - Replace inline mutations with useMessagesMutations
    - Replace header section with MessagesHeader component
    - Target: under 300 lines
    - _Requirements: 6.1-6.9_

- [x] 12. Checkpoint - Verify Messages page functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Refactor Customers.tsx
  - [x] 13.1 Refactor Customers.tsx to use new utilities and components
    - Replace inline formatCurrency with centralized utility
    - Replace inline queries with useCustomers, useProducts, useServices
    - Replace inline mutations with useCustomerMutations
    - Replace customer list with DataTable component
    - Replace loading state with LoadingState component
    - Replace empty state with EmptyState component
    - Target: under 400 lines
    - _Requirements: 7.1-7.8_

- [x] 14. Refactor Leads.tsx
  - [x] 14.1 Refactor Leads.tsx to use new utilities and components
    - Replace inline formatCurrency with centralized utility
    - Replace inline queries with useLeads, useProducts, useServices
    - Replace inline mutations with useLeadMutations
    - Replace lead list with DataTable component
    - Replace loading state with LoadingState component
    - Replace empty state with EmptyState component
    - Target: under 400 lines
    - _Requirements: 7.1-7.7, 7.9_

- [x] 15. Checkpoint - Verify Customers and Leads pages
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Consolidate chat modals
  - [x] 16.1 Refactor CreateOpportunityModal to use FormModal
    - Define field configuration for opportunity form
    - Use FormModal with existing mutation logic
    - Preserve all validation and functionality
    - _Requirements: 8.2, 8.5, 8.6_
  
  - [x] 16.2 Refactor CreateInvoiceModal to use FormModal
    - Define field configuration for invoice form
    - Handle customer requirement check
    - Use FormModal with existing mutation logic
    - _Requirements: 8.3, 8.5, 8.6_
  
  - [x] 16.3 Refactor ScheduleMessageModal to use FormModal
    - Define field configuration with conditional recurrence fields
    - Use visibleWhen for recurrence options
    - Use FormModal with existing mutation logic
    - _Requirements: 8.4, 8.5, 8.6, 8.7_
  
  - [x] 16.4 Refactor AddCustomerModal to use FormModal with custom sections
    - Define base field configuration
    - Add custom subscription section as child component
    - Use FormModal with existing mutation logic
    - _Requirements: 8.1, 8.5, 8.6, 8.7_

- [x] 17. Final checkpoint - Full regression testing
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all pages render correctly
  - Verify all CRUD operations work
  - Verify all modals function properly

## Notes

- All tasks are required for comprehensive testing coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The refactoring maintains backward compatibility - no API changes to existing components
