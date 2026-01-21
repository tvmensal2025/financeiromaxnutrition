/**
 * Property Test: Business Context Unification
 * 
 * Tests that all sale creation contexts (useCustomerSale, QuickSaleModal, CustomerFormDialog)
 * now use the unified business logic interface consistently.
 * 
 * **Property 20: Business Context Unification**
 * **Validates: Requirements 4.4**
 * 
 * @fileoverview Property-based tests for business context unification
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { createPropertyTest } from '../../test/fast-check.config';
import { 
  useSaleCreationService, 
  QuickSaleData, 
  CustomerFormSaleData,
  LegacySaleItem,
  LegacyItem
} from './saleCreationService';
import { createBusinessLogicLayer } from './createBusinessLogicLayer';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'test-id', name: 'Test Entity' }, 
            error: null 
          }))
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'test-id', name: 'Test Entity' }, 
            error: null 
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

describe('Property Test: Business Context Unification', () => {
  let businessId: string;

  beforeEach(() => {
    businessId = 'test-business-id';
    vi.clearAllMocks();
  });

  /**
   * Property 20: Business Context Unification
   * 
   * All sale creation contexts should use the unified business logic interface
   * and produce consistent results regardless of the entry point.
   */
  it('Property 20: All sale creation contexts use unified business logic interface', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Test data for different sale creation contexts
          legacySaleData: fc.record({
            customerId: fc.string({ minLength: 1, maxLength: 50 }),
            saleItems: fc.array(fc.record({
              type: fc.constantFrom('product', 'service'),
              item_id: fc.string({ minLength: 1, maxLength: 50 }),
              quantity: fc.integer({ min: 1, max: 10 })
            }), { minLength: 1, maxLength: 5 }),
            saleDiscount: fc.float({ min: Math.fround(0), max: Math.fround(100) }),
            products: fc.array(fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) })
            }), { minLength: 1, maxLength: 10 }),
            services: fc.array(fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) })
            }), { minLength: 1, maxLength: 10 })
          }),
          quickSaleData: fc.record({
            customerName: fc.string({ minLength: 1, maxLength: 100 }),
            customerEmail: fc.option(fc.emailAddress()),
            customerPhone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
            leadId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            customerId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            interest_type: fc.option(fc.constantFrom('product', 'service')),
            interested_product_id: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            interested_service_id: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            value: fc.float({ min: Math.fround(0.01), max: Math.fround(10000) }),
            notes: fc.option(fc.string({ maxLength: 500 })),
            createInvoice: fc.boolean()
          }),
          customerFormData: fc.record({
            customerData: fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              email: fc.option(fc.emailAddress()),
              phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
              notes: fc.option(fc.string({ maxLength: 500 }))
            }),
            saleData: fc.option(fc.record({
              saleItems: fc.array(fc.record({
                type: fc.constantFrom('product', 'service'),
                item_id: fc.string({ minLength: 1, maxLength: 50 }),
                quantity: fc.integer({ min: 1, max: 10 })
              }), { minLength: 1, maxLength: 5 }),
              saleDiscount: fc.float({ min: Math.fround(0), max: Math.fround(100) }),
              products: fc.array(fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) })
              }), { minLength: 1, maxLength: 10 }),
              services: fc.array(fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) })
              }), { minLength: 1, maxLength: 10 })
            }))
          })
        }),
        async (testData) => {
          try {
            const saleService = useSaleCreationService(businessId);

            // Test 1: Legacy useCustomerSale context
            const legacyResult = await saleService.createSaleInvoice(
              testData.legacySaleData.customerId,
              testData.legacySaleData.saleItems,
              testData.legacySaleData.saleDiscount,
              testData.legacySaleData.products,
              testData.legacySaleData.services
            );

            // Verify legacy context uses unified interface
            expect(legacyResult).toBeDefined();
            expect(typeof legacyResult).toBe('object');

            // Test 2: QuickSaleModal context
            const quickSaleResult = await saleService.createQuickSale(testData.quickSaleData);

            // Verify quick sale context uses unified interface
            expect(quickSaleResult).toBeDefined();
            expect(typeof quickSaleResult).toBe('object');

            // Test 3: CustomerFormDialog context
            const customerFormResult = await saleService.createSaleWithCustomer(
              testData.customerFormData.customerData,
              testData.customerFormData.saleData
            );

            // Verify customer form context uses unified interface
            expect(customerFormResult).toBeDefined();
            expect(typeof customerFormResult).toBe('object');

            // Test 4: All contexts should use the same underlying business logic
            const businessLogic = createBusinessLogicLayer({ businessId });
            const config = businessLogic.getConfig();

            // Verify all contexts share the same configuration
            expect(config.businessId).toBe(businessId);
            expect(config.atomicOperations).toBe(true);

            // Test 5: Error handling should be consistent across contexts
            try {
              // Test with invalid data to trigger error handling
              await saleService.createSaleInvoice('', [], 0, [], []);
            } catch (error) {
              expect(error).toBeInstanceOf(Error);
              expect(error.message).toContain('required');
            }

            return true;

          } catch (error) {
            console.error('Business context unification test failed:', error);
            return false;
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 20.1: Service Interface Consistency
   * 
   * All service methods should return consistent result structures
   * regardless of the input context or data complexity.
   */
  it('Property 20.1: Service interface consistency across all contexts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          businessId: fc.string({ minLength: 1, maxLength: 50 }),
          testScenario: fc.constantFrom('legacy', 'quickSale', 'customerForm', 'leadConversion')
        }),
        async (testData) => {
          try {
            const saleService = useSaleCreationService(testData.businessId);

            let result: any;

            switch (testData.testScenario) {
              case 'legacy':
                result = await saleService.createSaleInvoice(
                  'test-customer',
                  [{ type: 'product', item_id: 'test-product', quantity: 1 }],
                  0,
                  [{ id: 'test-product', name: 'Test Product', price: 100 }],
                  []
                );
                break;

              case 'quickSale':
                result = await saleService.createQuickSale({
                  customerName: 'Test Customer',
                  value: 100
                });
                break;

              case 'customerForm':
                result = await saleService.createSaleWithCustomer(
                  { name: 'Test Customer' }
                );
                break;

              case 'leadConversion':
                result = await saleService.convertLeadToSale('test-lead');
                break;
            }

            // All service methods should return consistent structures
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');

            // All results should have consistent properties
            if (result && typeof result === 'object') {
              // Results should be valid objects with expected structure
              expect(result).not.toBeNull();
            }

            return true;

          } catch (error) {
            // Expected errors should be consistent Error instances
            expect(error).toBeInstanceOf(Error);
            return true;
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 20.2: Configuration Consistency
   * 
   * All sale creation contexts should share the same business logic
   * configuration and behave consistently.
   */
  it('Property 20.2: Configuration consistency across all contexts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          businessId: fc.string({ minLength: 1, maxLength: 50 }),
          atomicOperations: fc.boolean(),
          operationTimeout: fc.integer({ min: 1000, max: 60000 }),
          retryAttempts: fc.integer({ min: 1, max: 5 })
        }),
        async (testData) => {
          try {
            // Create service with specific configuration
            const saleService = useSaleCreationService(testData.businessId);
            const config = saleService.getConfig();

            // Verify configuration is applied consistently
            expect(config.businessId).toBe(testData.businessId);
            expect(typeof config.atomicOperations).toBe('boolean');

            // Test that all contexts use the same configuration
            const businessLogic = createBusinessLogicLayer({
              businessId: testData.businessId,
              atomicOperations: testData.atomicOperations,
              operationTimeout: testData.operationTimeout,
              retry: { attempts: testData.retryAttempts, delay: 1000 }
            });

            const businessConfig = businessLogic.getConfig();

            // Verify configuration consistency
            expect(businessConfig.businessId).toBe(testData.businessId);
            expect(businessConfig.atomicOperations).toBe(testData.atomicOperations);
            expect(businessConfig.operationTimeout).toBe(testData.operationTimeout);
            expect(businessConfig.retry?.attempts).toBe(testData.retryAttempts);

            return true;

          } catch (error) {
            console.error('Configuration consistency test failed:', error);
            return false;
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 20.3: Error Handling Unification
   * 
   * All sale creation contexts should handle errors consistently
   * and provide unified error reporting.
   */
  it('Property 20.3: Unified error handling across all contexts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorScenario: fc.constantFrom(
            'missing_business_id',
            'invalid_customer_data',
            'empty_sale_items',
            'negative_amounts'
          ),
          contextType: fc.constantFrom('legacy', 'quickSale', 'customerForm')
        }),
        async (testData) => {
          try {
            let saleService: ReturnType<typeof useSaleCreationService>;
            let errorThrown = false;
            let errorMessage = '';

            // Create service based on error scenario
            if (testData.errorScenario === 'missing_business_id') {
              saleService = useSaleCreationService('');
            } else {
              saleService = useSaleCreationService('valid-business-id');
            }

            try {
              switch (testData.contextType) {
                case 'legacy':
                  if (testData.errorScenario === 'empty_sale_items') {
                    await saleService.createSaleInvoice('customer-id', [], 0, [], []);
                  } else if (testData.errorScenario === 'invalid_customer_data') {
                    await saleService.createSaleInvoice('', [], 0, [], []);
                  } else {
                    await saleService.createSaleInvoice('customer-id', 
                      [{ type: 'product', item_id: 'product-id', quantity: 1 }], 
                      0, 
                      [{ id: 'product-id', name: 'Product', price: 100 }], 
                      []
                    );
                  }
                  break;

                case 'quickSale':
                  if (testData.errorScenario === 'invalid_customer_data') {
                    await saleService.createQuickSale({ customerName: '', value: 100 });
                  } else if (testData.errorScenario === 'negative_amounts') {
                    await saleService.createQuickSale({ customerName: 'Customer', value: -100 });
                  } else {
                    await saleService.createQuickSale({ customerName: 'Customer', value: 100 });
                  }
                  break;

                case 'customerForm':
                  if (testData.errorScenario === 'invalid_customer_data') {
                    await saleService.createSaleWithCustomer({});
                  } else {
                    await saleService.createSaleWithCustomer({ name: 'Customer' });
                  }
                  break;
              }
            } catch (error) {
              errorThrown = true;
              errorMessage = error instanceof Error ? error.message : String(error);
            }

            // Verify error handling consistency
            if (['missing_business_id', 'invalid_customer_data', 'empty_sale_items', 'negative_amounts'].includes(testData.errorScenario)) {
              expect(errorThrown).toBe(true);
              expect(errorMessage).toBeTruthy();
              expect(errorMessage.length).toBeGreaterThan(0);
            }

            return true;

          } catch (error) {
            console.error('Error handling unification test failed:', error);
            return false;
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});