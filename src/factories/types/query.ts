/**
 * Query Factory Types
 * 
 * Type definitions for the generic query hook factory system that generates
 * standardized data fetching hooks for any Supabase table.
 * 
 * @fileoverview Query factory type definitions
 * @version 1.0.0
 */

import { 
  UseQueryResult, 
  UseInfiniteQueryResult, 
  QueryKey,
  UseQueryOptions,
  UseInfiniteQueryOptions,
  InfiniteData
} from '@tanstack/react-query';
import { 
  BaseEntity, 
  BaseFactoryOptions, 
  QueryFilters, 
  PaginatedResult,
  FactoryError
} from './core';

/**
 * Query operation types that the factory can perform.
 */
export type QueryOperation = 'list' | 'single' | 'infinite' | 'count';

/**
 * Configuration options for query factory creation.
 * Extends base factory options with query-specific settings.
 */
export interface QueryFactoryOptions extends BaseFactoryOptions {
  /** Supabase table name for the entity */
  tableName: string;
  
  /** Default filters to apply to all queries */
  defaultFilters?: QueryFilters;
  
  /** Enable real-time subscriptions */
  realTimeSubscription?: boolean;
  
  /** Custom cache time in milliseconds */
  cacheTime?: number;
  
  /** Stale time in milliseconds */
  staleTime?: number;
  
  /** Default page size for paginated queries */
  defaultPageSize?: number;
  
  /** Fields to select (default: all fields) */
  select?: string;
  
  /** Related tables to join */
  joins?: string[];
  
  /** Custom query key generator */
  queryKeyGenerator?: (operation: QueryOperation, filters?: QueryFilters) => QueryKey;
}

/**
 * Query hook options that can be passed to individual query hooks.
 * Extends TanStack Query options with factory-specific options.
 */
export interface QueryHookOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn' | 'select'> {
  /** Additional filters to apply */
  filters?: QueryFilters;
  
  /** Override default select fields */
  select?: string;
  
  /** Enable/disable real-time subscription for this query */
  realTime?: boolean;
}

/**
 * Infinite query hook options for paginated data.
 */
export interface InfiniteQueryHookOptions<T> extends Omit<UseInfiniteQueryOptions<T>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'select'> {
  /** Additional filters to apply */
  filters?: QueryFilters;
  
  /** Page size for pagination */
  pageSize?: number;
  
  /** Override default select fields */
  select?: string;
}

/**
 * Query factory interface that defines the query operations available.
 * Generic over the entity type for full type safety.
 */
export interface QueryFactory<T extends BaseEntity> {
  /**
   * Get multiple entities with optional filtering.
   * Returns a React Query result for entity lists.
   */
  useEntities: (options?: QueryHookOptions<T[]>) => UseQueryResult<T[], FactoryError>;
  
  /**
   * Get a single entity by ID.
   * Returns a React Query result for a single entity.
   */
  useEntity: (id: string, options?: QueryHookOptions<T>) => UseQueryResult<T, FactoryError>;
  
  /**
   * Get entities with infinite scrolling/pagination.
   * Returns a React Query infinite result for paginated data.
   */
  useEntitiesInfinite: (
    options?: InfiniteQueryHookOptions<PaginatedResult<T>>
  ) => UseInfiniteQueryResult<InfiniteData<PaginatedResult<T>>, FactoryError>;
  
  /**
   * Get count of entities matching filters.
   * Returns a React Query result for entity count.
   */
  useEntitiesCount: (options?: QueryHookOptions<number>) => UseQueryResult<number, FactoryError>;
  
  /**
   * Get the table name for this factory.
   * Useful for debugging and query key generation.
   */
  getTableName: () => string;
  
  /**
   * Get the factory configuration.
   * Useful for introspection and debugging.
   */
  getConfig: () => QueryFactoryOptions;
  
