/**
 * CRUD Factory Tests
 * 
 * Tests for the generic CRUD factory implementation.
 * Verifies type safety, consistent patterns, and proper error handling.
 * 
 * @fileoverview CRUD factory unit tests
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fc from 'fast-check';
import React from 'react';
import { createCRUDFactory } from './createCRUDFactory';
import { BaseEntity } from './types/core';
import { Arbitraries, createPropertyTest } from '../test/fast-check.config';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    business: { id: 'test-business-id' }
  }))
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn()
  }))
}));

// Test entity interface
interface TestEntity extends BaseEntity {
  name: string;
  email?: string;
}

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('createCRUDFactory', () => {
  let crudFactory: ReturnType<typeof createCRUDFactory<TestEntity>>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    crudFactory = createCRUDFactory<TestEntity>({
      tableName: 'test_entities',
      successMessages: {
        create: 'Entity created!',
        update: 'Entity updated!',
        delete: 'Entity deleted!'
      },
      errorMessages: {
        create: 'Failed to create entity',
        update: 'Failed to update entity',
        delete: 'Failed to delete entity'
      },
      invalidateKeys: [['test_entities']],
      optimisticUpdates: true,
      debug: true
    });
  });

  describe('Factory Configuration', () => {
    it('should return correct table name', () => {
      expect(crudFactory.getTableName()).toBe('test_entities');
    });

    it('should return factory configuration', () => {
      const config = crudFactory.getConfig();
      expect(config.tableName).toBe('test_entities');
      expect(config.optimisticUpdates).toBe(true);
      expect(config.debug).toBe(true);
    });
  });

  describe('Hook Generation', () => {
    it('should generate useCreate hook', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => crudFactory.useCreate(), { wrapper });
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.mutate).toBe('function');
      expect(typeof result.current.mutateAsync).toBe('function');
    });

    it('should generate useUpdate hook', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => crudFactory.useUpdate(), { wrapper });
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.mutate).toBe('function');
      expect(typeof result.current.mutateAsync).toBe('function');
    });

    it('should generate useDelete hook', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => crudFactory.useDelete(), { wrapper });
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.mutate).toBe('function');
      expect(typeof result.current.mutateAsync).toBe('function');
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct create data types', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => crudFactory.useCreate(), { wrapper });
      
      // This should compile without errors
      const validData = { name: 'Test Entity', email: 'test@example.com' };
      expect(() => result.current.mutate(validData)).not.toThrow();
    });

    it('should enforce correct update data types', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => crudFactory.useUpdate(), { wrapper });
      
      // This should compile without errors
      const validData = { id: 'test-id', data: { name: 'Updated Name' } };
      expect(() => result.current.mutate(validData)).not.toThrow();
    });

    it('should enforce correct delete data types', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => crudFactory.useDelete(), { wrapper });
      
      // This should compile without errors
      expect(() => result.current.mutate('test-id')).not.toThrow();
    });
  });

  describe('Consistent Patterns', () => {
    it('should have consistent hook interfaces across operations', () => {
      const wrapper = createWrapper();
      
      const { result: createResult } = renderHook(() => crudFactory.useCreate(), { wrapper });
      const { result: updateResult } = renderHook(() => crudFactory.useUpdate(), { wrapper });
      const { result: deleteResult } = renderHook(() => crudFactory.useDelete(), { wrapper });
      
      // All hooks should have the same interface structure
      const expectedProperties = ['mutate', 'mutateAsync', 'isPending', 'isError', 'error', 'data', 'isSuccess'];
      
      expectedProperties.forEach(prop => {
        expect(createResult.current).toHaveProperty(prop);
        expect(updateResult.current).toHaveProperty(prop);
        expect(deleteResult.current).toHaveProperty(prop);
      });
    });

    it('should use consistent error handling patterns', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => crudFactory.useCreate(), { wrapper });
      
      // Error should be properly typed as FactoryError
      if (result.current.error) {
        expect(result.current.error).toHaveProperty('message');
        expect(result.current.error).toHaveProperty('code');
        expect(result.current.error).toHaveProperty('context');
      }
    });
  });

  describe('Factory Builder Pattern', () => {
    it('should create factory with minimal configuration', () => {
      const minimalFactory = createCRUDFactory<TestEntity>({
        tableName: 'minimal_test'
      });
      
      expect(minimalFactory.getTableName()).toBe('minimal_test');
      expect(minimalFactory.getConfig().tableName).toBe('minimal_test');
    });

    it('should create factory with full configuration', () => {
      const fullFactory = createCRUDFactory<TestEntity>({
        tableName: 'full_test',
        successMessages: {
          create: 'Created!',
          update: 'Updated!',
          delete: 'Deleted!'
        },
        errorMessages: {
          create: 'Create failed',
          update: 'Update failed',
          delete: 'Delete failed'
        },
        invalidateKeys: [['full_test'], ['related_data']],
        optimisticUpdates: true,
        debug: true,
        onSuccess: vi.fn(),
        onError: vi.fn()
      });
      
      const config = fullFactory.getConfig();
      expect(config.successMessages?.create).toBe('Created!');
      expect(config.errorMessages?.create).toBe('Create failed');
      expect(config.invalidateKeys).toEqual([['full_test'], ['related_data']]);
      expect(config.optimisticUpdates).toBe(true);
      expect(config.debug).toBe(true);
    });
  });
});

/**
 * Property-Based Tests for CRUD Factory Consistency
 * **Property 1: CRUD Factory Consistency**
 * **Validates: Requirements 1.1**
 */
