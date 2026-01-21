import { createQueryFactory } from '@/factories/createQueryFactory';
import { BusinessEntity } from '@/factories/types/core';

export interface Customer extends BusinessEntity {
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  cpf: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  neighborhood: string | null;
  country: string | null;
  company_name: string | null;
  occupation: string | null;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  source: string | null;
  avatar_url: string | null;
  points: number | null;
  last_activity: string | null;
  activity_level: string | null;
  fitness_level: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  interest_type: string | null;
  interested_product_id: string | null;
  interested_service_id: string | null;
  interest_is_recurring: boolean | null;
  recurring_due_date: string | null;
  recurring_message_time: string | null;
  recurring_reminder_days: number | null;
  recurring_message_type: string | null;
  recurring_reminder_template: string | null;
  recurring_overdue_template: string | null;
  lead_data: Record<string, unknown> | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

export interface UseCustomersOptions {
  enabled?: boolean;
}

// Create the query factory for customers
const customerQueryFactory = createQueryFactory<Customer>({
  tableName: 'customers',
  cacheTime: 5 * 60 * 1000, // 5 minutes
  staleTime: 1 * 60 * 1000, // 1 minute
  defaultPageSize: 20,
  queryKeyGenerator: (operation, filters) => {
    // Maintain backward compatibility with existing query keys
    if (operation === 'list') {
      return ['customers', filters?.businessId];
    }
    return ['customers', operation, filters];
  }
});

/**
 * Custom hook for fetching customers for the current business.
 * Uses consistent query key pattern ['customers', businessId].
 * Returns empty array when business ID is missing without making a network request.
 * 
 * @param options - Optional configuration for the hook
 * @returns React Query result with customers data
 * 
 * @example
 * ```tsx
 * const { data: customers, isLoading, error } = useCustomers();
 * 
 * // With options
 * const { data: customers } = useCustomers({ enabled: isReady });
 * ```
 * 
 * Validates: Requirements 2.1, 2.7, 2.8
 */
export function useCustomers(options: UseCustomersOptions = {}) {
  return customerQueryFactory.useEntities({
    enabled: options.enabled,
  });
}

// Export additional factory-generated hooks for enhanced functionality
export const useCustomer = customerQueryFactory.useEntity;
export const useCustomersInfinite = customerQueryFactory.useEntitiesInfinite;
export const useCustomersCount = customerQueryFactory.useEntitiesCount;
