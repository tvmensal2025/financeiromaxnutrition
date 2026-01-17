# Requirements Document

## Introduction

This document specifies the requirements for refactoring the WhatsApp Business CRM project to improve code maintainability, reduce duplication, and establish consistent patterns across the codebase. The refactoring focuses on extracting utility functions, creating reusable hooks, consolidating modal components, and breaking down large files into smaller, focused components.

## Glossary

- **Utility_Module**: A centralized module containing pure functions for formatting and validation
- **Custom_Hook**: A reusable React hook that encapsulates React Query patterns with standardized error handling
- **FormModal**: A generic modal component that renders forms dynamically based on configuration
- **Common_Component**: A reusable UI component for displaying loading states, empty states, or data tables
- **Page_Component**: A top-level React component that represents a full page in the application

## Requirements

### Requirement 1: Centralized Utility Functions

**User Story:** As a developer, I want centralized utility functions for formatting and validation, so that I can avoid code duplication and ensure consistent behavior across the application.

#### Acceptance Criteria

1. THE Utility_Module SHALL export a `formatCurrency` function that formats numbers as Brazilian Real (BRL) currency
2. THE Utility_Module SHALL export a `formatPhone` function that formats phone numbers in Brazilian format (XX) XXXXX-XXXX
3. THE Utility_Module SHALL export a `formatDate` function that formats dates using pt-BR locale with configurable format patterns
4. THE Utility_Module SHALL export a `formatDateTime` function that formats date-time values with both date and time components
5. THE Utility_Module SHALL export a `validateEmail` function that returns true for valid email addresses and false otherwise
6. THE Utility_Module SHALL export a `validatePhone` function that returns true for valid Brazilian phone numbers and false otherwise
7. THE Utility_Module SHALL export a `validateRequired` function that returns true for non-empty, non-whitespace strings and false otherwise
8. WHEN a formatter function receives null or undefined, THE Utility_Module SHALL return an empty string or a configurable fallback value
9. WHEN a validator function receives null or undefined, THE Utility_Module SHALL return false

### Requirement 2: Custom Query Hooks

**User Story:** As a developer, I want reusable query hooks for common data fetching patterns, so that I can reduce boilerplate code and ensure consistent caching behavior.

#### Acceptance Criteria

1. THE Custom_Hook module SHALL export a `useCustomers` hook that fetches customers for the current business
2. THE Custom_Hook module SHALL export a `useLeads` hook that fetches leads for the current business
3. THE Custom_Hook module SHALL export a `useProducts` hook that fetches active products for the current business
4. THE Custom_Hook module SHALL export a `useServices` hook that fetches active services for the current business
5. THE Custom_Hook module SHALL export a `usePlans` hook that fetches active plans for the current business
6. THE Custom_Hook module SHALL export a `useInvoices` hook that fetches invoices with optional customer filtering
7. WHEN a query hook is called without a valid business ID, THE Custom_Hook SHALL return an empty array without making a network request
8. THE Custom_Hook module SHALL use consistent query key patterns following the format `[entity-name, business-id, ...filters]`
9. WHEN a query fails, THE Custom_Hook SHALL expose the error through the returned object for component-level handling

### Requirement 3: Custom Mutation Hooks

**User Story:** As a developer, I want reusable mutation hooks with standardized toast notifications, so that I can ensure consistent user feedback across all CRUD operations.

#### Acceptance Criteria

1. THE Custom_Hook module SHALL export a `useCreateMutation` factory function that creates mutations with success/error toasts
2. THE Custom_Hook module SHALL export a `useUpdateMutation` factory function that creates update mutations with success/error toasts
3. THE Custom_Hook module SHALL export a `useDeleteMutation` factory function that creates delete mutations with confirmation and success/error toasts
4. WHEN a mutation succeeds, THE Custom_Hook SHALL display a success toast with a configurable message
5. WHEN a mutation fails, THE Custom_Hook SHALL display an error toast with the error message
6. WHEN a mutation succeeds, THE Custom_Hook SHALL automatically invalidate related query keys
7. THE Custom_Hook module SHALL accept an `onSuccess` callback for additional success handling
8. THE Custom_Hook module SHALL accept an `onError` callback for additional error handling

### Requirement 4: Generic FormModal Component

**User Story:** As a developer, I want a generic form modal component, so that I can create consistent modal forms without duplicating dialog structure and form handling logic.

#### Acceptance Criteria

