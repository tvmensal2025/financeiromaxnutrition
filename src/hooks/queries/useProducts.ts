import { createQueryFactory } from '@/factories/createQueryFactory';
import { BusinessEntity } from '@/factories/types/core';

export interface Product extends BusinessEntity {
  name: string;
  description: string | null;
  price: number;
  cost: number;
  discount: number | null;
  sku: string | null;
  stock: number | null;
  is_active: boolean;
}

export interface UseProductsOptions {
  enabled?: boolean;
}

// Create the query factory for products with default filter for active products
const productQueryFactory = createQueryFactory<Product>({
  tableName: 'products',
  defaultFilters: { is_active: true }, // Only fetch active products by default
  cacheTime: 5 * 60 * 1000, // 5 minutes
  staleTime: 1 * 60 * 1000, // 1 minute
  defaultPageSize: 20,
  queryKeyGenerator: (operation, filters) => {
    // Maintain backward compatibility with existing query keys
    if (operation === 'list') {
      return ['products', filters?.businessId];
    }
    return ['products', operation, filters];
  }
});

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
  return productQueryFactory.useEntities({
    enabled: options.enabled,
  });
}

// Export additional factory-generated hooks for enhanced functionality
export const useProduct = productQueryFactory.useEntity;
export const useProductsInfinite = productQueryFactory.useEntitiesInfinite;
export const useProductsCount = productQueryFactory.useEntitiesCount;

// Export a hook for fetching all products (including inactive ones)
export function useAllProducts(options: UseProductsOptions = {}) {
  return productQueryFactory.useEntities({
    enabled: options.enabled,
    filters: { where: {} }, // Override default filters to get all products
  });
}
