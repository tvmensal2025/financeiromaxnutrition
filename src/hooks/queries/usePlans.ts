import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Plan {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  credits: number;
  billing_cycle: string;
  is_active: boolean;
  created_at: string;
}

export interface UsePlansOptions {
  enabled?: boolean;
}

/**
 * Custom hook for fetching active plans for the current business.
 * Uses consistent query key pattern ['plans', businessId].
 * Returns empty array when business ID is missing without making a network request.
 * Filters for active plans only (is_active = true).
 * 
 * @param options - Optional configuration for the hook
 * @returns React Query result with plans data
 * 
 * @example
 * ```tsx
 * const { data: plans, isLoading, error } = usePlans();
 * 
 * // With options
 * const { data: plans } = usePlans({ enabled: isReady });
 * ```
 * 
 * Validates: Requirements 2.5, 2.8
 */
export function usePlans(options: UsePlansOptions = {}) {
  const { business } = useAuth();

  return useQuery({
    queryKey: ['plans', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Plan[];
    },
    enabled: !!business?.id && (options.enabled ?? true),
  });
}
