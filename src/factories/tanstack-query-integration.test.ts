/**
 * TanStack Query Integration Property Tests
 * 
 * Property-based tests to validate that generated query hooks integrate seamlessly
 * with TanStack Query caching and invalidation mechanisms.
 * 
 * **Property 10: TanStack Query Integration**
 * **Validates: Requirements 2.6**
 * 
 * @fileoverview TanStack Query integration property tests
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fc from 'fast-check';
import React from 'react';
import { createQueryFactory } from './createQueryFactory';
import { BaseEntity, QueryFilters } from './types/core';
import { QueryFactoryOptions } from './types/query';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn()
      }))
    })),
    removeChannel: vi.fn()
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    business: { id: 'test-business-id' }
  }))
}));

// Import the mocked supabase
import { supabase } from '@/integrations/supabase/client';

// Test entity interface
interface TestEntity extends BaseEntity {
  name: string;
  email?: string;
  status?: string;
  category?: string;
}

// Test wrapper component with query client
const createWrapper = (queryClient?: QueryClient) => {
  const client = queryClient || new QueryClient({
    defaultOptions: {
      queries: { 
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        gcTime: 5 * 60 * 1000, // 5 minutes
        staleTime: 1 * 60 * 1000 // 1 minute
      },
      mutations: { retry: false }
    }
  });
  
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client }, children);
  };
};

// Mock data generators
const createMockEntity = (id: string, overrides: Partial<TestEntity> = {}): TestEntity => ({
  id,
  name: `Entity ${id}`,
  email: `entity${id}@example.com`,
  status: 'active',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides
});

const createMockEntities = (count: number): TestEntity[] => 
  Array.from({ length: count }, (_, i) => createMockEntity(`entity-${i + 1}`));

// Setup successful mock responses
const setupSuccessfulMocks = (entities: TestEntity[], entity?: TestEntity) => {
  const mockQuery = {
    select: vi.fn(() => mockQuery),
    eq: vi.fn(() => mockQuery),
    single: vi.fn(() => Promise.resolve({ 
      data: entity || entities[0] || createMockEntity('default'), 
      error: null 
    })),
    range: vi.fn(() => Promise.resolve({ 
      data: entities, 
      error: null, 
      count: entities.length 
    })),
    order: vi.fn(() => mockQuery),
    in: vi.fn(() => mockQuery),
    like: vi.fn(() => mockQuery),
    or: vi.fn(() => mockQuery)
  };

  (supabase.from as any).mockReturnValue(mockQuery);
  return mockQuery;
};

// Custom arbitraries for TanStack Query integration testing
const Arbitraries = {
  tableName: (): fc.Arbitrary<string> =>
    fc.constantFrom('customers', 'products', 'leads', 'sales', 'orders'),

  cacheTime: (): fc.Arbitrary<number> =>
    fc.integer({ min: 1000, max: 600000 }), // 1 second to 10 minutes

  staleTime: (): fc.Arbitrary<number> =>
    fc.integer({ min: 0, max: 300000 }), // 0 to 5 minutes

  pageSize: (): fc.Arbitrary<number> =>
    fc.integer({ min: 5, max: 50 }),

  queryFilters: (): fc.Arbitrary<QueryFilters> =>
    fc.record({
      where: fc.option(fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean()
        )
      )),
      search: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
      orderBy: fc.option(fc.record({
        field: fc.string({ minLength: 1, maxLength: 20 }),
        direction: fc.constantFrom('asc', 'desc')
      }))
    }),

  queryFactoryOptions: (): fc.Arbitrary<QueryFactoryOptions> =>
    fc.record({
      tableName: Arbitraries.tableName(),
      defaultFilters: fc.option(Arbitraries.queryFilters()),
      realTimeSubscription: fc.option(fc.boolean()),
      cacheTime: fc.option(Arbitraries.cacheTime()),
      staleTime: fc.option(Arbitraries.staleTime()),
      defaultPageSize: fc.option(Arbitraries.pageSize()),
      select: fc.option(fc.constant('*'))
    }),

  entityId: (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.constant('test-id'),
      fc.constant('entity-1'),
      fc.constant('customer-123')
    ),

  entityCount: (): fc.Arbitrary<number> =>
    fc.integer({ min: 1, max: 10 })
};

/**
 * Property-Based Tests for TanStack Query Integration
 * **Property 10: TanStack Query Integration**
 * **Validates: Requirements 2.6**
 */
