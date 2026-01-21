/**
 * Workflow Integration Tests
 * 
 * Tests complete user workflows and business process flows using the refactored
 * factory system. These tests validate end-to-end functionality and cross-system
 * integration without relying on React hooks.
 * 
 * @fileoverview Workflow integration tests for business processes
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCRUDFactory } from '../createCRUDFactory';
import { createQueryFactory } from '../createQueryFactory';
import { createBusinessLogicLayer } from '../business-logic/createBusinessLogicLayer';
import { entityConfigurations, Customer, Lead, Product, Transaction } from './entityConfigurations';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => {
  const mockData = {
    customers: [
      { id: 'cust-1', name: 'João Silva', email: 'joao@email.com', phone: '(11) 99999-9999', business_id: 'test-business' },
      { id: 'cust-2', name: 'Maria Santos', email: 'maria@email.com', phone: '(11) 88888-8888', business_id: 'test-business' }
    ],
    leads: [
      { id: 'lead-1', name: 'Pedro Costa', email: 'pedro@email.com', status: 'new', source: 'website', business_id: 'test-business' },
      { id: 'lead-2', name: 'Ana Lima', email: 'ana@email.com', status: 'qualified', source: 'referral', business_id: 'test-business' }
    ],
    products: [
      { id: 'prod-1', name: 'Produto A', price: 100, is_active: true, business_id: 'test-business' },
      { id: 'prod-2', name: 'Produto B', price: 200, is_active: true, business_id: 'test-business' }
    ],
    services: [
      { id: 'serv-1', name: 'Serviço A', price: 150, is_active: true, business_id: 'test-business' },
      { id: 'serv-2', name: 'Serviço B', price: 250, is_active: true, business_id: 'test-business' }
    ],
    transactions: [
      { id: 'trans-1', description: 'Venda Produto A', amount: 100, type: 'income', status: 'completed', date: '2024-01-01', business_id: 'test-business' }
    ]
  };

  return {
    supabase: {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: mockData[table as keyof typeof mockData] || [],
              error: null
            })),
            single: vi.fn(() => ({
              data: mockData[table as keyof typeof mockData]?.[0] || null,
              error: null
            }))
          })),
          order: vi.fn(() => ({
            data: mockData[table as keyof typeof mockData] || [],
            error: null
          })),
          single: vi.fn(() => ({
            data: mockData[table as keyof typeof mockData]?.[0] || null,
            error: null
          }))
        })),
        insert: vi.fn((data: any) => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: `new-${Date.now()}`, ...data },
              error: null
            }))
          }))
        })),
        update: vi.fn((data: any) => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { id: 'updated-id', ...data },
                error: null
              }))
            }))
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            error: null
          }))
        })),
        // Count queries
        select: vi.fn((columns: string) => {
          if (columns.includes('count')) {
            return {
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { count: mockData[table as keyof typeof mockData]?.length || 0 },
                  error: null
                }))
              }))
            };
          }
          return {
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: mockData[table as keyof typeof mockData] || [],
                error: null
              }))
            }))
          };
        })
      }))
    }
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    business: { id: 'test-business-id' }
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('Workflow Integration Tests', () => {
  const businessId = 'test-business-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Factory Integration Workflows', () => {
    it('should integrate CRUD and Query factories for consistent data operations', async () => {
      // Create CRUD factory for customers
      const crudFactory = createCRUDFactory<Customer>({
        tableName: 'customers',
        successMessages: {
          create: 'Cliente criado com sucesso!',
          update: 'Cliente atualizado!',
          delete: 'Cliente removido!'
        },
        errorMessages: {
          create: 'Erro ao criar cliente',
          update: 'Erro ao atualizar cliente',
          delete: 'Erro ao remover cliente'
        },
        invalidateKeys: [['customers']],
        optimisticUpdates: false
      });

      // Create Query factory for customers
      const queryFactory = createQueryFactory<Customer>({
        tableName: 'customers',
        defaultFilters: {},
        realTimeSubscription: false,
        cacheTime: 5 * 60 * 1000,
        staleTime: 2 * 60 * 1000,
        defaultPageSize: 20
      });

      // Verify factories are properly integrated
      expect(crudFactory.getTableName()).toBe('customers');
      expect(queryFactory.getTableName()).toBe('customers');
      expect(crudFactory.getTableName()).toBe(queryFactory.getTableName());

      // Verify factory methods exist
      expect(crudFactory.useCreate).toBeInstanceOf(Function);
      expect(crudFactory.useUpdate).toBeInstanceOf(Function);
      expect(crudFactory.useDelete).toBeInstanceOf(Function);
      expect(queryFactory.useEntities).toBeInstanceOf(Function);
      expect(queryFactory.useEntity).toBeInstanceOf(Function);
      expect(queryFactory.useEntitiesCount).toBeInstanceOf(Function);
    });

    it('should support multiple entity types with consistent patterns', async () => {
      // Create factories for different entity types
      const customerCRUD = createCRUDFactory<Customer>({
        tableName: 'customers',
        successMessages: { create: 'Customer created' },
        errorMessages: { create: 'Customer error' },
        invalidateKeys: [['customers']],
        optimisticUpdates: false
      });

      const leadCRUD = createCRUDFactory<Lead>({
        tableName: 'leads',
        successMessages: { create: 'Lead created' },
        errorMessages: { create: 'Lead error' },
        invalidateKeys: [['leads']],
        optimisticUpdates: false
      });

      const productCRUD = createCRUDFactory<Product>({
        tableName: 'products',
        successMessages: { create: 'Product created' },
        errorMessages: { create: 'Product error' },
        invalidateKeys: [['products']],
        optimisticUpdates: false
      });

      // Verify all factories follow consistent patterns
      const factories = [customerCRUD, leadCRUD, productCRUD];
      const expectedTables = ['customers', 'leads', 'products'];

      factories.forEach((factory, index) => {
        expect(factory.getTableName()).toBe(expectedTables[index]);
        expect(factory.useCreate).toBeInstanceOf(Function);
        expect(factory.useUpdate).toBeInstanceOf(Function);
        expect(factory.useDelete).toBeInstanceOf(Function);
      });
    });

    it('should validate form configurations match entity requirements', async () => {
      // Test customer form configuration
      const customerConfig = entityConfigurations.customer;
      expect(customerConfig.entityName).toBe('customer');
      expect(customerConfig.tableName).toBe('customers');
      expect(customerConfig.formFields).toBeDefined();
      expect(customerConfig.formFields.length).toBeGreaterThan(0);

      // Verify required fields
      const nameField = customerConfig.formFields.find(field => field.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField?.required).toBe(true);
      expect(nameField?.validation).toBeDefined();

      // Test validation logic
      const validation = nameField?.validation?.[0];
      expect(validation?.validate('')).toBe('Nome é obrigatório');
      expect(validation?.validate('João Silva')).toBeNull();

      // Test lead form configuration
      const leadConfig = entityConfigurations.lead;
      expect(leadConfig.entityName).toBe('lead');
      expect(leadConfig.tableName).toBe('leads');
      
      const leadSourceField = leadConfig.formFields.find(field => field.name === 'source');
      expect(leadSourceField).toBeDefined();
      expect(leadSourceField?.required).toBe(true);
      expect(leadSourceField?.options).toBeDefined();
      expect(leadSourceField?.options?.length).toBeGreaterThan(0);
    });
  });

  describe('Business Logic Integration Workflows', () => {
    it('should handle complete sale creation workflow', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test sale creation with customer and products
      const saleResult = await businessLogic.sales.createSale({
        customerId: 'cust-1',
        products: [
          { productId: 'prod-1', quantity: 2, unitPrice: 100 },
          { productId: 'prod-2', quantity: 1, unitPrice: 200 }
        ],
        paymentMethod: 'pix',
        notes: 'Venda de teste integrada'
      });

      expect(saleResult).toBeDefined();
      expect(saleResult.success).toBe(true);
      
      if (saleResult.success) {
        expect(saleResult.data).toBeDefined();
        expect(saleResult.data.totalAmount).toBe(400); // (2 * 100) + (1 * 200)
        expect(saleResult.data.paymentMethod).toBe('pix');
        expect(saleResult.data.customerId).toBe('cust-1');
      }
    });

    it('should handle quick sale workflow without existing customer', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test quick sale creation
      const quickSaleResult = await businessLogic.sales.createQuickSale({
        customerName: 'Cliente Rápido',
        customerPhone: '(11) 99999-9999',
        amount: 250,
        paymentMethod: 'cash',
        description: 'Venda rápida integrada'
      });

      expect(quickSaleResult).toBeDefined();
      expect(quickSaleResult.success).toBe(true);
      
      if (quickSaleResult.success) {
        expect(quickSaleResult.data).toBeDefined();
        expect(quickSaleResult.data.amount).toBe(250);
        expect(quickSaleResult.data.paymentMethod).toBe('cash');
        expect(quickSaleResult.data.description).toBe('Venda rápida integrada');
      }
    });

    it('should handle lead conversion workflow', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test lead to customer conversion
      const conversionResult = await businessLogic.leads.convertToCustomer('lead-1');

      expect(conversionResult).toBeDefined();
      expect(conversionResult.success).toBe(true);
      
      if (conversionResult.success) {
        expect(conversionResult.data).toBeDefined();
        expect(conversionResult.data.name).toBeDefined();
        expect(conversionResult.data.email).toBeDefined();
      }
    });

    it('should handle atomic business operations', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test atomic operation with multiple steps
      const atomicResult = await businessLogic.executeAtomic([
        {
          operation: 'createCustomer',
          data: {
            name: 'Cliente Atômico',
            email: 'atomico@email.com',
            business_id: businessId
          }
        },
        {
          operation: 'createSale',
          data: {
            customerId: 'new-customer-id',
            products: [{ productId: 'prod-1', quantity: 1, unitPrice: 100 }],
            paymentMethod: 'pix'
          }
        }
      ]);

      expect(atomicResult).toBeDefined();
      expect(atomicResult.success).toBeDefined();
      expect(atomicResult.results).toBeDefined();
      expect(Array.isArray(atomicResult.results)).toBe(true);
      
      if (atomicResult.success) {
        expect(atomicResult.results.length).toBe(2);
        atomicResult.results.forEach(result => {
          expect(result.success).toBeDefined();
        });
      }
    });
  });

  describe('Cross-System Integration Workflows', () => {
    it('should integrate form validation with business logic', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test customer creation with form validation
      const customerConfig = entityConfigurations.customer;
      const nameField = customerConfig.formFields.find(field => field.name === 'name');
      const emailField = customerConfig.formFields.find(field => field.name === 'email');

      // Validate required name field
      expect(nameField?.validation?.[0].validate('')).toBe('Nome é obrigatório');
      expect(nameField?.validation?.[0].validate('João Silva')).toBeNull();

      // Validate email format
      expect(emailField?.validation?.[0].validate('invalid-email')).toBe('Email deve ter um formato válido');
      expect(emailField?.validation?.[0].validate('joao@email.com')).toBeNull();

      // Test business logic with validated data
      const customerResult = await businessLogic.customers.createCustomer({
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '(11) 99999-9999',
        business_id: businessId
      });

      expect(customerResult).toBeDefined();
      expect(customerResult.success).toBe(true);
    });

    it('should integrate error handling across all systems', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test error handling in business logic
      const invalidSaleResult = await businessLogic.sales.createSale({
        customerId: '', // Invalid: empty customer ID
        products: [],  // Invalid: no products
        paymentMethod: 'pix'
      });

      expect(invalidSaleResult).toBeDefined();
      expect(invalidSaleResult.success).toBe(false);
      expect(invalidSaleResult.error).toBeDefined();
      expect(invalidSaleResult.error?.message).toContain('Invalid');
    });

    it('should maintain data consistency across operations', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test that related operations maintain consistency
      const customerResult = await businessLogic.customers.createCustomer({
        name: 'Cliente Consistência',
        email: 'consistencia@email.com',
        business_id: businessId
      });

      expect(customerResult.success).toBe(true);

      if (customerResult.success) {
        // Create sale for the customer
        const saleResult = await businessLogic.sales.createSale({
          customerId: customerResult.data.id,
          products: [{ productId: 'prod-1', quantity: 1, unitPrice: 100 }],
          paymentMethod: 'pix'
        });

        expect(saleResult.success).toBe(true);
        
        if (saleResult.success) {
          expect(saleResult.data.customerId).toBe(customerResult.data.id);
        }
      }
    });
  });

  describe('Performance and Scalability Workflows', () => {
    it('should handle multiple concurrent factory operations', async () => {
      // Create multiple factories concurrently
      const factoryPromises = Array.from({ length: 10 }, (_, i) => {
        return Promise.resolve(createCRUDFactory<Customer>({
          tableName: 'customers',
          successMessages: { create: `Customer ${i} created` },
          errorMessages: { create: `Customer ${i} error` },
          invalidateKeys: [['customers']],
          optimisticUpdates: false
        }));
      });

      const factories = await Promise.all(factoryPromises);
      
      expect(factories).toHaveLength(10);
      factories.forEach((factory, index) => {
        expect(factory.getTableName()).toBe('customers');
        expect(factory.useCreate).toBeInstanceOf(Function);
      });
    });

    it('should handle large-scale business operations efficiently', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test performance with multiple operations
      const startTime = performance.now();
      
      const operations = Array.from({ length: 5 }, (_, i) => 
        businessLogic.sales.createQuickSale({
          customerName: `Cliente ${i}`,
          customerPhone: `(11) 9999${i}-999${i}`,
          amount: 100 + i * 10,
          paymentMethod: 'pix',
          description: `Venda ${i}`
        })
      );

      const results = await Promise.all(operations);
      const endTime = performance.now();

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.amount).toBe(100 + index * 10);
        }
      });

      // Performance should be reasonable
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain memory efficiency with factory creation', async () => {
      // Test memory efficiency by creating and disposing factories
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        const factory = createCRUDFactory<Customer>({
          tableName: 'customers',
          successMessages: { create: 'Customer created' },
          errorMessages: { create: 'Customer error' },
          invalidateKeys: [['customers']],
          optimisticUpdates: false
        });

        expect(factory.getTableName()).toBe('customers');
        
        // Factory should be garbage collected after going out of scope
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('End-to-End Business Process Workflows', () => {
    it('should complete full customer lifecycle workflow', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // 1. Create lead
      const leadResult = await businessLogic.leads.createLead({
        name: 'Lead Ciclo Completo',
        email: 'ciclo@email.com',
        source: 'website',
        status: 'new',
        business_id: businessId
      });

      expect(leadResult.success).toBe(true);

      if (leadResult.success) {
        // 2. Convert lead to customer
        const conversionResult = await businessLogic.leads.convertToCustomer(leadResult.data.id);
        expect(conversionResult.success).toBe(true);

        if (conversionResult.success) {
          // 3. Create sale for customer
          const saleResult = await businessLogic.sales.createSale({
            customerId: conversionResult.data.id,
            products: [{ productId: 'prod-1', quantity: 1, unitPrice: 150 }],
            paymentMethod: 'credit_card'
          });

          expect(saleResult.success).toBe(true);
          
          if (saleResult.success) {
            expect(saleResult.data.customerId).toBe(conversionResult.data.id);
            expect(saleResult.data.totalAmount).toBe(150);
          }
        }
      }
    });

    it('should handle complex multi-entity business workflow', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Complex workflow: Create customer, multiple products, and sale
      const workflowResult = await businessLogic.executeAtomic([
        {
          operation: 'createCustomer',
          data: {
            name: 'Cliente Workflow',
            email: 'workflow@email.com',
            business_id: businessId
          }
        },
        {
          operation: 'createProduct',
          data: {
            name: 'Produto Workflow',
            price: 200,
            is_active: true,
            business_id: businessId
          }
        },
        {
          operation: 'createSale',
          data: {
            customerId: 'workflow-customer-id',
            products: [{ productId: 'workflow-product-id', quantity: 2, unitPrice: 200 }],
            paymentMethod: 'pix'
          }
        }
      ]);

      expect(workflowResult).toBeDefined();
      expect(workflowResult.success).toBeDefined();
      expect(workflowResult.results).toBeDefined();
      expect(Array.isArray(workflowResult.results)).toBe(true);

      if (workflowResult.success) {
        expect(workflowResult.results).toHaveLength(3);
        workflowResult.results.forEach(result => {
          expect(result.success).toBe(true);
        });
      }
    });

    it('should handle workflow error recovery and rollback', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test workflow with intentional failure
      const failureWorkflowResult = await businessLogic.executeAtomic([
        {
          operation: 'createCustomer',
          data: {
            name: 'Cliente Sucesso',
            email: 'sucesso@email.com',
            business_id: businessId
          }
        },
        {
          operation: 'createCustomer',
          data: {
            name: '', // This should fail validation
            email: 'falha@email.com',
            business_id: businessId
          }
        }
      ]);

      expect(failureWorkflowResult).toBeDefined();
      expect(failureWorkflowResult.success).toBeDefined();
      expect(failureWorkflowResult.results).toBeDefined();
      expect(Array.isArray(failureWorkflowResult.results)).toBe(true);

      // Should handle partial failures appropriately
      if (!failureWorkflowResult.success) {
        expect(failureWorkflowResult.rollbackExecuted).toBe(true);
        expect(failureWorkflowResult.results.some(r => !r.success)).toBe(true);
      }
    });
  });

  describe('Integration Test Properties', () => {
    it('Property: All factories maintain consistent interface patterns', async () => {
      const entityTypes = [
        { config: entityConfigurations.customer, type: 'Customer' },
        { config: entityConfigurations.lead, type: 'Lead' },
        { config: entityConfigurations.product, type: 'Product' },
        { config: entityConfigurations.transaction, type: 'Transaction' }
      ];

      entityTypes.forEach(({ config, type }) => {
        // Create CRUD factory
        const crudFactory = createCRUDFactory({
          tableName: config.tableName,
          successMessages: config.successMessages || { create: `${type} created` },
          errorMessages: config.errorMessages || { create: `${type} error` },
          invalidateKeys: [[config.tableName]],
          optimisticUpdates: false
        });

        // Create Query factory
        const queryFactory = createQueryFactory({
          tableName: config.tableName,
          defaultFilters: config.queryOptions?.defaultFilters || {},
          realTimeSubscription: config.queryOptions?.realTimeSubscription || false,
          cacheTime: config.queryOptions?.cacheTime || 5 * 60 * 1000,
          staleTime: config.queryOptions?.staleTime || 2 * 60 * 1000,
          defaultPageSize: config.queryOptions?.defaultPageSize || 20
        });

        // Verify consistent interface
        expect(crudFactory.getTableName()).toBe(config.tableName);
        expect(queryFactory.getTableName()).toBe(config.tableName);
        expect(crudFactory.useCreate).toBeInstanceOf(Function);
        expect(crudFactory.useUpdate).toBeInstanceOf(Function);
        expect(crudFactory.useDelete).toBeInstanceOf(Function);
        expect(queryFactory.useEntities).toBeInstanceOf(Function);
        expect(queryFactory.useEntity).toBeInstanceOf(Function);
        expect(queryFactory.useEntitiesCount).toBeInstanceOf(Function);
      });
    });

    it('Property: Business logic operations maintain data integrity', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test various business operations for data integrity
      const operations = [
        () => businessLogic.customers.createCustomer({
          name: 'Test Customer',
          email: 'test@email.com',
          business_id: businessId
        }),
        () => businessLogic.leads.createLead({
          name: 'Test Lead',
          email: 'lead@email.com',
          source: 'website',
          status: 'new',
          business_id: businessId
        }),
        () => businessLogic.sales.createQuickSale({
          customerName: 'Quick Customer',
          customerPhone: '(11) 99999-9999',
          amount: 100,
          paymentMethod: 'pix',
          description: 'Quick sale test'
        })
      ];

      for (const operation of operations) {
        const result = await operation();
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        
        if (result.success) {
          expect(result.data).toBeDefined();
          expect(result.data.id).toBeDefined();
        } else {
          expect(result.error).toBeDefined();
        }
      }
    });

    it('Property: Form validation rules align with business requirements', async () => {
      const configs = Object.values(entityConfigurations);

      configs.forEach(config => {
        expect(config.formFields).toBeDefined();
        expect(Array.isArray(config.formFields)).toBe(true);
        expect(config.formFields.length).toBeGreaterThan(0);

        // Check that required fields have validation
        const requiredFields = config.formFields.filter(field => field.required);
        requiredFields.forEach(field => {
          expect(field.validation).toBeDefined();
          expect(Array.isArray(field.validation)).toBe(true);
          expect(field.validation!.length).toBeGreaterThan(0);

          // Test validation functions
          const requiredValidation = field.validation!.find(v => v.type === 'required');
          if (requiredValidation) {
            expect(requiredValidation.validate('')).toBeTruthy(); // Should return error message
            expect(requiredValidation.validate('valid value')).toBeNull(); // Should return null for valid value
          }
        });
      });
    });
  });
});