1. THE FormModal component SHALL accept a `title` prop for the modal header
2. THE FormModal component SHALL accept a `description` prop for the modal description
3. THE FormModal component SHALL accept an `icon` prop for displaying an icon in the header
4. THE FormModal component SHALL accept a `fields` configuration array defining form fields
5. THE FormModal component SHALL support field types: text, email, number, date, time, textarea, select, switch
6. THE FormModal component SHALL accept an `onSubmit` callback that receives the form data
7. THE FormModal component SHALL accept an `isLoading` prop to show loading state on the submit button
8. THE FormModal component SHALL accept a `submitLabel` prop for customizing the submit button text
9. WHEN a required field is empty, THE FormModal component SHALL prevent form submission
10. WHEN the modal is closed, THE FormModal component SHALL reset the form to its initial state
11. THE FormModal component SHALL support conditional field visibility based on other field values
12. THE FormModal component SHALL support field validation with custom error messages

### Requirement 5: Common UI Components

**User Story:** As a developer, I want common UI components for loading states, empty states, and data tables, so that I can maintain visual consistency and reduce repetitive code.

#### Acceptance Criteria

1. THE Common_Component module SHALL export a `LoadingState` component that displays a centered spinner with optional message
2. THE Common_Component module SHALL export an `EmptyState` component that displays an icon, title, description, and optional action button
3. THE Common_Component module SHALL export a `DataTable` component that renders tabular data with sorting and filtering
4. THE LoadingState component SHALL accept a `size` prop to control spinner dimensions
5. THE EmptyState component SHALL accept an `icon` prop for the empty state illustration
6. THE EmptyState component SHALL accept an `action` prop with label and onClick handler
7. THE DataTable component SHALL accept a `columns` configuration array defining column headers and accessors
8. THE DataTable component SHALL accept a `data` array of objects to render
9. THE DataTable component SHALL accept an `onRowClick` callback for row selection
10. THE DataTable component SHALL support column-level custom renderers via a `render` function
11. WHEN data is loading, THE DataTable component SHALL display the LoadingState component
12. WHEN data is empty, THE DataTable component SHALL display the EmptyState component

### Requirement 6: Messages Page Refactoring

**User Story:** As a developer, I want the Messages.tsx file broken down into smaller components, so that the code is easier to understand, test, and maintain.

#### Acceptance Criteria

1. THE Page_Component refactoring SHALL extract conversation building logic into a `useConversations` hook
2. THE Page_Component refactoring SHALL extract message filtering logic into a `useSelectedMessages` hook
3. THE Page_Component refactoring SHALL extract contact info derivation into a `useContactInfo` hook
4. THE Page_Component refactoring SHALL extract customer stats calculation into a `useCustomerStats` hook
5. THE Page_Component refactoring SHALL extract the header section into a `MessagesHeader` component
6. THE Page_Component refactoring SHALL extract modal management into a `useMessagesModals` hook
7. THE Page_Component refactoring SHALL extract mutation definitions into dedicated hooks
8. WHEN the refactoring is complete, THE Messages.tsx file SHALL be under 300 lines
9. THE refactored components SHALL maintain all existing functionality without behavioral changes

### Requirement 7: Customers and Leads Page Refactoring

**User Story:** As a developer, I want the Customers.tsx and Leads.tsx files refactored to use the new common components and hooks, so that they follow consistent patterns.

#### Acceptance Criteria

1. THE Page_Component refactoring SHALL replace inline formatCurrency calls with the centralized utility function
2. THE Page_Component refactoring SHALL replace inline query definitions with custom query hooks
3. THE Page_Component refactoring SHALL replace inline mutation definitions with custom mutation hooks
4. THE Page_Component refactoring SHALL use the DataTable component for displaying customer/lead lists
5. THE Page_Component refactoring SHALL use the LoadingState component during data fetching
6. THE Page_Component refactoring SHALL use the EmptyState component when no data exists
7. THE Page_Component refactoring SHALL use the FormModal component for create/edit dialogs
8. WHEN the refactoring is complete, THE Customers.tsx file SHALL be under 400 lines
9. WHEN the refactoring is complete, THE Leads.tsx file SHALL be under 400 lines

### Requirement 8: Chat Modal Consolidation

**User Story:** As a developer, I want the chat modal components consolidated to use the generic FormModal, so that modal behavior is consistent and maintenance is simplified.

#### Acceptance Criteria

1. THE modal consolidation SHALL refactor AddCustomerModal to use FormModal with custom sections
2. THE modal consolidation SHALL refactor CreateOpportunityModal to use FormModal
3. THE modal consolidation SHALL refactor CreateInvoiceModal to use FormModal
4. THE modal consolidation SHALL refactor ScheduleMessageModal to use FormModal
5. THE modal consolidation SHALL preserve all existing modal functionality and validation
6. THE modal consolidation SHALL maintain the same visual appearance and user experience
7. WHEN a modal requires complex conditional logic, THE consolidation SHALL use FormModal's conditional field visibility feature
