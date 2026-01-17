import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  discount: number | null;
  sku: string | null;
  stock: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseProductsOptions {
  enabled?: boolean;
}

/**
 * Custom hook for fetching active products for the current business.
 * Uses consistent query key pattern ['products', businessId].
 * Returns empty array when business ID is missing without making a network request.
 * Filters for active products only (is_active = true).
 * 
 * @param options - Optional configuration for the hook
 * @returns React Query result with products data
 * 
 * @example
 * ```tsx
 * const { data: products, isLoading, error } = useProducts();
 * 
 * // With options
 * const { data: products } = useProducts({ enabled: isReady });
 * ```
 * 
 * Validates: Requirements 2.3, 2.8
 */
export function useProducts(options: UseProductsOptions = {}) {
  const { business } = useAuth();

  return useQuery({
    queryKey: ['products', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!business?.id && (options.enabled ?? true),
  });
}