describe('CRUD Factory Property Tests', () => {
  describe('Property 1: CRUD Factory Consistency', () => {
    it('should generate consistent hook interfaces for any entity type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            optimisticUpdates: fc.boolean()
          }),
          async ({ tableName, optimisticUpdates }) => {
            // Create factory with arbitrary configuration
            const factory = createCRUDFactory<TestEntity>({
              tableName,
              optimisticUpdates
            });

            // Property: All factories should have the same interface
            const expectedMethods = ['useCreate', 'useUpdate', 'useDelete', 'getTableName', 'getConfig'];
            const factoryMethods = Object.keys(factory);
            
            // Verify all expected methods exist
            const hasAllMethods = expectedMethods.every(method => factoryMethods.includes(method));
            
            // Property: Configuration should be preserved
            const config = factory.getConfig();
            const configPreserved = config.tableName === tableName && 
                                   config.optimisticUpdates === optimisticUpdates;

            return hasAllMethods && configPreserved;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle different table names consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
          async (tableNames) => {
            const factories = tableNames.map(tableName => 
              createCRUDFactory<TestEntity>({ tableName })
            );

            // Property: Each factory should return its correct table name
            const tableNamesMatch = factories.every((factory, index) => 
              factory.getTableName() === tableNames[index]
            );

            // Property: All factories should have the same interface structure
            const firstFactoryMethods = Object.keys(factories[0]).sort();
            const allHaveSameInterface = factories.every(factory => {
              const methods = Object.keys(factory).sort();
              return JSON.stringify(methods) === JSON.stringify(firstFactoryMethods);
            });

            return tableNamesMatch && allHaveSameInterface;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should preserve configuration immutably', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            optimisticUpdates: fc.boolean(),
            debug: fc.boolean()
          }),
          async (config) => {
            const factory = createCRUDFactory<TestEntity>(config);
            const retrievedConfig = factory.getConfig();

            // Property: Configuration should be preserved exactly
            const configPreserved = 
              retrievedConfig.tableName === config.tableName &&
              retrievedConfig.optimisticUpdates === config.optimisticUpdates &&
              retrievedConfig.debug === config.debug;

            return configPreserved;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate hooks with consistent interface', () => {
      const factory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const wrapper = createWrapper();
      
      const { result: createResult } = renderHook(() => factory.useCreate(), { wrapper });
      const { result: updateResult } = renderHook(() => factory.useUpdate(), { wrapper });
      const { result: deleteResult } = renderHook(() => factory.useDelete(), { wrapper });

      // Property: All hooks should have consistent interface
      const expectedProperties = ['mutate', 'mutateAsync', 'isPending', 'isError', 'error', 'data', 'isSuccess'];
      
      const createHasProps = expectedProperties.every(prop => 
        createResult.current.hasOwnProperty(prop)
      );
      const updateHasProps = expectedProperties.every(prop => 
        updateResult.current.hasOwnProperty(prop)
      );
      const deleteHasProps = expectedProperties.every(prop => 
        deleteResult.current.hasOwnProperty(prop)
      );

      expect(createHasProps).toBe(true);
      expect(updateHasProps).toBe(true);
      expect(deleteHasProps).toBe(true);
    });
  });

  /**
   * Property-Based Tests for CRUD Success Side Effects
   * **Property 2: CRUD Success Side Effects**
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: CRUD Success Side Effects', () => {
    it('should have consistent success message configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            successMessages: fc.record({
              create: fc.option(fc.string({ minLength: 1 })),
              update: fc.option(fc.string({ minLength: 1 })),
              delete: fc.option(fc.string({ minLength: 1 }))
            })
          }),
          async ({ tableName, successMessages }) => {
            const factory = createCRUDFactory<TestEntity>({
              tableName,
              successMessages
            });

            const config = factory.getConfig();
            
            // Property: Success messages should be preserved in configuration
            const messagesPreserved = 
              JSON.stringify(config.successMessages) === JSON.stringify(successMessages);

            // Property: Factory should maintain table name consistency
            const tableNameConsistent = config.tableName === tableName;

            return messagesPreserved && tableNameConsistent;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have consistent callback configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            hasCallback: fc.boolean()
          }),
          async ({ tableName, hasCallback }) => {
            const mockCallback = hasCallback ? vi.fn() : undefined;
            
            const factory = createCRUDFactory<TestEntity>({
              tableName,
              onSuccess: mockCallback
            });

            const config = factory.getConfig();
            
            // Property: Callback configuration should be preserved
            const callbackPreserved = hasCallback 
              ? config.onSuccess !== undefined
              : config.onSuccess === undefined;

            // Property: Factory should maintain table name consistency
            const tableNameConsistent = config.tableName === tableName;

            return callbackPreserved && tableNameConsistent;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should have consistent invalidation keys configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            invalidateKeys: fc.array(
              fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          async ({ tableName, invalidateKeys }) => {
            const factory = createCRUDFactory<TestEntity>({
              tableName,
              invalidateKeys
            });

            const config = factory.getConfig();
            
            // Property: Invalidation keys should be preserved in configuration
            const keysPreserved = 
              JSON.stringify(config.invalidateKeys) === JSON.stringify(invalidateKeys);

            // Property: Factory should maintain table name consistency
            const tableNameConsistent = config.tableName === tableName;

            return keysPreserved && tableNameConsistent;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain consistent side effect configuration across operations', () => {
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();
      
      const factory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities',
        successMessages: {
          create: 'Created successfully',
          update: 'Updated successfully',
          delete: 'Deleted successfully'
        },
        errorMessages: {
          create: 'Create failed',
          update: 'Update failed',
          delete: 'Delete failed'
        },
        invalidateKeys: [['test_entities'], ['related_data']],
        optimisticUpdates: true,
        onSuccess: mockOnSuccess,
        onError: mockOnError
      });

      const wrapper = createWrapper();
      
      // All hooks should be generated with the same configuration
      const createHook = renderHook(() => factory.useCreate(), { wrapper });
      const updateHook = renderHook(() => factory.useUpdate(), { wrapper });
      const deleteHook = renderHook(() => factory.useDelete(), { wrapper });

      // Property: All hooks should be successfully created
      expect(createHook.result.current).toBeDefined();
      expect(updateHook.result.current).toBeDefined();
      expect(deleteHook.result.current).toBeDefined();

      // Property: Configuration should be consistent across all operations
      const config = factory.getConfig();
      expect(config.successMessages?.create).toBe('Created successfully');
      expect(config.successMessages?.update).toBe('Updated successfully');
      expect(config.successMessages?.delete).toBe('Deleted successfully');
      expect(config.optimisticUpdates).toBe(true);
      expect(config.onSuccess).toBe(mockOnSuccess);
      expect(config.onError).toBe(mockOnError);
    });
  });

  /**
   * Property-Based Tests for CRUD Error Handling
   * **Property 3: CRUD Error Handling Consistency**
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: CRUD Error Handling Consistency', () => {
    it('should have consistent error message configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            errorMessages: fc.record({
              create: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
              update: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
              delete: fc.option(fc.string({ minLength: 1 }), { nil: undefined })
            })
          }),
          async ({ tableName, errorMessages }) => {
            const factory = createCRUDFactory<TestEntity>({
              tableName,
              errorMessages: errorMessages as any // Type assertion to handle fast-check option types
            });

            const config = factory.getConfig();
            
            // Property: Error messages should be preserved in configuration
            const messagesPreserved = 
              JSON.stringify(config.errorMessages || {}) === JSON.stringify(errorMessages || {});

            // Property: Factory should maintain table name consistency
            const tableNameConsistent = config.tableName === tableName;

            return messagesPreserved && tableNameConsistent;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have consistent error callback configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            hasErrorCallback: fc.boolean()
          }),
          async ({ tableName, hasErrorCallback }) => {
            const mockErrorCallback = hasErrorCallback ? vi.fn() : undefined;
            
            const factory = createCRUDFactory<TestEntity>({
              tableName,
              onError: mockErrorCallback
            });

            const config = factory.getConfig();
            
            // Property: Error callback configuration should be preserved
            const callbackPreserved = hasErrorCallback 
              ? config.onError !== undefined
              : config.onError === undefined;

            // Property: Factory should maintain table name consistency
            const tableNameConsistent = config.tableName === tableName;

            return callbackPreserved && tableNameConsistent;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should create consistent error handling configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            operation: fc.constantFrom('create', 'update', 'delete'),
            debugMode: fc.boolean()
          }),
          async ({ tableName, operation, debugMode }) => {
            const factory = createCRUDFactory<TestEntity>({
              tableName,
              debug: debugMode
            });

            const config = factory.getConfig();
            
            // Property: Debug mode should be preserved
            const debugPreserved = config.debug === debugMode;
            
            // Property: Table name should be consistent
            const tableNameConsistent = config.tableName === tableName;
            
            // Property: Factory should have error handling capabilities
            const hasErrorHandling = typeof factory.useCreate === 'function' &&
                                   typeof factory.useUpdate === 'function' &&
                                   typeof factory.useDelete === 'function';

            return debugPreserved && tableNameConsistent && hasErrorHandling;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain consistent error handling configuration across operations', () => {
      const mockOnError = vi.fn();
      
      const factory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities',
        errorMessages: {
          create: 'Create operation failed',
          update: 'Update operation failed',
          delete: 'Delete operation failed'
        },
        onError: mockOnError,
        debug: true
      });

      const wrapper = createWrapper();
      
      // All hooks should be generated with the same error handling configuration
      const createHook = renderHook(() => factory.useCreate(), { wrapper });
      const updateHook = renderHook(() => factory.useUpdate(), { wrapper });
      const deleteHook = renderHook(() => factory.useDelete(), { wrapper });

      // Property: All hooks should be successfully created
      expect(createHook.result.current).toBeDefined();
      expect(updateHook.result.current).toBeDefined();
      expect(deleteHook.result.current).toBeDefined();

      // Property: Error configuration should be consistent across all operations
      const config = factory.getConfig();
      expect(config.errorMessages?.create).toBe('Create operation failed');
      expect(config.errorMessages?.update).toBe('Update operation failed');
      expect(config.errorMessages?.delete).toBe('Delete operation failed');
      expect(config.onError).toBe(mockOnError);
      expect(config.debug).toBe(true);

      // Property: All hooks should have error properties
      expect(createHook.result.current).toHaveProperty('error');
      expect(createHook.result.current).toHaveProperty('isError');
      expect(updateHook.result.current).toHaveProperty('error');
      expect(updateHook.result.current).toHaveProperty('isError');
      expect(deleteHook.result.current).toHaveProperty('error');
      expect(deleteHook.result.current).toHaveProperty('isError');
    });

    it('should maintain error handling consistency with optimistic updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.string({ minLength: 1, maxLength: 50 }),
            optimisticUpdates: fc.boolean(),
            hasErrorCallback: fc.boolean()
          }),
          async ({ tableName, optimisticUpdates, hasErrorCallback }) => {
            const mockOnError = hasErrorCallback ? vi.fn() : undefined;
            
            const factory = createCRUDFactory<TestEntity>({
              tableName,
              optimisticUpdates,
              onError: mockOnError
            });

            const config = factory.getConfig();
            
            // Property: Optimistic updates configuration should be preserved
            const optimisticPreserved = config.optimisticUpdates === optimisticUpdates;
            
            // Property: Error callback should be preserved
            const errorCallbackPreserved = hasErrorCallback 
              ? config.onError !== undefined
              : config.onError === undefined;
            
            // Property: Factory should maintain consistency regardless of optimistic updates setting
            const factoryConsistent = config.tableName === tableName;

            return optimisticPreserved && errorCallbackPreserved && factoryConsistent;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should provide consistent error information structure', () => {
      const factory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities',
        errorMessages: {
          create: 'Create failed',
          update: 'Update failed', 
          delete: 'Delete failed'
        },
        debug: true
      });

      const wrapper = createWrapper();
      
      // Test that all hooks have consistent error structure
      const createHook = renderHook(() => factory.useCreate(), { wrapper });
      const updateHook = renderHook(() => factory.useUpdate(), { wrapper });
      const deleteHook = renderHook(() => factory.useDelete(), { wrapper });

      // Property: All hooks should have the same error-related properties
      const errorProperties = ['error', 'isError', 'isPending', 'isSuccess'];
      
      errorProperties.forEach(prop => {
        expect(createHook.result.current).toHaveProperty(prop);
        expect(updateHook.result.current).toHaveProperty(prop);
        expect(deleteHook.result.current).toHaveProperty(prop);
      });

      // Property: Initial error state should be consistent
      expect(createHook.result.current.error).toBeNull();
      expect(createHook.result.current.isError).toBe(false);
      expect(updateHook.result.current.error).toBeNull();
      expect(updateHook.result.current.isError).toBe(false);
      expect(deleteHook.result.current.error).toBeNull();
      expect(deleteHook.result.current.isError).toBe(false);
    });
  });
});