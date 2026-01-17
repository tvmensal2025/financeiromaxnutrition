import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface UseServicesOptions {
  enabled?: boolean;
}

/**
 * Custom hook for fetching active services for the current business.
 * Uses consistent query key pattern ['services', businessId].
 * Returns empty array when business ID is missing without making a network request.
 * Filters for active services only (is_active = true).
 * 
 * @param options - Optional configuration for the hook
 * @returns React Query result with services data
 * 
 * @example
 * ```tsx
 * const { data: services, isLoading, error } = useServices();
 * 
 * // With options
 * const { data: services } = useServices({ enabled: isReady });
 * ```
 * 
 * Validates: Requirements 2.4, 2.8
 */
export function useServices(options: UseServicesOptions = {}) {
  const { business } = useAuth();

  return useQuery({
    queryKey: ['services', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Service[];
    },
    enabled: !!business?.id && (options.enabled ?? true),
  });
}
