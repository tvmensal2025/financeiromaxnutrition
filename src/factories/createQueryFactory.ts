/**
 * Generic Query Factory Implementation
 * 
 * Creates type-safe query hooks for any entity type using TanStack Query.
 * Eliminates code duplication across query hooks while maintaining consistent patterns.
 * 
 * @fileoverview Generic query factory implementation
 * @version 1.0.0
 */

import { 
  useQuery, 
  useInfiniteQuery, 
  UseQueryResult, 
  UseInfiniteQueryResult,
  QueryKey,
  InfiniteData
} from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BaseEntity, 
  QueryFilters, 
  PaginatedResult,
  FactoryError 
} from './types/core';
import { 
  QueryFactory, 
  QueryFactoryOptions, 
  QueryHookOptions,
  InfiniteQueryHookOptions,
  QueryOperation,
  RealtimeEvent
} from './types/query';

/**
 * Creates a generic query factory for any entity type.
 * Generates type-safe query hooks with consistent patterns for data fetching.
 * 
 * @template T - The entity type extending BaseEntity
 * @param options - Configuration options for the query factory
 * @returns A query factory with type-safe query hooks
 * 
 * @example
 * ```typescript
 * interface Customer extends BaseEntity {
 *   name: string;
 *   email?: string;
 *   phone?: string;
 * }
 * 
 * const customerQueries = createQueryFactory<Customer>({
 *   tableName: 'customers',
 *   defaultFilters: { active: true },
 *   realTimeSubscription: true,
 *   defaultPageSize: 20
 * });
 * 
 * // Usage in component
 * const customers = customerQueries.useEntities();
 * const customer = customerQueries.useEntity('customer-id');
 * const infiniteCustomers = customerQueries.useEntitiesInfinite();
 * ```
 * 
 * **Validates: Requirements 2.1, 2.4**
 */