describe('TanStack Query Integration Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 10: TanStack Query Integration', () => {
    it('should generate consistent query keys for proper cache management', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            Arbitraries.tableName(),
            Arbitraries.queryFilters(),
            Arbitraries.entityId()
          ),
          async ([tableName, filters, entityId]) => {
            const factory1 = createQueryFactory<TestEntity>({ tableName });
            const factory2 = createQueryFactory<TestEntity>({ tableName });

            // Property: Same operations should generate identical query keys
            const listKey1 = factory1.getQueryKey('list', filters);
            const listKey2 = factory2.getQueryKey('list', filters);

            const singleKey1 = factory1.getQueryKey('single', { ...filters, id: entityId });
            const singleKey2 = factory2.getQueryKey('single', { ...filters, id: entityId });

            const infiniteKey1 = factory1.getQueryKey('infinite', filters);
            const infiniteKey2 = factory2.getQueryKey('infinite', filters);

            const countKey1 = factory1.getQueryKey('count', filters);
            const countKey2 = factory2.getQueryKey('count', filters);

            // Property: Query keys should be deterministic and consistent
            const keysAreConsistent = 
              JSON.stringify(listKey1) === JSON.stringify(listKey2) &&
              JSON.stringify(singleKey1) === JSON.stringify(singleKey2) &&
              JSON.stringify(infiniteKey1) === JSON.stringify(infiniteKey2) &&
              JSON.stringify(countKey1) === JSON.stringify(countKey2);

            // Property: Query keys should include table name for proper namespacing
            const keysIncludeTableName = 
              JSON.stringify(listKey1).includes(tableName) &&
              JSON.stringify(singleKey1).includes(tableName) &&
              JSON.stringify(infiniteKey1).includes(tableName) &&
              JSON.stringify(countKey1).includes(tableName);

            // Property: Query keys should differentiate between operations
            const keysAreDifferent = 
              JSON.stringify(listKey1) !== JSON.stringify(singleKey1) &&
              JSON.stringify(listKey1) !== JSON.stringify(infiniteKey1) &&
              JSON.stringify(listKey1) !== JSON.stringify(countKey1);

            return keysAreConsistent && keysIncludeTableName && keysAreDifferent;
          }
        ),
        { numRuns: 30, timeout: 5000 }
      );
    });

    it('should integrate properly with TanStack Query caching system', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            Arbitraries.tableName(),
            Arbitraries.entityCount(),
            Arbitraries.entityId()
          ),
          async ([tableName, entityCount, entityId]) => {
            const mockEntities = createMockEntities(entityCount);
            const mockEntity = createMockEntity(entityId);
            setupSuccessfulMocks(mockEntities, mockEntity);

            const queryClient = new QueryClient({
              defaultOptions: {
                queries: { 
                  retry: false,
                  refetchOnWindowFocus: false,
                  refetchOnReconnect: false,
                  gcTime: 5 * 60 * 1000,
                  staleTime: 1 * 60 * 1000
                }
              }
            });

            const factory = createQueryFactory<TestEntity>({ tableName });

            // Property: Query client should properly manage cache keys
            const listQueryKey = factory.getQueryKey('list');
            const singleQueryKey = factory.getQueryKey('single', { id: entityId });
            
            // Property: Cache keys should be consistent with factory configuration
            const cacheKeysConsistent = 
              JSON.stringify(listQueryKey).includes(tableName) &&
              JSON.stringify(singleQueryKey).includes(tableName);

            // Property: Query client should accept the generated keys
            queryClient.setQueryData(listQueryKey, mockEntities);
            queryClient.setQueryData(singleQueryKey, mockEntity);

            const cachedListData = queryClient.getQueryData(listQueryKey);
            const cachedSingleData = queryClient.getQueryData(singleQueryKey);

            const dataIsCached = cachedListData !== undefined && cachedSingleData !== undefined;

            return cacheKeysConsistent && dataIsCached;
          }
        ),
        { numRuns: 20, timeout: 5000 }
      );
    });

    it('should respect stale time and cache time configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            Arbitraries.tableName(),
            Arbitraries.staleTime(),
            Arbitraries.cacheTime()
          ),
          async ([tableName, staleTime, cacheTime]) => {
            const mockEntities = createMockEntities(3);
            setupSuccessfulMocks(mockEntities);

            const queryClient = new QueryClient({
              defaultOptions: {
                queries: { 
                  retry: false,
                  refetchOnWindowFocus: false,
                  refetchOnReconnect: false,
                  gcTime: cacheTime,
                  staleTime: staleTime
                }
              }
            });

            const factory = createQueryFactory<TestEntity>({
              tableName,
              staleTime,
              cacheTime
            });

            // Property: Factory should store the configuration correctly
            const config = factory.getConfig();
            const configRespected = 
              config.staleTime === staleTime &&
              config.cacheTime === cacheTime &&
              config.tableName === tableName;

            // Property: Query keys should be generated consistently
            const queryKey = factory.getQueryKey('list');
            const keyIsValid = Array.isArray(queryKey) && queryKey.length > 0;

            return configRespected && keyIsValid;
          }
        ),
        { numRuns: 25, timeout: 5000 }
      );
    });

    it('should handle cache invalidation patterns consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          Arbitraries.tableName(),
          async (tableName) => {
            const mockEntities = createMockEntities(5);
            setupSuccessfulMocks(mockEntities);

            const queryClient = new QueryClient({
              defaultOptions: {
                queries: { 
                  retry: false,
                  refetchOnWindowFocus: false,
                  refetchOnReconnect: false
                }
              }
            });

            const factory = createQueryFactory<TestEntity>({ tableName });

            // Property: All query operations should generate keys that can be invalidated together
            const listKey = factory.getQueryKey('list');
            const singleKey = factory.getQueryKey('single', { id: 'test-id' });
            const infiniteKey = factory.getQueryKey('infinite');
            const countKey = factory.getQueryKey('count');

            // Set some data in cache
            queryClient.setQueryData(listKey, mockEntities);
            queryClient.setQueryData(singleKey, mockEntities[0]);
            queryClient.setQueryData(infiniteKey, { pages: [{ data: mockEntities }] });
            queryClient.setQueryData(countKey, mockEntities.length);

            // Property: All keys should be invalidatable by table name
            const allKeysHaveTableName = [listKey, singleKey, infiniteKey, countKey].every(key => 
              JSON.stringify(key).includes(tableName)
            );

            // Property: Cache invalidation should work with the generated keys
            await queryClient.invalidateQueries({
              queryKey: [tableName]
            });

            // Property: Query states should exist after invalidation
            const listState = queryClient.getQueryState(listKey);
            const singleState = queryClient.getQueryState(singleKey);
            const infiniteState = queryClient.getQueryState(infiniteKey);
            const countState = queryClient.getQueryState(countKey);

            const statesExist = listState !== undefined && singleState !== undefined && 
                              infiniteState !== undefined && countState !== undefined;

            return allKeysHaveTableName && statesExist;
          }
        ),
        { numRuns: 20, timeout: 5000 }
      );
    });

    it('should support query deduplication through consistent key generation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            Arbitraries.tableName(),
            Arbitraries.queryFilters()
          ),
          async ([tableName, filters]) => {
            const factory = createQueryFactory<TestEntity>({ tableName });

            // Property: Multiple calls with same parameters should generate identical keys
            const key1 = factory.getQueryKey('list', filters);
            const key2 = factory.getQueryKey('list', filters);
            const key3 = factory.getQueryKey('list', filters);

            const keysAreIdentical = 
              JSON.stringify(key1) === JSON.stringify(key2) &&
              JSON.stringify(key2) === JSON.stringify(key3);

            // Property: Different filters should generate different keys
            const differentFilters = { ...filters, where: { ...filters.where, different: true } };
            const differentKey = factory.getQueryKey('list', differentFilters);
            
            const differentFiltersGenerateDifferentKeys = 
              JSON.stringify(key1) !== JSON.stringify(differentKey);

            return keysAreIdentical && differentFiltersGenerateDifferentKeys;
          }
        ),
        { numRuns: 25, timeout: 5000 }
      );
    });

    it('should integrate with TanStack Query optimistic updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            Arbitraries.tableName(),
            Arbitraries.entityId()
          ),
          async ([tableName, entityId]) => {
            const mockEntity = createMockEntity(entityId);
            const mockEntities = [mockEntity];
            setupSuccessfulMocks(mockEntities, mockEntity);

            const queryClient = new QueryClient({
              defaultOptions: {
                queries: { 
                  retry: false,
                  refetchOnWindowFocus: false,
                  refetchOnReconnect: false
                }
              }
            });

            const factory = createQueryFactory<TestEntity>({ tableName });

            // Property: Should be able to perform optimistic updates on cached data
            const listQueryKey = factory.getQueryKey('list');
            const singleQueryKey = factory.getQueryKey('single', { id: entityId });

            // Simulate optimistic update
            const optimisticEntity = { ...mockEntity, name: 'Optimistic Update' };
            const optimisticEntities = [optimisticEntity];

            queryClient.setQueryData(listQueryKey, optimisticEntities);
            queryClient.setQueryData(singleQueryKey, optimisticEntity);

            // Property: Cache should support optimistic updates
            const cachedListData = queryClient.getQueryData(listQueryKey) as TestEntity[];
            const cachedSingleData = queryClient.getQueryData(singleQueryKey) as TestEntity;

            const cacheSupportsOptimisticUpdates = 
              cachedListData?.[0]?.name === 'Optimistic Update' &&
              cachedSingleData?.name === 'Optimistic Update';

            // Property: Query keys should remain consistent after optimistic updates
            const keysRemainConsistent = 
              JSON.stringify(factory.getQueryKey('list')) === JSON.stringify(listQueryKey) &&
              JSON.stringify(factory.getQueryKey('single', { id: entityId })) === JSON.stringify(singleQueryKey);

            return cacheSupportsOptimisticUpdates && keysRemainConsistent;
          }
        ),
        { numRuns: 20, timeout: 5000 }
      );
    });

    it('should maintain cache consistency across different query operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            Arbitraries.tableName(),
            Arbitraries.entityId(),
            Arbitraries.pageSize()
          ),
          async ([tableName, entityId, pageSize]) => {
            // Skip test cases with problematic inputs
            if (!tableName || tableName.trim().length === 0 || 
                !entityId || entityId.trim().length === 0 || 
                pageSize < 1) {
              return true;
            }

            const mockEntity = createMockEntity(entityId);
            const mockEntities = createMockEntities(Math.min(pageSize, 10));
            setupSuccessfulMocks(mockEntities, mockEntity);

            const queryClient = new QueryClient({
              defaultOptions: {
                queries: { 
                  retry: false,
                  refetchOnWindowFocus: false,
                  refetchOnReconnect: false
                }
              }
            });

            const factory = createQueryFactory<TestEntity>({ 
              tableName,
              defaultPageSize: pageSize
            });

            // Property: All query operations should generate valid cache keys
            const listKey = factory.getQueryKey('list');
            const singleKey = factory.getQueryKey('single', { id: entityId });
            const infiniteKey = factory.getQueryKey('infinite');
            const countKey = factory.getQueryKey('count');

            const allKeysValid = [listKey, singleKey, infiniteKey, countKey].every(key => 
              Array.isArray(key) && key.length > 0 && key[0] === tableName
            );

            // Property: Cache operations should work with all generated keys
            queryClient.setQueryData(listKey, mockEntities);
            queryClient.setQueryData(singleKey, mockEntity);
            queryClient.setQueryData(infiniteKey, { pages: [{ data: mockEntities }] });
            queryClient.setQueryData(countKey, mockEntities.length);

            const allDataCached = 
              queryClient.getQueryData(listKey) !== undefined &&
              queryClient.getQueryData(singleKey) !== undefined &&
              queryClient.getQueryData(infiniteKey) !== undefined &&
              queryClient.getQueryData(countKey) !== undefined;

            return allKeysValid && allDataCached;
          }
        ),
        { numRuns: 15, timeout: 5000 }
      );
    });

    it('should provide proper TanStack Query hook interfaces', async () => {
      await fc.assert(
        fc.asyncProperty(
          Arbitraries.queryFactoryOptions(),
          async (options) => {
            const mockEntities = createMockEntities(3);
            setupSuccessfulMocks(mockEntities);

            const factory = createQueryFactory<TestEntity>(options);
            const wrapper = createWrapper();

            // Property: All generated hooks should have TanStack Query interface
            const entitiesHook = renderHook(() => factory.useEntities(), { wrapper });
            const entityHook = renderHook(() => factory.useEntity('test-id'), { wrapper });
            const infiniteHook = renderHook(() => factory.useEntitiesInfinite(), { wrapper });
            const countHook = renderHook(() => factory.useEntitiesCount(), { wrapper });

            // Property: All hooks should have standard TanStack Query properties
            const standardProperties = ['data', 'isLoading', 'error', 'refetch', 'isError', 'isSuccess'];
            
            const entitiesHasStandardProps = standardProperties.every(prop => 
              entitiesHook.result.current.hasOwnProperty(prop)
            );
            
            const entityHasStandardProps = standardProperties.every(prop => 
              entityHook.result.current.hasOwnProperty(prop)
            );
            
            const countHasStandardProps = standardProperties.every(prop => 
              countHook.result.current.hasOwnProperty(prop)
            );

            // Property: Infinite hook should have additional pagination properties
            const infiniteProperties = ['data', 'isLoading', 'error', 'fetchNextPage', 'hasNextPage'];
            const infiniteHasProps = infiniteProperties.every(prop => 
              infiniteHook.result.current.hasOwnProperty(prop)
            );

            return entitiesHasStandardProps && entityHasStandardProps && countHasStandardProps && infiniteHasProps;
          }
        ),
        { numRuns: 20, timeout: 5000 }
      );
    });
  });
});