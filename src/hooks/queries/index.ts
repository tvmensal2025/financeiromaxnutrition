/**
 * Barrel export for all query hooks.
 * Re-exports all query hooks from a single entry point for convenient imports.
 * 
 * @example
 * ```tsx
 * import { useCustomers, useLeads, useProducts, useServices, usePlans, useInvoices } from '@/hooks/queries';
 * 
 * // Use hooks in components
 * const { data: customers } = useCustomers();
 * const { data: leads } = useLeads();
 * const { data: products } = useProducts();
 * ```
 * 
 * Validates: Requirements 2.1-2.6
 */

// Re-export useCustomers hook and types
export { useCustomers, useCustomer, useCustomersInfinite, useCustomersCount } from './useCustomers';
export type { Customer, UseCustomersOptions } from './useCustomers';

// Re-export useLeads hook and types
export { useLeads, useLead, useLeadsInfinite, useLeadsCount } from './useLeads';
export type { Lead, LeadStatus, LeadTemperature, UseLeadsOptions } from './useLeads';

// Re-export useProducts hook and types
export { useProducts, useProduct, useProductsInfinite, useProductsCount, useAllProducts } from './useProducts';
export type { Product, UseProductsOptions } from './useProducts';

// Re-export useServices hook and types
export { useServices } from './useServices';
export type { Service, UseServicesOptions } from './useServices';

// Re-export usePlans hook and types
export { usePlans } from './usePlans';
export type { Plan, UsePlansOptions } from './usePlans';

// Re-export useInvoices hook and types
export { useInvoices } from './useInvoices';
export type { Invoice, UseInvoicesOptions } from './useInvoices';