export function createQueryFactory<T extends BaseEntity>(
  options: QueryFactoryOptions
): QueryFactory<T> {
  const {
    tableName,
    defaultFilters = {},
    realTimeSubscription = false,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 1 * 60 * 1000, // 1 minute
    defaultPageSize = 20,
    select = '*',
    joins = [],
    queryKeyGenerator,
    debug = false
  } = options;

  /**
   * Creates a standardized error object from various error types.
   */
  const createFactoryError = (
    error: unknown, 
    operation: QueryOperation, 
    context?: string
  ): FactoryError => {
    const baseError = error instanceof Error ? error : new Error(String(error));
    
    const factoryError = Object.create(Error.prototype) as FactoryError;
    factoryError.name = 'FactoryError';
    factoryError.message = baseError.message;
    factoryError.code = 'QUERY_ERROR';
    factoryError.context = context || `${operation} operation on ${tableName}`;
    factoryError.originalError = baseError;
    factoryError.metadata = {
      operation,
      tableName,
      timestamp: new Date().toISOString()
    };
    factoryError.stack = baseError.stack;
    
    return factoryError;
  };

  /**
   * Generates query keys for consistent caching.
   */
  const generateQueryKey = (operation: QueryOperation, filters?: QueryFilters): QueryKey => {
    if (queryKeyGenerator) {
      return queryKeyGenerator(operation, filters);
    }

    const baseKey = [tableName, operation];
    
    if (filters && Object.keys(filters).length > 0) {
      baseKey.push(JSON.stringify(filters));
    }
    
    return baseKey;
  };

  /**
   * Builds Supabase query with filters and options.
   */
  const buildQuery = (filters: QueryFilters = {}, selectFields = select, businessId?: string) => {
    let query = supabase.from(tableName as any).select(selectFields);

    // Apply business filter for business entities
    if (businessId && tableName !== 'businesses') {
      query = query.eq('business_id', businessId);
    }

    // Apply default filters
    Object.entries(defaultFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    // Apply custom filters
    if (filters.where) {
      Object.entries(filters.where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (typeof value === 'string' && value.includes('%')) {
            query = query.like(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });
    }

    // Apply search filter
    if (filters.search && filters.searchFields) {
      const searchConditions = filters.searchFields.map(field => 
        `${field}.ilike.%${filters.search}%`
      ).join(',');
      query = query.or(searchConditions);
    }

    // Apply ordering
    if (filters.orderBy) {
      const { field, direction = 'asc' } = filters.orderBy;
      query = query.order(field, { ascending: direction === 'asc' });
    } else {
      // Default ordering by created_at desc
      query = query.order('created_at', { ascending: false });
    }

    return query;
  };

  /**
   * Sets up real-time subscription for a query.
   */
  const setupRealtimeSubscription = (
    queryKey: QueryKey,
    onEvent?: (event: RealtimeEvent) => void
  ) => {
    if (!realTimeSubscription) return;

    const channel = supabase
      .channel(`${tableName}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName
        },
        (payload) => {
          const event: RealtimeEvent = {
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new,
            old: payload.old,
            table: tableName,
            timestamp: new Date().toISOString()
          };

          if (onEvent) {
            onEvent(event);
          }

          // Invalidate queries on real-time events
          // This will be handled by the query client in the component
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  /**
   * Get multiple entities with optional filtering.
   * Returns a React Query result for entity lists.
   */
  const useEntities = (hookOptions: QueryHookOptions<T[]> = {}): UseQueryResult<T[], FactoryError> => {
    const { business } = useAuth();
    const { filters = {}, select: selectFields, realTime, enabled = true, ...queryOptions } = hookOptions;
    const queryKey = generateQueryKey('list', filters);

    return useQuery<T[], FactoryError>({
      queryKey,
      queryFn: async () => {
        try {
          if (!business?.id) return [];
          const query = buildQuery(filters, selectFields, business?.id);
          const { data, error } = await query;

          if (error) throw error;
          return (data as unknown as T[]) || [];
        } catch (error) {
          throw createFactoryError(error, 'list', `Fetching ${tableName} list`);
        }
      },
      gcTime: cacheTime,
      staleTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      enabled: !!business?.id && enabled,
      ...queryOptions
    });
  };

  /**
   * Get a single entity by ID.
   * Returns a React Query result for a single entity.
   */
  const useEntity = (id: string, hookOptions: QueryHookOptions<T> = {}): UseQueryResult<T, FactoryError> => {
    const { business } = useAuth();
    const { filters = {}, select: selectFields, realTime, enabled = true, ...queryOptions } = hookOptions;
    const queryKey = generateQueryKey('single', { ...filters, id });

    return useQuery<T, FactoryError>({
      queryKey,
      queryFn: async () => {
        try {
          if (!business?.id) throw new Error(`Business ID is required to fetch ${tableName}`);
          const query = buildQuery(filters, selectFields, business?.id).eq('id', id).single();
          const { data, error } = await query;

          if (error) throw error;
          if (!data) throw new Error(`${tableName} with id ${id} not found`);
          
          return data as unknown as T;
        } catch (error) {
          throw createFactoryError(error, 'single', `Fetching ${tableName} with id ${id}`);
        }
      },
      gcTime: cacheTime,
      staleTime,
      enabled: !!id && !!business?.id && enabled,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      ...queryOptions
    });
  };

  /**
   * Get entities with infinite scrolling/pagination.
   * Returns a React Query infinite result for paginated data.
   */
  const useEntitiesInfinite = (
    hookOptions: InfiniteQueryHookOptions<PaginatedResult<T>> = {}
  ): UseInfiniteQueryResult<InfiniteData<PaginatedResult<T>>, FactoryError> => {
    const { business } = useAuth();
    const { 
      filters = {}, 
      pageSize = defaultPageSize, 
      select: selectFields,
      enabled = true,
      ...queryOptions 
    } = hookOptions;
    const queryKey = generateQueryKey('infinite', { ...filters, pageSize });

    return useInfiniteQuery<PaginatedResult<T>, FactoryError>({
      queryKey,
      queryFn: async ({ pageParam = 0 }) => {
        try {
          if (!business?.id) {
            return {
              data: [],
              pagination: {
                page: 0,
                pageSize,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrevious: false
              }
            };
          }
          
          const page = pageParam as number;
          const offset = page * pageSize;
          const query = buildQuery(filters, selectFields, business?.id)
            .range(offset, offset + pageSize - 1);

          const { data, error, count } = await query;

          if (error) throw error;

          const items = (data as unknown as T[]) || [];
          const totalCount = count || 0;
          const totalPages = Math.ceil(totalCount / pageSize);
          const hasNext = page < totalPages - 1;
          const hasPrevious = page > 0;

          return {
            data: items,
            pagination: {
              page,
              pageSize,
              total: totalCount,
              totalPages,
              hasNext,
              hasPrevious
            }
          };
        } catch (error) {
          throw createFactoryError(error, 'infinite', `Fetching paginated ${tableName}`);
        }
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage) => 
        lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
      gcTime: cacheTime,
      staleTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      enabled: !!business?.id && enabled,
      ...queryOptions
    });
  };

  /**
   * Get count of entities matching filters.
   * Returns a React Query result for entity count.
   */
  const useEntitiesCount = (hookOptions: QueryHookOptions<number> = {}): UseQueryResult<number, FactoryError> => {
    const { business } = useAuth();
    const { filters = {}, select: selectFields, realTime, enabled = true, ...queryOptions } = hookOptions;
    const queryKey = generateQueryKey('count', filters);

    return useQuery<number, FactoryError>({
      queryKey,
      queryFn: async () => {
        try {
          if (!business?.id) return 0;
          
          // For count queries, we need to start with select
          let countQuery = supabase.from(tableName as any).select('*', { count: 'exact' });
          
          // Apply business filter
          if (business?.id && tableName !== 'businesses') {
            countQuery = countQuery.eq('business_id', business.id);
          }

          // Apply default filters
          Object.entries(defaultFilters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              countQuery = countQuery.eq(key, value);
            }
          });

          // Apply custom filters
          if (filters.where) {
            Object.entries(filters.where).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                  countQuery = countQuery.in(key, value);
                } else if (typeof value === 'string' && value.includes('%')) {
                  countQuery = countQuery.like(key, value);
                } else {
                  countQuery = countQuery.eq(key, value);
                }
              }
            });
          }

          const { count, error } = await countQuery;

          if (error) throw error;
          return count || 0;
        } catch (error) {
          throw createFactoryError(error, 'count', `Counting ${tableName}`);
        }
      },
      gcTime: cacheTime,
      staleTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      enabled: !!business?.id && enabled,
      ...queryOptions
    });
  };

  /**
   * Get the table name for this factory.
   */
  const getTableName = () => tableName;

  /**
   * Get the factory configuration.
   */
  const getConfig = () => options;

  /**
   * Generate query key for manual cache operations.
   */
  const getQueryKey = (operation: QueryOperation, filters?: QueryFilters) => 
    generateQueryKey(operation, filters);

  return {
    useEntities,
    useEntity,
    useEntitiesInfinite,
    useEntitiesCount,
    getTableName,
    getConfig,
    getQueryKey
  };
}