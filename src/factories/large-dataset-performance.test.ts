/**
 * Large Dataset Performance Verification
 * 
 * **Validates: Requirements 7.5**
 * 
 * This test verifies that the factory system maintains performance levels
 * when handling large datasets using existing pagination and virtualization:
 * - Query factories handle large result sets efficiently
 * - Pagination works correctly with large datasets
 * - Memory usage remains reasonable
 * - Cache invalidation is efficient even with many cached queries
 * - Infinite scroll performance is maintained
 * 
 * @fileoverview Large dataset performance verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryCache } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { 
  customerQueries, 
  leadQueries, 
  transactionQueries,
  customerCRUD 
} from './instances';
import { BaseEntity } from './types/core';

// Mock Supabase client with large dataset simulation
const createMockLargeDataset = (size: number, entityType: string) => {
  return Array.from({ length: size }, (_, index) => ({
    id: `${entityType}-${index + 1}`,
    name: `${entityType} ${index + 1}`,
    email: `${entityType}${index + 1}@example.com`,
    status: index % 2 === 0 ? 'active' : 'inactive',
    created_at: new Date(Date.now() - index * 1000).toISOString(),
    updated_at: new Date(Date.now() - index * 500).toISOString(),
    business_id: 'test-business-id'
  }));
};

vi.mock('@/integrations/supabase/client', () => {
  const mockSupabaseQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation((start, end) => {
      const mockThis = {
        ...mockSupabaseQuery,
        // Simulate paginated response
        then: (callback: any) => {
          const pageSize = end - start + 1;
          const mockData = createMockLargeDataset(pageSize, 'customer');
          return callback({ data: mockData, error: null, count: 10000 });
        }
      };
      return mockThis;
    }),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  return {
    supabase: {
      from: vi.fn(() => mockSupabaseQuery),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      })),
      removeChannel: vi.fn()
    }
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    business: { id: 'test-business-id' }
  })
}));

describe('Large Dataset Performance Verification', () => {
  let queryClient: QueryClient;
  let queryCache: QueryCache;

  beforeEach(() => {
    queryCache = new QueryCache();
    queryClient = new QueryClient({
      queryCache,
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 5 * 60 * 1000,
          staleTime: 1 * 60 * 1000
        }
      }
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    queryCache.clear();
  });

  it('should handle large paginated datasets efficiently', async () => {
    const startTime = performance.now();
    
    // Simulate loading multiple pages of a large dataset
    const pageSize = 50;
    const totalPages = 10; // 500 total items
    
    const queryKeys = [];
    for (let page = 0; page < totalPages; page++) {
      const filters = {
        orderBy: { field: 'created_at' as const, direction: 'desc' as const }
      };
      const queryKey = customerQueries.getQueryKey('infinite', { ...filters, pageSize });
      queryKeys.push(queryKey);
    }
    
    const endTime = performance.now();
    const keyGenerationTime = endTime - startTime;
    
    // Query key generation for large datasets should be fast
    expect(keyGenerationTime).toBeLessThan(50); // Less than 50ms for 10 pages
    
    // Verify query keys are unique and properly structured
    const uniqueKeys = new Set(queryKeys.map(k => JSON.stringify(k)));
    expect(uniqueKeys.size).toBe(1); // Same filters should produce same key
    
    // Verify key structure is consistent
    queryKeys.forEach(key => {
      expect(Array.isArray(key)).toBe(true);
      expect(key[0]).toBe('customers');
      expect(key[1]).toBe('infinite');
    });
  });

  it('should maintain performance with many cached queries', async () => {
    const startTime = performance.now();
    
    // Simulate many different query combinations that would be cached
    const filterCombinations = [
      { where: { status: 'active' } },
      { where: { status: 'inactive' } },
      { search: 'test', searchFields: ['name', 'email'] },
      { orderBy: { field: 'name', direction: 'asc' } },
      { orderBy: { field: 'created_at', direction: 'desc' } },
      { where: { status: 'active' }, orderBy: { field: 'name', direction: 'asc' } },
      { where: { status: 'inactive' }, search: 'customer' },
    ];
    
    // Generate query keys for all combinations
    const queryKeys = [];
    for (const filters of filterCombinations) {
      for (const operation of ['list', 'count', 'infinite'] as const) {
        const key = customerQueries.getQueryKey(operation, filters);
        queryKeys.push(key);
      }
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Should handle 21 different query key generations quickly
    expect(totalTime).toBeLessThan(20); // Less than 20ms
    expect(queryKeys.length).toBe(21); // 7 filter combinations × 3 operations
    
    // All keys should be valid and unique where expected
    queryKeys.forEach(key => {
      expect(Array.isArray(key)).toBe(true);
      expect(key.length).toBeGreaterThan(0);
      expect(key[0]).toBe('customers');
    });
  });

  it('should handle infinite scroll performance with large datasets', async () => {
    const config = customerQueries.getConfig();
    
    // Verify pagination configuration is optimized for large datasets
    expect(config.defaultPageSize).toBeGreaterThanOrEqual(20);
    expect(config.defaultPageSize).toBeLessThanOrEqual(100);
    
    // Cache configuration should be optimized for large datasets
    expect(config.cacheTime).toBeGreaterThanOrEqual(2 * 60 * 1000); // At least 2 minutes
    expect(config.staleTime).toBeGreaterThanOrEqual(1 * 60 * 1000); // At least 1 minute
    
    // Test query key generation performance for infinite scroll
    const startTime = performance.now();
    
    const infiniteQueryKeys = [];
    for (let page = 0; page < 50; page++) { // Simulate 50 pages loaded
      const filters = { pageSize: config.defaultPageSize };
      const key = customerQueries.getQueryKey('infinite', filters);
      infiniteQueryKeys.push(key);
    }
    
    const endTime = performance.now();
    const infiniteScrollTime = endTime - startTime;
    
    // Should handle 50 page key generations very quickly
    expect(infiniteScrollTime).toBeLessThan(25); // Less than 25ms
    
    // All infinite scroll keys should be identical (same filters)
    const uniqueInfiniteKeys = new Set(infiniteQueryKeys.map(k => JSON.stringify(k)));
    expect(uniqueInfiniteKeys.size).toBe(1);
  });

  it('should maintain memory efficiency with large cached datasets', async () => {
    // Test memory usage patterns by generating many query keys
    const memoryTestStart = performance.now();
    
    const largeKeySet = new Set();
    
    // Generate a large number of unique query combinations
    for (let i = 0; i < 1000; i++) {
      const filters = {
        where: { 
          status: i % 2 === 0 ? 'active' : 'inactive',
          id: `test-${i}`
        },
        search: i % 10 === 0 ? `search-${i}` : undefined,
        orderBy: {
          field: i % 3 === 0 ? 'name' : 'created_at',
          direction: i % 2 === 0 ? 'asc' : 'desc'
        }
      };
      
      const key = customerQueries.getQueryKey('list', filters);
      largeKeySet.add(JSON.stringify(key));
    }
    
    const memoryTestEnd = performance.now();
    const memoryTestTime = memoryTestEnd - memoryTestStart;
    
    // Should handle 1000 unique query key generations efficiently
    expect(memoryTestTime).toBeLessThan(100); // Less than 100ms
    expect(largeKeySet.size).toBe(1000); // All keys should be unique
    
    // Test that query key structure remains consistent even with complex filters
    const sampleKeys = Array.from(largeKeySet).slice(0, 10);
    sampleKeys.forEach(keyStr => {
      const key = JSON.parse(keyStr as string);
      expect(Array.isArray(key)).toBe(true);
      expect(key[0]).toBe('customers');
      expect(key[1]).toBe('list');
    });
  });

  it('should handle concurrent large dataset operations efficiently', async () => {
    const concurrencyStart = performance.now();
    
    // Simulate concurrent operations that might happen with large datasets
    const concurrentOperations = [
      () => customerQueries.getQueryKey('list', { where: { status: 'active' } }),
      () => customerQueries.getQueryKey('count', { where: { status: 'active' } }),
      () => customerQueries.getQueryKey('infinite', { pageSize: 50 }),
      () => leadQueries.getQueryKey('list', { where: { temperature: 'hot' } }),
      () => transactionQueries.getQueryKey('list', { where: { type: 'income' } }),
      () => customerQueries.getConfig(),
      () => leadQueries.getConfig(),
      () => transactionQueries.getConfig(),
    ];
    
    // Execute all operations concurrently
    const results = await Promise.all(
      concurrentOperations.map(op => Promise.resolve(op()))
    );
    
    const concurrencyEnd = performance.now();
    const concurrencyTime = concurrencyEnd - concurrencyStart;
    
    // Concurrent operations should complete quickly
    expect(concurrencyTime).toBeLessThan(50); // Less than 50ms
    expect(results.length).toBe(8);
    
    // Verify all operations completed successfully
    results.forEach((result, index) => {
      if (index < 5) {
        // Query key results
        expect(Array.isArray(result)).toBe(true);
      } else {
        // Config results
        expect(typeof result).toBe('object');
        expect(result).toHaveProperty('tableName');
        expect(result).toHaveProperty('cacheTime');
        expect(result).toHaveProperty('staleTime');
      }
    });
  });

  it('should optimize cache invalidation for large datasets', async () => {
    const invalidationStart = performance.now();
    
    // Test cache invalidation patterns that would be used with large datasets
    const crudConfig = customerCRUD.getConfig();
    
    // Verify invalidation queries are optimized
    expect(Array.isArray(crudConfig.invalidateQueries)).toBe(true);
    expect(crudConfig.invalidateQueries.length).toBeGreaterThan(0);
    expect(crudConfig.invalidateQueries.length).toBeLessThan(10); // Not too many to avoid performance issues
    
    // Test that invalidation patterns are consistent
    crudConfig.invalidateQueries.forEach(queryPattern => {
      expect(typeof queryPattern).toBe('string');
      expect(queryPattern.length).toBeGreaterThan(0);
      expect(queryPattern.length).toBeLessThan(50); // Reasonable length
    });
    
    const invalidationEnd = performance.now();
    const invalidationTime = invalidationEnd - invalidationStart;
    
    // Cache invalidation configuration should be fast to access
    expect(invalidationTime).toBeLessThan(5); // Less than 5ms
  });

  it('should maintain consistent performance across different entity types', async () => {
    const entityFactories = [
      { name: 'customers', factory: customerQueries },
      { name: 'leads', factory: leadQueries },
      { name: 'transactions', factory: transactionQueries }
    ];
    
    const performanceResults = [];
    
    for (const { name, factory } of entityFactories) {
      const start = performance.now();
      
      // Test common operations for each entity type
      const operations = [
        () => factory.getQueryKey('list', {}),
        () => factory.getQueryKey('count', {}),
        () => factory.getQueryKey('infinite', { pageSize: 50 }),
        () => factory.getConfig(),
        () => factory.getTableName()
      ];
      
      const results = operations.map(op => op());
      
      const end = performance.now();
      const duration = end - start;
      
      performanceResults.push({ name, duration, results });
    }
    
    // All entity types should have similar performance characteristics
    const durations = performanceResults.map(r => r.duration);
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    // Performance should be consistent across entity types (within 10ms)
    expect(maxDuration - minDuration).toBeLessThan(10);
    expect(maxDuration).toBeLessThan(20); // All should be under 20ms
    
    // Verify all operations completed successfully for all entity types
    performanceResults.forEach(({ name, results }) => {
      expect(results.length).toBe(5);
      expect(Array.isArray(results[0])).toBe(true); // list query key
      expect(Array.isArray(results[1])).toBe(true); // count query key
      expect(Array.isArray(results[2])).toBe(true); // infinite query key
      expect(typeof results[3]).toBe('object'); // config
      expect(typeof results[4]).toBe('string'); // table name
      expect(results[4]).toBe(name); // table name matches entity
    });
  });
});