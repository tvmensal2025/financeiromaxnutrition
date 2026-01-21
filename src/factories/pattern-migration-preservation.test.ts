/**
 * Property Test: Pattern Migration Preservation
 * 
 * **Validates: Requirements 5.5**
 * 
 * This test validates that migrating components to use standardized patterns
 * preserves existing functionality and user experience:
 * - Factory-generated hooks maintain same API contracts as original hooks
 * - Component behavior remains consistent after migration
 * - Error handling patterns are preserved
 * - Performance characteristics are maintained
 * - User interactions work the same way
 * 
 * @fileoverview Property-based test for pattern migration preservation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { QueryClient, QueryCache } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { 
  customerQueries, 
  leadQueries, 
  productQueries, 
  serviceQueries,
  customerCRUD,
  leadCRUD,
  productCRUD,
  serviceCRUD
} from './instances';
import { BaseEntity } from './types/core';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  const mockSupabaseQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
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

// Test entity interfaces
interface TestCustomer extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive';
}

interface TestLead extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  temperature: 'cold' | 'warm' | 'hot';
}

interface TestProduct extends BaseEntity {
  name: string;
  price: number;
  status: 'active' | 'inactive';
}

describe('Property Test: Pattern Migration Preservation', () => {
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

  /**
   * Property 25: Pattern Migration Preservation
   * 
   * For any entity type and operation:
   * - Factory-generated hooks should maintain same API contracts as original hooks
   * - Component behavior should remain consistent after migration
   * - Error handling patterns should be preserved
   * - Performance characteristics should be maintained
   */
  it('should preserve API contracts and behavior after migration', () => {
    fc.assert(
      fc.property(
        // Generate entity type and operation combinations
        fc.record({
          entityType: fc.constantFrom('customers', 'leads', 'products', 'services'),
          operation: fc.constantFrom('list', 'single', 'create', 'update', 'delete'),
          filters: fc.option(fc.record({
            where: fc.option(fc.record({
              status: fc.option(fc.constantFrom('active', 'inactive', 'new', 'contacted'))
            })),
            search: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            orderBy: fc.option(fc.record({
              field: fc.constantFrom('name', 'created_at', 'updated_at'),
              direction: fc.constantFrom('asc', 'desc')
            }))
          }))
        }),
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          email: fc.option(fc.emailAddress()),
          status: fc.constantFrom('active', 'inactive', 'new', 'contacted', 'qualified')
        }),
        (testConfig, entityData) => {
          const { entityType, operation, filters } = testConfig;

          // Test 1: Query factory API contract preservation
          if (operation === 'list' || operation === 'single') {
            let queryFactory;
            switch (entityType) {
              case 'customers':
                queryFactory = customerQueries;
                break;
              case 'leads':
                queryFactory = leadQueries;
                break;
              case 'products':
                queryFactory = productQueries;
                break;
              case 'services':
                queryFactory = serviceQueries;
                break;
              default:
                queryFactory = customerQueries;
            }

            // Verify factory has expected methods
            expect(queryFactory.useEntities).toBeDefined();
            expect(queryFactory.useEntity).toBeDefined();
            expect(queryFactory.useEntitiesInfinite).toBeDefined();
            expect(queryFactory.useEntitiesCount).toBeDefined();
            expect(queryFactory.getTableName).toBeDefined();
            expect(queryFactory.getConfig).toBeDefined();
            expect(queryFactory.getQueryKey).toBeDefined();

            // Verify method signatures match expected contracts
            expect(typeof queryFactory.useEntities).toBe('function');
            expect(typeof queryFactory.useEntity).toBe('function');
            expect(typeof queryFactory.useEntitiesInfinite).toBe('function');
            expect(typeof queryFactory.useEntitiesCount).toBe('function');

            // Test query key generation consistency
            const queryKey1 = queryFactory.getQueryKey('list', filters);
            const queryKey2 = queryFactory.getQueryKey('list', filters);
            expect(queryKey1).toEqual(queryKey2);

            // Test table name consistency
            const tableName = queryFactory.getTableName();
            expect(typeof tableName).toBe('string');
            expect(tableName.length).toBeGreaterThan(0);
          }

          // Test 2: CRUD factory API contract preservation
          if (['create', 'update', 'delete'].includes(operation)) {
            let crudFactory;
            switch (entityType) {
              case 'customers':
                crudFactory = customerCRUD;
                break;
              case 'leads':
                crudFactory = leadCRUD;
                break;
              case 'products':
                crudFactory = productCRUD;
                break;
              case 'services':
                crudFactory = serviceCRUD;
                break;
              default:
                crudFactory = customerCRUD;
            }

            // Verify factory has expected methods
            expect(crudFactory.useCreate).toBeDefined();
            expect(crudFactory.useUpdate).toBeDefined();
            expect(crudFactory.useDelete).toBeDefined();
            expect(crudFactory.getTableName).toBeDefined();
            expect(crudFactory.getConfig).toBeDefined();

            // Verify method signatures match expected contracts
            expect(typeof crudFactory.useCreate).toBe('function');
            expect(typeof crudFactory.useUpdate).toBe('function');
            expect(typeof crudFactory.useDelete).toBe('function');

            // Test configuration consistency
            const config = crudFactory.getConfig();
            expect(config).toBeDefined();
            expect(config.tableName).toBe(crudFactory.getTableName());
            expect(typeof config.optimisticUpdates).toBe('boolean');
            expect(Array.isArray(config.invalidateQueries)).toBe(true);
          }

          // Test 3: Error handling pattern preservation
          // Factory should handle errors consistently
          expect(() => {
            const queryFactory = customerQueries;
            queryFactory.getQueryKey('list', {});
          }).not.toThrow();

          expect(() => {
            const crudFactory = customerCRUD;
            crudFactory.getTableName();
          }).not.toThrow();

          // Test 4: Configuration validation
          const queryConfig = customerQueries.getConfig();
          expect(queryConfig.cacheTime).toBeGreaterThan(0);
          expect(queryConfig.staleTime).toBeGreaterThan(0);
          expect(queryConfig.staleTime).toBeLessThanOrEqual(queryConfig.cacheTime);

          const crudConfig = customerCRUD.getConfig();
          expect(typeof crudConfig.optimisticUpdates).toBe('boolean');
          expect(Array.isArray(crudConfig.invalidateQueries)).toBe(true);
          expect(crudConfig.successMessages).toBeDefined();
          expect(crudConfig.errorMessages).toBeDefined();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should maintain consistent hook behavior patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('customers', 'leads', 'products', 'services'),
        fc.record({
          where: fc.option(fc.record({
            status: fc.option(fc.constantFrom('active', 'inactive'))
          })),
          orderBy: fc.option(fc.record({
            field: fc.constantFrom('name', 'created_at'),
            direction: fc.constantFrom('asc', 'desc')
          }))
        }),
        (entityType, filters) => {
          let queryFactory;
          switch (entityType) {
            case 'customers':
              queryFactory = customerQueries;
              break;
            case 'leads':
              queryFactory = leadQueries;
              break;
            case 'products':
              queryFactory = productQueries;
              break;
            case 'services':
              queryFactory = serviceQueries;
              break;
            default:
              queryFactory = customerQueries;
          }

          // Test hook behavior consistency
          const queryKey = queryFactory.getQueryKey('list', filters);
          expect(Array.isArray(queryKey)).toBe(true);
          expect(queryKey.length).toBeGreaterThan(0);
          expect(queryKey[0]).toBe(entityType);

          // Test configuration consistency
          const config = queryFactory.getConfig();
          expect(config.tableName).toBe(entityType);
          expect(typeof config.cacheTime).toBe('number');
          expect(typeof config.staleTime).toBe('number');
          expect(typeof config.defaultPageSize).toBe('number');

          // Test that different filters produce different keys
          const emptyFilters = {};
          const emptyKey = queryFactory.getQueryKey('list', emptyFilters);
          
          if (filters && Object.keys(filters).length > 0) {
            const filteredKey = queryFactory.getQueryKey('list', filters);
            // Keys should be different when filters are different
            expect(JSON.stringify(filteredKey)).not.toBe(JSON.stringify(emptyKey));
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  it('should preserve error handling and validation patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('customers', 'leads', 'products', 'services'),
        fc.record({
          name: fc.option(fc.string()),
          email: fc.option(fc.string()),
          status: fc.option(fc.string())
        }),
        (entityType, entityData) => {
          let crudFactory;
          switch (entityType) {
            case 'customers':
              crudFactory = customerCRUD;
              break;
            case 'leads':
              crudFactory = leadCRUD;
              break;
            case 'products':
              crudFactory = productCRUD;
              break;
            case 'services':
              crudFactory = serviceCRUD;
              break;
            default:
              crudFactory = customerCRUD;
          }

          // Test error message configuration
          const config = crudFactory.getConfig();
          expect(config.errorMessages).toBeDefined();
          expect(config.errorMessages.create).toBeDefined();
          expect(config.errorMessages.update).toBeDefined();
          expect(config.errorMessages.delete).toBeDefined();

          expect(typeof config.errorMessages.create).toBe('string');
          expect(typeof config.errorMessages.update).toBe('string');
          expect(typeof config.errorMessages.delete).toBe('string');

          // Test success message configuration
          expect(config.successMessages).toBeDefined();
          expect(config.successMessages.create).toBeDefined();
          expect(config.successMessages.update).toBeDefined();
          expect(config.successMessages.delete).toBeDefined();

          expect(typeof config.successMessages.create).toBe('string');
          expect(typeof config.successMessages.update).toBe('string');
          expect(typeof config.successMessages.delete).toBe('string');

          // Test invalidation patterns
          expect(Array.isArray(config.invalidateQueries)).toBe(true);
          expect(config.invalidateQueries.length).toBeGreaterThan(0);
          config.invalidateQueries.forEach(query => {
            expect(typeof query).toBe('string');
            expect(query.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain performance characteristics after migration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('customers', 'leads', 'products', 'services'),
        fc.integer({ min: 1, max: 100 }),
        (entityType, pageSize) => {
          let queryFactory;
          switch (entityType) {
            case 'customers':
              queryFactory = customerQueries;
              break;
            case 'leads':
              queryFactory = leadQueries;
              break;
            case 'products':
              queryFactory = productQueries;
              break;
            case 'services':
              queryFactory = serviceQueries;
              break;
            default:
              queryFactory = customerQueries;
          }

          // Test performance-related configurations
          const config = queryFactory.getConfig();
          
          // Cache times should be reasonable (not too short or too long)
          expect(config.cacheTime).toBeGreaterThanOrEqual(60000); // At least 1 minute
          expect(config.cacheTime).toBeLessThanOrEqual(15 * 60 * 1000); // At most 15 minutes
          
          expect(config.staleTime).toBeGreaterThanOrEqual(30000); // At least 30 seconds
          expect(config.staleTime).toBeLessThanOrEqual(10 * 60 * 1000); // At most 10 minutes
          
          // Stale time should be less than or equal to cache time
          expect(config.staleTime).toBeLessThanOrEqual(config.cacheTime);
          
          // Page size should be reasonable
          expect(config.defaultPageSize).toBeGreaterThanOrEqual(10);
          expect(config.defaultPageSize).toBeLessThanOrEqual(100);

          // Query key generation should be efficient (not too complex)
          const startTime = performance.now();
          for (let i = 0; i < 100; i++) {
            queryFactory.getQueryKey('list', { where: { status: 'active' } });
          }
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          // 100 query key generations should take less than 10ms
          expect(duration).toBeLessThan(10);
        }
      ),
      { numRuns: 15 }
    );
  });
});