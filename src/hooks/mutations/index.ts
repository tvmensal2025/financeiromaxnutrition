/**
 * Barrel export for mutation hooks.
 * Re-exports all mutation hooks from a single entry point.
 * 
 * @module hooks/mutations
 * 
 * Requirements: 3.1-3.3
 */

// Core mutation factory hook
export { useMutationWithToast } from './useMutationWithToast';
export type { MutationWithToastOptions } from './useMutationWithToast';

// Customer mutation hooks
export {
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from './useCustomerMutations';
export type {
  Customer,
  CreateCustomerData,
  UpdateCustomerVariables,
} from './useCustomerMutations';

// Lead mutation hooks
export {
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
} from './useLeadMutations';
export type {
  CreateLeadData,
  UpdateLeadVariables,
} from './useLeadMutations';
