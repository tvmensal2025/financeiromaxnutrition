/**
 * Common UI Components Barrel Export
 * 
 * This module re-exports all common UI components for convenient importing.
 * 
 * @example
 * ```tsx
 * import { LoadingState, EmptyState, DataTable, FormModal } from '@/components/common';
 * ```
 * 
 * Requirements: 4.1-4.12, 5.1, 5.2, 5.3
 */

// LoadingState component and types (Requirement 5.1)
export { LoadingState } from './LoadingState';
export type { LoadingStateProps } from './LoadingState';

// EmptyState component and types (Requirement 5.2)
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// DataTable component and types (Requirement 5.3)
export { DataTable } from './DataTable';
export type { 
  Column, 
  DataTableProps, 
  DataTableEmptyState 
} from './DataTable';

// FormModal component and types (Requirements 4.1-4.12)
export { FormModal } from './FormModal';
export type { 
  FormModalProps, 
  FormField, 
  FieldType, 
  SelectOption 
} from './FormModal';
