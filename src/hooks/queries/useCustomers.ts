import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Customer {
  id: string;
  business_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface UseCustomersOptions {
  enabled?: boolean;
}

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
  const { business } = useAuth();

  return useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!business?.id && (options.enabled ?? true),
  });
}
