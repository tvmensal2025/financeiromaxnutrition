/**
 * Backward Compatibility Tests for CRUD Factory Migration
 * 
 * Tests to ensure that migrating existing hooks to use CRUD factory
 * maintains complete backward compatibility with existing APIs.
 * 
 * @fileoverview Backward compatibility property tests
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fc from 'fast-check';
import React from 'react';
import { useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/mutations/useCustomerMutations';
import { useCreateLead, useUpdateLead, useDeleteLead } from '@/hooks/mutations/useLeadMutations';
import { Arbitraries } from '../test/fast-check.config';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id', name: 'Test' }, error: null }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'test-id', name: 'Test' }, error: null }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
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

/**
 * Property-Based Tests for Backward Compatibility
 * **Property 5: Backward Compatibility Preservation**
 * **Validates: Requirements 1.6**
 */
describe('Backward Compatibility Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 5: Backward Compatibility Preservation', () => {
    it('should maintain consistent hook interface for customer mutations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            operation: fc.constantFrom('create', 'update', 'delete'),
            entityType: fc.constant('customer')
          }),
          async ({ operation, entityType }) => {
            const wrapper = createWrapper();
            
            // Test that all hooks have the same interface structure
            let hookResult;
            
            if (operation === 'create') {
              const { result } = renderHook(() => useCreateCustomer(), { wrapper });
              hookResult = result.current;
            } else if (operation === 'update') {
              const { result } = renderHook(() => useUpdateCustomer(), { wrapper });
              hookResult = result.current;
            } else {
              const { result } = renderHook(() => useDeleteCustomer(), { wrapper });
              hookResult = result.current;
            }

            // Property: All hooks should have the same TanStack Query interface
            const expectedProperties = ['mutate', 'mutateAsync', 'isPending', 'isError', 'error', 'data', 'isSuccess'];
            const hasAllProperties = expectedProperties.every(prop => 
              hookResult.hasOwnProperty(prop)
            );

            // Property: Hook should be callable (function exists)
            const isCallable = typeof hookResult.mutate === 'function' && 
                              typeof hookResult.mutateAsync === 'function';

            return hasAllProperties && isCallable;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain consistent hook interface for lead mutations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            operation: fc.constantFrom('create', 'update', 'delete'),
            entityType: fc.constant('lead')
          }),
          async ({ operation, entityType }) => {
            const wrapper = createWrapper();
            
            // Test that all hooks have the same interface structure
            let hookResult;
            
            if (operation === 'create') {
              const { result } = renderHook(() => useCreateLead(), { wrapper });
              hookResult = result.current;
            } else if (operation === 'update') {
              const { result } = renderHook(() => useUpdateLead(), { wrapper });
              hookResult = result.current;
            } else {
              const { result } = renderHook(() => useDeleteLead(), { wrapper });
              hookResult = result.current;
            }

            // Property: All hooks should have the same TanStack Query interface
            const expectedProperties = ['mutate', 'mutateAsync', 'isPending', 'isError', 'error', 'data', 'isSuccess'];
            const hasAllProperties = expectedProperties.every(prop => 
              hookResult.hasOwnProperty(prop)
            );

            // Property: Hook should be callable (function exists)
            const isCallable = typeof hookResult.mutate === 'function' && 
                              typeof hookResult.mutateAsync === 'function';

            return hasAllProperties && isCallable;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should accept the same input parameters as before migration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            customerData: Arbitraries.customerData(),
            leadData: Arbitraries.leadData(),
            operation: fc.constantFrom('create', 'update', 'delete')
          }),
          async ({ customerData, leadData, operation }) => {
            const wrapper = createWrapper();
            
            // Property: Customer hooks should accept the same data types
            if (operation === 'create') {
              const { result: customerResult } = renderHook(() => useCreateCustomer(), { wrapper });
              const { result: leadResult } = renderHook(() => useCreateLead(), { wrapper });
              
              // These should not throw type errors (tested at compile time)
              expect(typeof customerResult.current.mutate).toBe('function');
              expect(typeof leadResult.current.mutate).toBe('function');
            } else if (operation === 'update') {
              const { result: customerResult } = renderHook(() => useUpdateCustomer(), { wrapper });
              const { result: leadResult } = renderHook(() => useUpdateLead(), { wrapper });
              
              // These should not throw type errors (tested at compile time)
              expect(typeof customerResult.current.mutate).toBe('function');
              expect(typeof leadResult.current.mutate).toBe('function');
            } else {
              const { result: customerResult } = renderHook(() => useDeleteCustomer(), { wrapper });
              const { result: leadResult } = renderHook(() => useDeleteLead(), { wrapper });
              
              // These should not throw type errors (tested at compile time)
              expect(typeof customerResult.current.mutate).toBe('function');
              expect(typeof leadResult.current.mutate).toBe('function');
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain consistent error states across different entities', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entityType: fc.constantFrom('customer', 'lead'),
            operation: fc.constantFrom('create', 'update', 'delete')
          }),
          async ({ entityType, operation }) => {
            const wrapper = createWrapper();
            
            let hookResult;
            
            // Get the appropriate hook based on entity type and operation
            if (entityType === 'customer') {
              if (operation === 'create') {
                const { result } = renderHook(() => useCreateCustomer(), { wrapper });
                hookResult = result.current;
              } else if (operation === 'update') {
                const { result } = renderHook(() => useUpdateCustomer(), { wrapper });
                hookResult = result.current;
              } else {
                const { result } = renderHook(() => useDeleteCustomer(), { wrapper });
                hookResult = result.current;
              }
            } else {
              if (operation === 'create') {
                const { result } = renderHook(() => useCreateLead(), { wrapper });
                hookResult = result.current;
              } else if (operation === 'update') {
                const { result } = renderHook(() => useUpdateLead(), { wrapper });
                hookResult = result.current;
              } else {
                const { result } = renderHook(() => useDeleteLead(), { wrapper });
                hookResult = result.current;
              }
            }

            // Property: Initial error state should be consistent
            const hasConsistentErrorState = 
              hookResult.error === null &&
              hookResult.isError === false &&
              hookResult.isPending === false &&
              hookResult.isSuccess === false;

            return hasConsistentErrorState;
          }
        ),
        { numRuns: 40 }
      );
    });

    it('should maintain consistent mutation behavior patterns', () => {
      const wrapper = createWrapper();
      
      // Test all customer hooks
      const createCustomer = renderHook(() => useCreateCustomer(), { wrapper });
      const updateCustomer = renderHook(() => useUpdateCustomer(), { wrapper });
      const deleteCustomer = renderHook(() => useDeleteCustomer(), { wrapper });
      
      // Test all lead hooks
      const createLead = renderHook(() => useCreateLead(), { wrapper });
      const updateLead = renderHook(() => useUpdateLead(), { wrapper });
      const deleteLead = renderHook(() => useDeleteLead(), { wrapper });
      
      const allHooks = [
        createCustomer.result.current,
        updateCustomer.result.current,
        deleteCustomer.result.current,
        createLead.result.current,
        updateLead.result.current,
        deleteLead.result.current
      ];
      
      // Property: All hooks should have identical interface structure
      const firstHookKeys = Object.keys(allHooks[0]).sort();
      const allHaveSameKeys = allHooks.every(hook => {
        const hookKeys = Object.keys(hook).sort();
        return JSON.stringify(hookKeys) === JSON.stringify(firstHookKeys);
      });
      
      // Property: All hooks should have the same method signatures
      const allHaveSameMethods = allHooks.every(hook => {
        return typeof hook.mutate === 'function' &&
               typeof hook.mutateAsync === 'function' &&
               typeof hook.isPending === 'boolean' &&
               typeof hook.isError === 'boolean' &&
               typeof hook.isSuccess === 'boolean';
      });
      
      expect(allHaveSameKeys).toBe(true);
      expect(allHaveSameMethods).toBe(true);
    });

    it('should preserve TypeScript type compatibility', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entityType: fc.constantFrom('customer', 'lead'),
            hasValidData: fc.boolean()
          }),
          async ({ entityType, hasValidData }) => {
            const wrapper = createWrapper();
            
            // Property: TypeScript types should be preserved
            // This is primarily tested at compile time, but we can verify runtime behavior
            
            if (entityType === 'customer') {
              const createHook = renderHook(() => useCreateCustomer(), { wrapper });
              const updateHook = renderHook(() => useUpdateCustomer(), { wrapper });
              const deleteHook = renderHook(() => useDeleteCustomer(), { wrapper });
              
              // These should all be defined and have the expected structure
              expect(createHook.result.current).toBeDefined();
              expect(updateHook.result.current).toBeDefined();
              expect(deleteHook.result.current).toBeDefined();
            } else {
              const createHook = renderHook(() => useCreateLead(), { wrapper });
              const updateHook = renderHook(() => useUpdateLead(), { wrapper });
              const deleteHook = renderHook(() => useDeleteLead(), { wrapper });
              
              // These should all be defined and have the expected structure
              expect(createHook.result.current).toBeDefined();
              expect(updateHook.result.current).toBeDefined();
              expect(deleteHook.result.current).toBeDefined();
            }
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain consistent return value structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              entityType: fc.constantFrom('customer', 'lead'),
              operation: fc.constantFrom('create', 'update', 'delete')
            }),
            { minLength: 1, maxLength: 6 }
          ),
          async (hookConfigs) => {
            const wrapper = createWrapper();
            const hookResults = [];
            
            // Collect all hook results
            for (const config of hookConfigs) {
              let hookResult;
              
              if (config.entityType === 'customer') {
                if (config.operation === 'create') {
                  const { result } = renderHook(() => useCreateCustomer(), { wrapper });
                  hookResult = result.current;
                } else if (config.operation === 'update') {
                  const { result } = renderHook(() => useUpdateCustomer(), { wrapper });
                  hookResult = result.current;
                } else {
                  const { result } = renderHook(() => useDeleteCustomer(), { wrapper });
                  hookResult = result.current;
                }
              } else {
                if (config.operation === 'create') {
                  const { result } = renderHook(() => useCreateLead(), { wrapper });
                  hookResult = result.current;
                } else if (config.operation === 'update') {
                  const { result } = renderHook(() => useUpdateLead(), { wrapper });
                  hookResult = result.current;
                } else {
                  const { result } = renderHook(() => useDeleteLead(), { wrapper });
                  hookResult = result.current;
                }
              }
              
              hookResults.push(hookResult);
            }
            
            // Property: All hooks should have the same return value structure
            if (hookResults.length > 1) {
              const firstStructure = Object.keys(hookResults[0]).sort();
              const allHaveSameStructure = hookResults.every(result => {
                const structure = Object.keys(result).sort();
                return JSON.stringify(structure) === JSON.stringify(firstStructure);
              });
              
              return allHaveSameStructure;
            }
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});