import { createQueryFactory } from '@/factories/createQueryFactory';
import { BusinessEntity } from '@/factories/types/core';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
export type LeadTemperature = 'cold' | 'warm' | 'hot';

export interface Lead extends BusinessEntity {
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  temperature: LeadTemperature | null;
  notes: string | null;
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
}

export interface UseLeadsOptions {
  enabled?: boolean;
}

// Create the query factory for leads
const leadQueryFactory = createQueryFactory<Lead>({
  tableName: 'leads',
  cacheTime: 5 * 60 * 1000, // 5 minutes
  staleTime: 1 * 60 * 1000, // 1 minute
  defaultPageSize: 20,
  queryKeyGenerator: (operation, filters) => {
    // Maintain backward compatibility with existing query keys
    if (operation === 'list') {
      return ['leads', filters?.businessId];
    }
    return ['leads', operation, filters];
  }
});

/**
 * Custom hook for fetching leads for the current business.
 * Uses consistent query key pattern ['leads', businessId].
 * Returns empty array when business ID is missing without making a network request.
 * 
 * @param options - Optional configuration for the hook
 * @returns React Query result with leads data
 * 
 * @example
 * ```tsx
 * const { data: leads, isLoading, error } = useLeads();
 * 
 * // With options
 * const { data: leads } = useLeads({ enabled: isReady });
 * ```
 * 
 * Validates: Requirements 2.2, 2.8
 */
export function useLeads(options: UseLeadsOptions = {}) {
  return leadQueryFactory.useEntities({
    enabled: options.enabled,
  });
}

// Export additional factory-generated hooks for enhanced functionality
export const useLead = leadQueryFactory.useEntity;
export const useLeadsInfinite = leadQueryFactory.useEntitiesInfinite;
export const useLeadsCount = leadQueryFactory.useEntitiesCount;
