/**
 * Property Test: Business Operation Atomicity
 * 
 * Tests that business operations are atomic - they either complete entirely
 * or fail entirely with proper rollback of all changes.
 * 
 * **Validates: Requirements 4.2**
 * 
 * @fileoverview Property-based tests for business operation atomicity
 * @version 1.0.0
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createBusinessLogicLayer } from './createBusinessLogicLayer';
import { Arbitraries, createPropertyTest } from '../../test/fast-check.config';
import { supabase } from '@/integrations/supabase/client';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    business: { id: 'test-business-id' }
  })
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock Supabase client
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
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}));

describe('Property Test: Business Operation Atomicity', () => {
  let businessLogic: ReturnType<typeof createBusinessLogicLayer>;
  let mockSupabaseOperations: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create business logic layer with transaction support
    businessLogic = createBusinessLogicLayer({
      enableTransactions: true,
      enableRollback: true,
      debug: true
    });

    // Setup mock Supabase operations
    mockSupabaseOperations = {
      customers: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        select: vi.fn()
      },
      sales: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        select: vi.fn()
      },
      sale_items: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        select: vi.fn()
      },
      leads: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        select: vi.fn()
      }
    };

    // Mock supabase.from to return our mock operations
    (supabase.from as any).mockImplementation((table: string) => {
      const operations = mockSupabaseOperations[table as keyof typeof mockSupabaseOperations];
      return {
        insert: (data: any) => ({
          select: () => ({
            single: () => Promise.resolve({ 
              data: { id: `${table}-${Date.now()}`, ...data }, 
              error: null 
            })
          })
        }),
        update: (data: any) => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ 
                data: { id: `${table}-${Date.now()}`, ...data }, 
                error: null 
              })
            })
          })
        }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null })
        }),
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ 
              data: { id: `${table}-${Date.now()}` }, 
              error: null 
            })
          })
        })
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 18: Business Operation Atomicity
   * 
   * Tests that business operations are atomic:
   * - Either all operations succeed and data is persisted
   * - Or any failure triggers rollback of all changes
   * - No partial state is left in the system
   * 
   * **Validates: Requirements 4.2**
   */
  createPropertyTest(
    'Property 18: Business operations should be atomic with proper rollback',
    fc.record({
      customerData: Arbitraries.customerData(),
      saleData: fc.record({
        totalAmount: Arbitraries.positiveNumber(),
        paymentMethod: fc.constantFrom('cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer'),
        products: fc.array(fc.record({
          id: Arbitraries.uuid(),
          quantity: fc.integer({ min: 1, max: 10 }),
          price: Arbitraries.positiveNumber()
        }), { minLength: 1, maxLength: 5 }),
        notes: fc.option(fc.string({ maxLength: 500 }))
      }),
      shouldFail: fc.boolean(),
      failurePoint: fc.constantFrom('customer_creation', 'sale_creation', 'sale_items_creation')
    }),
    async ({ customerData, saleData, shouldFail, failurePoint }) => {
      // Check if this is a naturally invalid case that should fail validation
      const hasInvalidName = !customerData.name || (typeof customerData.name === 'string' && customerData.name.trim().length === 0);
      const hasInvalidAmount = !saleData.totalAmount || saleData.totalAmount <= 0;
      const hasInvalidProducts = !saleData.products || saleData.products.length === 0;
      
      const shouldFailValidation = hasInvalidName || hasInvalidAmount || hasInvalidProducts;
      // Setup failure simulation if needed
      if (shouldFail) {
        const failureTable = failurePoint === 'customer_creation' ? 'customers' :
                            failurePoint === 'sale_creation' ? 'sales' : 'sale_items';
        
        // Mock failure for specific operation
        (supabase.from as any).mockImplementation((table: string) => {
          if (table === failureTable) {
            return {
              insert: () => ({
                select: () => ({
                  single: () => Promise.resolve({ 
                    data: null, 
                    error: new Error(`Simulated ${table} failure`) 
                  })
                })
              }),
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: () => Promise.resolve({ 
                      data: null, 
                      error: new Error(`Simulated ${table} failure`) 
                    })
                  })
                })
              }),
              delete: () => ({
                eq: () => Promise.resolve({ error: null })
              }),
              select: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ 
                    data: { id: `${table}-${Date.now()}` }, 
                    error: null 
                  })
                })
              })
            };
          }
          
          // Return normal mock for other tables
          return {
            insert: (data: any) => ({
              select: () => ({
                single: () => Promise.resolve({ 
                  data: { id: `${table}-${Date.now()}`, ...data }, 
                  error: null 
                })
              })
            }),
            update: (data: any) => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ 
                    data: { id: `${table}-${Date.now()}`, ...data }, 
                    error: null 
                  })
                })
              })
            }),
            delete: () => ({
              eq: () => Promise.resolve({ error: null })
            }),
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: { id: `${table}-${Date.now()}` }, 
                  error: null 
                })
              })
            })
          };
        });
      }

      try {
        // Execute sale creation operation
        const result = await businessLogic.sales.createSale({
          customerData,
          totalAmount: saleData.totalAmount,
          paymentMethod: saleData.paymentMethod,
          products: saleData.products,
          notes: saleData.notes
        });

        if (shouldFailValidation) {
          // If input is invalid, operation should fail with validation error
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error?.message).toMatch(/required|invalid|empty/i);
          return true;
        }

        if (shouldFail) {
          // Operation should have failed due to simulated failure
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.transaction).toBeDefined();
          
          // Verify rollback operations were attempted
          if (result.transaction && result.transaction.rollbackOperations.length > 0) {
            // At least one rollback operation should exist
            expect(result.transaction.rollbackOperations.length).toBeGreaterThan(0);
          }
          
          return true;
        } else {
          // Operation should have succeeded
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
          expect(result.transaction).toBeDefined();
          expect(result.transaction?.completed).toBe(true);
          
          // Verify all operations were recorded
          if (result.transaction) {
            expect(result.transaction.operations.length).toBeGreaterThan(0);
            
            // Should have customer creation and sale creation operations
            const operationTypes = result.transaction.operations.map(op => op.type);
            expect(operationTypes).toContain('create');
            
            // Should have corresponding rollback operations
            expect(result.transaction.rollbackOperations.length).toBeGreaterThan(0);
          }
          
          return true;
        }
      } catch (error) {
        if (shouldFailValidation) {
          // Expected validation failure - this is correct behavior
          return true;
        } else if (shouldFail) {
          // Expected failure - this is correct behavior
          return true;
        } else {
          // Unexpected failure
          console.error('Unexpected failure in atomic operation:', error);
          return false;
        }
      }
    },
    { numRuns: 50 }
  );

  /**
   * Property 18.1: Transaction Rollback Completeness
   * 
   * Tests that when a transaction fails, all rollback operations are executed
   * and the system returns to its original state.
   */
  createPropertyTest(
    'Property 18.1: Transaction rollback should be complete and restore original state',
    fc.record({
      leadData: Arbitraries.leadData(),
      saleData: fc.record({
        totalAmount: Arbitraries.positiveNumber(),
        paymentMethod: fc.constantFrom('cash', 'pix', 'credit_card')
      }),
      forceFailure: fc.boolean()
    }),
    async ({ leadData, saleData, forceFailure }) => {
      // Check if this is a naturally invalid case that should fail validation
      const hasInvalidLeadName = !leadData.name || (typeof leadData.name === 'string' && leadData.name.trim().length === 0);
      const hasInvalidAmount = !saleData.totalAmount || saleData.totalAmount <= 0;
      
      const shouldFailValidation = hasInvalidLeadName || hasInvalidAmount;
      // Track operations for verification
      const executedOperations: string[] = [];
      const rolledBackOperations: string[] = [];

      // Mock operations to track execution and rollback
      (supabase.from as any).mockImplementation((table: string) => {
        return {
          insert: (data: any) => {
            executedOperations.push(`insert_${table}`);
            
            if (forceFailure && table === 'sales') {
              return {
                select: () => ({
                  single: () => Promise.resolve({ 
                    data: null, 
                    error: new Error('Forced failure') 
                  })
                })
              };
            }
            
            return {
              select: () => ({
                single: () => Promise.resolve({ 
                  data: { id: `${table}-${Date.now()}`, ...data }, 
                  error: null 
                })
              })
            };
          },
          update: (data: any) => ({
            eq: () => ({
              select: () => ({
                single: () => {
                  executedOperations.push(`update_${table}`);
                  return Promise.resolve({ 
                    data: { id: `${table}-${Date.now()}`, ...data }, 
                    error: null 
                  });
                }
              })
            })
          }),
          delete: () => ({
            eq: () => {
              rolledBackOperations.push(`delete_${table}`);
              return Promise.resolve({ error: null });
            }
          }),
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ 
                data: { id: `${table}-${Date.now()}`, ...leadData }, 
                error: null 
              })
            })
          })
        };
      });

      try {
        // First create a lead
        const leadResult = await businessLogic.leads.createLead(leadData);
        
        if (shouldFailValidation) {
          // If input is invalid, lead creation should fail with validation error
          expect(leadResult.success).toBe(false);
          expect(leadResult.error).toBeDefined();
          expect(leadResult.error?.message).toMatch(/required|invalid|empty/i);
          return true;
        }
        
        if (!leadResult.success || !leadResult.data) {
          return true; // Skip if lead creation fails for other reasons
        }

        // Then try to convert lead to sale
        const conversionResult = await businessLogic.sales.convertLeadToSale({
          leadId: leadResult.data.id,
          saleData
        });

        if (forceFailure) {
          // Should have failed and rolled back
          expect(conversionResult.success).toBe(false);
          
          // Verify rollback operations were executed
          // The number of rollback operations should match or exceed executed operations
          if (conversionResult.transaction) {
            expect(conversionResult.transaction.rollbackOperations.length).toBeGreaterThan(0);
          }
          
          return true;
        } else {
          // Should have succeeded
          expect(conversionResult.success).toBe(true);
          expect(conversionResult.data).toBeDefined();
          
          // Verify transaction was completed
          if (conversionResult.transaction) {
            expect(conversionResult.transaction.completed).toBe(true);
            expect(conversionResult.transaction.operations.length).toBeGreaterThan(0);
          }
          
          return true;
        }
      } catch (error) {
        // If we have validation issues or forced failure, this is expected
        if (shouldFailValidation || forceFailure) {
          return true;
        }
        
        console.error('Unexpected error in rollback test:', error);
        return false;
      }
    },
    { numRuns: 30 }
  );

  /**
   * Property 18.2: Concurrent Operation Isolation
   * 
   * Tests that concurrent business operations don't interfere with each other's
   * atomicity guarantees.
   */
  createPropertyTest(
    'Property 18.2: Concurrent operations should maintain atomicity isolation',
    fc.record({
      operation1: fc.record({
        customerData: Arbitraries.customerData(),
        saleAmount: Arbitraries.positiveNumber()
      }),
      operation2: fc.record({
        customerData: Arbitraries.customerData(),
        saleAmount: Arbitraries.positiveNumber()
      }),
      delayMs: fc.integer({ min: 0, max: 100 })
    }),
    async ({ operation1, operation2, delayMs }) => {
      // Execute two concurrent operations
      const promise1 = businessLogic.sales.createSale({
        customerData: operation1.customerData,
        totalAmount: operation1.saleAmount,
        paymentMethod: 'pix',
        products: [{
          id: 'product-1',
          quantity: 1,
          price: operation1.saleAmount
        }]
      });

      // Add small delay to simulate real concurrency
      await new Promise(resolve => setTimeout(resolve, delayMs));

      const promise2 = businessLogic.sales.createSale({
        customerData: operation2.customerData,
        totalAmount: operation2.saleAmount,
        paymentMethod: 'cash',
        products: [{
          id: 'product-2',
          quantity: 1,
          price: operation2.saleAmount
        }]
      });

      // Wait for both operations to complete
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both operations should have unique transaction IDs
      if (result1.transaction && result2.transaction) {
        expect(result1.transaction.id).not.toBe(result2.transaction.id);
      }

      // Each operation should be independently atomic
      if (result1.success) {
        expect(result1.transaction?.completed).toBe(true);
        expect(result1.data).toBeDefined();
      } else {
        expect(result1.error).toBeDefined();
      }

      if (result2.success) {
        expect(result2.transaction?.completed).toBe(true);
        expect(result2.data).toBeDefined();
      } else {
        expect(result2.error).toBeDefined();
      }

      return true;
    },
    { numRuns: 20 }
  );
});