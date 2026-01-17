import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
export type LeadTemperature = 'cold' | 'warm' | 'hot';

export interface Lead {
  id: string;
  business_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface UseLeadsOptions {
  enabled?: boolean;
}

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
  const { business } = useAuth();

  return useQuery({
    queryKey: ['leads', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!business?.id && (options.enabled ?? true),
  });
}