  /**
   * Generate query key for manual cache operations.
   * Useful for manual cache invalidation or prefetching.
   */
  getQueryKey: (operation: QueryOperation, filters?: QueryFilters) => QueryKey;
}

/**
 * Query hooks interface.
 * Provides a structured way to access all query operations for an entity.
 */
export interface QueryHooks<T extends BaseEntity> {
  entities: UseQueryResult<T[], FactoryError>;
  entity: (id: string) => UseQueryResult<T, FactoryError>;
  entitiesInfinite: UseInfiniteQueryResult<PaginatedResult<T>, FactoryError>;
  entitiesCount: UseQueryResult<number, FactoryError>;
}

/**
 * Query factory function type.
 * Defines the signature for creating query factories.
 */
export type CreateQueryFactory = <T extends BaseEntity>(
  options: QueryFactoryOptions
) => QueryFactory<T>;

/**
 * Real-time subscription configuration.
 * Defines how real-time updates should be handled.
 */
export interface RealtimeConfig {
  /** Enable real-time subscriptions */
  enabled: boolean;
  
  /** Events to listen for */
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[];
  
  /** Filter for real-time events */
  filter?: string;
  
  /** Callback for real-time events */
  onEvent?: (event: RealtimeEvent) => void;
}

/**
 * Real-time event interface.
 * Represents a real-time database event.
 */
export interface RealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
  table: string;
  timestamp: string;
}

/**
 * Query cache configuration.
 * Defines how query results should be cached.
 */
export interface QueryCacheConfig {
  /** Cache time in milliseconds */
  cacheTime?: number;
  
  /** Stale time in milliseconds */
  staleTime?: number;
  
  /** Background refetch interval */
  refetchInterval?: number;
  
  /** Refetch on window focus */
  refetchOnWindowFocus?: boolean;
  
  /** Refetch on reconnect */
  refetchOnReconnect?: boolean;
}

/**
 * Query factory builder interface.
 * Provides a fluent API for configuring query factories.
 */
export interface QueryFactoryBuilder<T extends BaseEntity> {
  /** Set the table name */
  table(name: string): QueryFactoryBuilder<T>;
  
  /** Configure default filters */
  defaultFilters(filters: QueryFilters): QueryFactoryBuilder<T>;
  
  /** Enable real-time subscriptions */
  withRealtime(config?: RealtimeConfig): QueryFactoryBuilder<T>;
  
  /** Configure caching */
  withCaching(config: QueryCacheConfig): QueryFactoryBuilder<T>;
  
  /** Set default page size */
  pageSize(size: number): QueryFactoryBuilder<T>;
  
  /** Configure field selection */
  select(fields: string): QueryFactoryBuilder<T>;
  
  /** Add table joins */
  joins(tables: string[]): QueryFactoryBuilder<T>;
  
  /** Build the query factory */
  build(): QueryFactory<T>;
}

/**
 * Query factory registry interface.
 * Manages multiple query factories for different entities.
 */
export interface QueryFactoryRegistry {
  /** Register a query factory for an entity */
  register<T extends BaseEntity>(entityName: string, factory: QueryFactory<T>): void;
  
  /** Get a query factory for an entity */
  get<T extends BaseEntity>(entityName: string): QueryFactory<T> | undefined;
  
  /** Check if a factory is registered */
  has(entityName: string): boolean;
  
  /** Get all registered entity names */
  getEntityNames(): string[];
  
  /** Clear all registered factories */
  clear(): void;
}

/**
 * Query performance metrics interface.
 * Tracks query performance for optimization.
 */
export interface QueryMetrics {
  /** Query execution time in milliseconds */
  executionTime: number;
  
  /** Cache hit/miss status */
  cacheStatus: 'hit' | 'miss' | 'stale';
  
  /** Number of results returned */
  resultCount: number;
  
  /** Query complexity score */
  complexity: number;
  
  /** Timestamp of query execution */
  timestamp: string;
}