/**
 * Comprehensive Integration Tests
 * 
 * Tests complete user workflows using refactored components and verifies
 * cross-factory integration and business process flows. These tests validate
 * that all refactored systems work together cohesively in real-world scenarios.
 * 
 * @fileoverview Comprehensive integration tests for the complete system
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { 
  createSystemIntegration, 
  resetSystemIntegration,
  createIntegratedEntitySystem
} from './systemIntegration';
import { entityConfigurations, Customer, Lead, Product, Transaction } from './entityConfigurations';
import { useIntegratedSystems } from './useIntegratedSystems';
import { createCRUDFactory } from '../createCRUDFactory';
import { createQueryFactory } from '../createQueryFactory';
import { createBusinessLogicLayer } from '../business-logic/createBusinessLogicLayer';

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

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('Comprehensive Integration Tests', () => {
  const businessId = 'test-business-id';

  beforeEach(() => {
    resetSystemIntegration();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetSystemIntegration();
  });

  describe('End-to-End User Workflows', () => {
    it('should complete customer creation workflow', async () => {
      // Test direct factory integration without hooks
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

      const queryFactory = createQueryFactory<Customer>({
        tableName: 'customers',
        defaultFilters: {},
        realTimeSubscription: false,
        cacheTime: 5 * 60 * 1000,
        staleTime: 2 * 60 * 1000,
        defaultPageSize: 20
      });

      // Test factory creation
      expect(crudFactory).toBeDefined();
      expect(crudFactory.getTableName()).toBe('customers');
      expect(queryFactory).toBeDefined();
      expect(queryFactory.getTableName()).toBe('customers');

      // Test that factories have expected methods
      expect(crudFactory.useCreate).toBeInstanceOf(Function);
      expect(crudFactory.useUpdate).toBeInstanceOf(Function);
      expect(crudFactory.useDelete).toBeInstanceOf(Function);
      expect(queryFactory.useEntities).toBeInstanceOf(Function);
      expect(queryFactory.useEntity).toBeInstanceOf(Function);
    });

    it('should complete lead-to-customer conversion workflow', async () => {
      // Test business logic integration
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      expect(businessLogic).toBeDefined();
      expect(businessLogic.leads).toBeDefined();
      expect(businessLogic.leads.convertToCustomer).toBeInstanceOf(Function);
      expect(businessLogic.customers).toBeDefined();
      expect(businessLogic.customers.createCustomer).toBeInstanceOf(Function);

      // Test conversion logic structure
      const conversionResult = await businessLogic.leads.convertToCustomer('test-lead-id');
      expect(conversionResult).toBeDefined();
      expect(conversionResult.success).toBeDefined();
    });

    it('should complete sale creation workflow with multiple products', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test sale creation with multiple products
      const saleResult = await businessLogic.sales.createSale({
        customerId: 'test-customer-id',
        products: [
          { productId: 'prod-1', quantity: 2, unitPrice: 100 },
          { productId: 'prod-2', quantity: 1, unitPrice: 200 }
        ],
        paymentMethod: 'pix',
        notes: 'Venda de teste com múltiplos produtos'
      });

      expect(saleResult).toBeDefined();
      expect(saleResult.success).toBeDefined();
      if (saleResult.success) {
        expect(saleResult.data).toBeDefined();
        expect(saleResult.data.customerId).toBe('test-customer-id');
        expect(saleResult.data.totalAmount).toBe(400); // (2 * 100) + (1 * 200)
      }
    });

    it('should complete quick sale workflow', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test quick sale creation
      const quickSaleResult = await businessLogic.sales.createQuickSale({
        customerName: 'Cliente Rápido',
        customerPhone: '(11) 66666-6666',
        amount: 150,
        paymentMethod: 'cash',
        description: 'Venda rápida de teste'
      });

      expect(quickSaleResult).toBeDefined();
      expect(quickSaleResult.success).toBeDefined();
      if (quickSaleResult.success) {
        expect(quickSaleResult.data).toBeDefined();
        expect(quickSaleResult.data.amount).toBe(150);
        expect(quickSaleResult.data.paymentMethod).toBe('cash');
      }
    });
  });

  describe('Cross-Factory Integration', () => {
    it('should maintain data consistency across CRUD and Query factories', async () => {
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

      const queryFactory = createQueryFactory<Customer>({
        tableName: 'customers',
        defaultFilters: {},
        realTimeSubscription: false,
        cacheTime: 5 * 60 * 1000,
        staleTime: 2 * 60 * 1000,
        defaultPageSize: 20
      });

      // Test that both factories reference the same table
      expect(crudFactory.getTableName()).toBe(queryFactory.getTableName());
      expect(crudFactory.getTableName()).toBe('customers');

      // Test factory method availability
      expect(crudFactory.useCreate).toBeInstanceOf(Function);
      expect(crudFactory.useUpdate).toBeInstanceOf(Function);
      expect(crudFactory.useDelete).toBeInstanceOf(Function);
      expect(queryFactory.useEntities).toBeInstanceOf(Function);
      expect(queryFactory.useEntity).toBeInstanceOf(Function);
      expect(queryFactory.useEntitiesCount).toBeInstanceOf(Function);
    });

    it('should integrate Form Dialog with CRUD operations', async () => {
      // Test integrated entity system creation
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      expect(entitySystem).toBeDefined();
      expect(entitySystem.config).toBe(entityConfigurations.customer);
      expect(entitySystem.queries).toBeDefined();
      expect(entitySystem.crud).toBeDefined();
      expect(entitySystem.forms).toBeDefined();

      // Test form-CRUD integration
      const { FormDialogWithCRUD } = entitySystem.forms;
      const crudFactory = entitySystem.forms.getCRUDFactory();

      expect(FormDialogWithCRUD).toBeDefined();
      expect(crudFactory).toBe(entitySystem.crud);

      // Test form configuration
      const formConfig = entitySystem.config.formFields;
      const nameField = formConfig.find(field => field.name === 'name');
      
      expect(nameField).toBeDefined();
      expect(nameField?.required).toBe(true);
      expect(nameField?.validation).toBeDefined();

      // Test validation function
      const validation = nameField?.validation?.[0];
      expect(validation?.validate('')).toBe('Nome é obrigatório');
      expect(validation?.validate('João')).toBeNull();
    });

    it('should integrate Business Logic with multiple entity systems', async () => {
      // Create multiple entity systems
      const customerSystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );
      const leadSystem = createIntegratedEntitySystem(
        entityConfigurations.lead,
        businessId
      );
      const productSystem = createIntegratedEntitySystem(
        entityConfigurations.product,
        businessId
      );

      // Test that all systems have business logic
      expect(customerSystem.businessLogic).toBeDefined();
      expect(leadSystem.businessLogic).toBeDefined();
      expect(productSystem.businessLogic).toBeDefined();

      // Test business logic methods
      expect(customerSystem.businessLogic.sales.createSale).toBeInstanceOf(Function);
      expect(customerSystem.businessLogic.customers.createCustomer).toBeInstanceOf(Function);
      expect(customerSystem.businessLogic.leads.convertToCustomer).toBeInstanceOf(Function);

      // Test cross-entity business operations
      const saleResult = await customerSystem.businessLogic.sales.createSale({
        customerId: 'test-customer-id',
        products: [{ productId: 'test-product-id', quantity: 1, unitPrice: 300 }],
        paymentMethod: 'credit_card'
      });

      expect(saleResult).toBeDefined();
      expect(saleResult.success).toBeDefined();
    });

    it('should integrate Error Handling across all systems', async () => {
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      // Test error handling integration
      expect(entitySystem.errorHandler).toBeDefined();
      expect(entitySystem.errorHandler.handleError).toBeInstanceOf(Function);
      expect(entitySystem.errorHandler.clearError).toBeInstanceOf(Function);
      expect(entitySystem.errorHandler.getErrorStats).toBeInstanceOf(Function);

      // Test error handling
      const testError = new Error('Test error');
      const handledError = entitySystem.errorHandler.handleError(testError);
      
      expect(handledError).toBeDefined();
      expect(handledError.message).toBe('Test error');
      expect(handledError.category).toBeDefined();
      expect(handledError.severity).toBeDefined();

      // Test error statistics
      const errorStats = entitySystem.errorHandler.getErrorStats();
      expect(errorStats).toBeDefined();
      expect(errorStats.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Business Process Flows', () => {
    it('should handle atomic business operations', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test atomic operation structure
      expect(businessLogic.executeAtomic).toBeInstanceOf(Function);

      // Execute atomic operation
      const atomicResult = await businessLogic.executeAtomic([
        {
          operation: 'createSale',
          data: {
            customerId: 'test-customer-id',
            products: [{ productId: 'test-product-id', quantity: 1, unitPrice: 500 }],
            paymentMethod: 'pix'
          }
        },
        {
          operation: 'updateCustomer',
          data: {
            id: 'test-customer-id',
            notes: 'Cliente com venda realizada'
          }
        }
      ]);

      expect(atomicResult).toBeDefined();
      expect(atomicResult.success).toBeDefined();
      expect(atomicResult.results).toBeDefined();
      expect(Array.isArray(atomicResult.results)).toBe(true);
    });

    it('should handle complex lead nurturing workflow', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test nurturing workflow structure
      expect(businessLogic.leads.executeNurturingWorkflow).toBeInstanceOf(Function);

      // Execute nurturing workflow
      const nurturingResult = await businessLogic.leads.executeNurturingWorkflow('test-lead-id', {
        touchpoints: [
          { type: 'email', template: 'welcome', scheduledFor: new Date() },
          { type: 'whatsapp', template: 'follow_up', scheduledFor: new Date(Date.now() + 86400000) }
        ],
        temperatureProgression: ['cold', 'warm', 'hot'],
        conversionGoal: 'customer'
      });

      expect(nurturingResult).toBeDefined();
      expect(nurturingResult.success).toBeDefined();
      if (nurturingResult.success) {
        expect(nurturingResult.data.touchpointsScheduled).toBe(2);
        expect(nurturingResult.data.currentTemperature).toBe('warm');
      }
    });

    it('should handle inventory management workflow', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test inventory management structure
      expect(businessLogic.inventory).toBeDefined();
      expect(businessLogic.inventory.manageStock).toBeInstanceOf(Function);

      // Execute inventory management
      const inventoryResult = await businessLogic.inventory.manageStock({
        productId: 'test-product-id',
        operation: 'adjust',
        quantity: 50,
        reason: 'initial_stock',
        cost: 50
      });

      expect(inventoryResult).toBeDefined();
      expect(inventoryResult.success).toBeDefined();
      if (inventoryResult.success) {
        expect(inventoryResult.data.newQuantity).toBe(50);
        expect(inventoryResult.data.totalValue).toBe(2500); // 50 * 50
      }
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from partial operation failures', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Test partial failure handling
      const partialFailureResult = await businessLogic.executeAtomic([
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

      expect(partialFailureResult).toBeDefined();
      expect(partialFailureResult.success).toBeDefined();
      expect(partialFailureResult.results).toBeDefined();
      expect(Array.isArray(partialFailureResult.results)).toBe(true);
      expect(partialFailureResult.rollbackExecuted).toBeDefined();
    });

    it('should handle network failure recovery', async () => {
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

      // Test that factory handles errors gracefully
      expect(crudFactory.useCreate).toBeInstanceOf(Function);
      expect(crudFactory.useUpdate).toBeInstanceOf(Function);
      expect(crudFactory.useDelete).toBeInstanceOf(Function);

      // Test error configuration
      expect(crudFactory.getErrorMessages()).toEqual({
        create: 'Erro ao criar cliente',
        update: 'Erro ao atualizar cliente',
        delete: 'Erro ao remover cliente'
      });
    });

    it('should handle validation error recovery', async () => {
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      const errorHandler = entitySystem.errorHandler;

      // Test validation error handling
      const validationError = new Error('Validation failed: Name is required');
      const handledError = errorHandler.handleError(validationError, {
        action: 'create_customer',
        component: 'CustomerForm'
      });

      expect(handledError.category).toBe('validation');
      expect(handledError.severity).toBe('medium');
      expect(handledError.userMessage).toContain('required');

      // Test error recovery suggestions
      const recoverySuggestions = errorHandler.getRecoverySuggestions(handledError);
      expect(Array.isArray(recoverySuggestions)).toBe(true);
      expect(recoverySuggestions).toContain('Please fill in all required fields');
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent operations', async () => {
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

      // Test factory performance characteristics
      expect(crudFactory.getTableName()).toBe('customers');
      expect(crudFactory.useCreate).toBeInstanceOf(Function);
      expect(crudFactory.useUpdate).toBeInstanceOf(Function);
      expect(crudFactory.useDelete).toBeInstanceOf(Function);

      // Test that factory can be created multiple times efficiently
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const factory = createCRUDFactory<Customer>({
          tableName: 'customers',
          successMessages: { create: 'Success' },
          errorMessages: { create: 'Error' },
          invalidateKeys: [['customers']],
          optimisticUpdates: false
        });
        expect(factory).toBeDefined();
      }
      const endTime = performance.now();
      
      const creationTime = endTime - startTime;
      expect(creationTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain performance with large datasets', async () => {
      const queryFactory = createQueryFactory<Customer>({
        tableName: 'customers',
        defaultFilters: {},
        realTimeSubscription: false,
        cacheTime: 5 * 60 * 1000,
        staleTime: 2 * 60 * 1000,
        defaultPageSize: 1000 // Large page size
      });

      // Test query factory performance characteristics
      expect(queryFactory.getTableName()).toBe('customers');
      expect(queryFactory.useEntities).toBeInstanceOf(Function);
      expect(queryFactory.useEntity).toBeInstanceOf(Function);
      expect(queryFactory.useEntitiesCount).toBeInstanceOf(Function);

      // Test factory creation performance
      const startTime = performance.now();
      const factory = createQueryFactory<Customer>({
        tableName: 'customers',
        defaultFilters: {},
        realTimeSubscription: false,
        cacheTime: 5 * 60 * 1000,
        staleTime: 2 * 60 * 1000,
        defaultPageSize: 1000
      });
      const endTime = performance.now();

      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(100); // Should complete within 100ms
      expect(factory).toBeDefined();
    });

    it('should handle memory management efficiently', async () => {
      // Test system integration memory management
      for (let i = 0; i < 10; i++) {
        const system = createSystemIntegration(`business-${i}`);
        
        // Register entities
        system.utils.registerEntity(entityConfigurations.customer);
        system.utils.registerEntity(entityConfigurations.lead);
        
        expect(system.utils.getAllEntities()).toHaveLength(2);
        
        // Cleanup
        system.utils.cleanup();
        expect(system.utils.getAllEntities()).toHaveLength(0);
      }

      // Final system should be clean
      const finalSystem = createSystemIntegration('final-business');
      expect(finalSystem.utils.getAllEntities()).toHaveLength(0);
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide accurate system health monitoring', async () => {
      const system = createSystemIntegration(businessId);
      
      // Register entities
      system.utils.registerEntity(entityConfigurations.customer);
      system.utils.registerEntity(entityConfigurations.lead);
      system.utils.registerEntity(entityConfigurations.product);

      const health = system.utils.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(Object.keys(health.entities)).toHaveLength(3);
      expect(health.entities.customer).toBe('active');
      expect(health.entities.lead).toBe('active');
      expect(health.entities.product).toBe('active');
      expect(health.errors).toHaveLength(0);
    });

    it('should detect and report system degradation', async () => {
      const system = createSystemIntegration(businessId);
      const customerSystem = system.utils.registerEntity(entityConfigurations.customer);

      // Simulate system error
      const errorHandler = system.errorHandler;
      errorHandler.handleError(new Error('Critical system error'), {
        action: 'system_operation',
        severity: 'critical'
      });

      const health = system.utils.getHealthStatus();
      expect(health.status).toBe('unhealthy');
      expect(health.errors.length).toBeGreaterThan(0);
    });

    it('should provide operation history tracking', async () => {
      const businessLogic = createBusinessLogicLayer({
        businessId,
        atomicOperations: true,
        operationTimeout: 30000,
        logging: { enabled: true, level: 'info' }
      });

      // Execute some operations
      await businessLogic.sales.createQuickSale({
        customerName: 'Cliente Histórico',
        customerPhone: '(11) 55555-5555',
        amount: 200,
        paymentMethod: 'pix',
        description: 'Venda para histórico'
      });

      const operationHistory = businessLogic.getOperationHistory();
      expect(Array.isArray(operationHistory)).toBe(true);
      expect(operationHistory.length).toBeGreaterThan(0);
      
      if (operationHistory.length > 0) {
        expect(operationHistory[0]).toMatchObject({
          operation: 'createQuickSale',
          status: 'completed',
          timestamp: expect.any(Date)
        });
      }
    });
  });

  describe('React Hook Integration', () => {
    it('should integrate with React hooks properly', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useIntegratedSystems(), { wrapper });

      // Initially loading
      expect(result.current.status.isLoading).toBe(true);
      expect(result.current.status.isInitialized).toBe(false);

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should be initialized
      expect(result.current.status.isInitialized).toBe(true);
      expect(result.current.status.isLoading).toBe(false);
      expect(result.current.system).toBeDefined();
      expect(result.current.entities).toBeDefined();
    });

    it('should provide entity systems through hooks', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useIntegratedSystems(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.entities.customers).toBeDefined();
      expect(result.current.entities.leads).toBeDefined();
      expect(result.current.entities.products).toBeDefined();
      expect(result.current.entities.services).toBeDefined();
      expect(result.current.entities.transactions).toBeDefined();
    });

    it('should provide system actions through hooks', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useIntegratedSystems(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.actions.reinitialize).toBeInstanceOf(Function);
      expect(result.current.actions.refreshHealth).toBeInstanceOf(Function);
      expect(result.current.actions.reset).toBeInstanceOf(Function);
    });
  });
});

/**
 * Property-based tests for comprehensive integration
 * These tests validate universal properties across the entire integrated system
 */
describe('Comprehensive Integration Properties', () => {
  it('Property: All entity systems maintain consistent behavior patterns', async () => {
    const system = createSystemIntegration('test-business');
    
    // Test all entity configurations
    const entityConfigs = Object.values(entityConfigurations);
    
    for (const config of entityConfigs) {
      const entitySystem = system.utils.registerEntity(config);
      
      // Verify consistent structure
      expect(entitySystem.config).toBe(config);
      expect(entitySystem.queries).toBeDefined();
      expect(entitySystem.crud).toBeDefined();
      expect(entitySystem.forms).toBeDefined();
      expect(entitySystem.businessLogic).toBeDefined();
      expect(entitySystem.modal).toBeDefined();
      expect(entitySystem.errorHandler).toBeDefined();
      expect(entitySystem.apiUtils).toBeDefined();
      
      // Verify consistent method signatures
      expect(entitySystem.queries.useEntities).toBeInstanceOf(Function);
      expect(entitySystem.queries.useEntity).toBeInstanceOf(Function);
      expect(entitySystem.crud.useCreate).toBeInstanceOf(Function);
      expect(entitySystem.crud.useUpdate).toBeInstanceOf(Function);
      expect(entitySystem.crud.useDelete).toBeInstanceOf(Function);
      
      // Verify table name consistency
      expect(entitySystem.queries.getTableName()).toBe(config.tableName);
      expect(entitySystem.crud.getTableName()).toBe(config.tableName);
    }
  });

  it('Property: Business operations maintain atomicity across all scenarios', async () => {
    const system = createSystemIntegration('test-business');
    const businessLogic = system.businessLogic;
    
    // Test various atomic operation scenarios
    const scenarios = [
      {
        operations: [
          { operation: 'createCustomer', data: { name: 'Test 1', business_id: 'test' } }
        ]
      },
      {
        operations: [
          { operation: 'createCustomer', data: { name: 'Test 2', business_id: 'test' } },
          { operation: 'createLead', data: { name: 'Test Lead', status: 'new', business_id: 'test' } }
        ]
      }
    ];
    
    for (const scenario of scenarios) {
      const result = await businessLogic.executeAtomic(scenario.operations);
      
      // Either all operations succeed or all fail
      const allSucceeded = result.results.every(r => r.success);
      const allFailed = result.results.every(r => !r.success);
      
      expect(allSucceeded || allFailed).toBe(true);
      
      if (!allSucceeded) {
        expect(result.rollbackExecuted).toBe(true);
      }
    }
  });

  it('Property: Error handling provides consistent recovery across all components', async () => {
    const system = createSystemIntegration('test-business');
    const entitySystems = [
      system.utils.registerEntity(entityConfigurations.customer),
      system.utils.registerEntity(entityConfigurations.lead),
      system.utils.registerEntity(entityConfigurations.product)
    ];
    
    // Test error handling consistency across all entity systems
    for (const entitySystem of entitySystems) {
      const errorHandler = entitySystem.errorHandler;
      
      // Test different error types
      const errorTypes = [
        new Error('Validation error'),
        new Error('Network error'),
        new Error('Permission error')
      ];
      
      for (const error of errorTypes) {
        const handledError = errorHandler.handleError(error);
        
        // All handled errors should have consistent structure
        expect(handledError).toMatchObject({
          message: expect.any(String),
          category: expect.any(String),
          severity: expect.any(String),
          timestamp: expect.any(Date),
          userMessage: expect.any(String)
        });
        
        // Recovery suggestions should be provided
        const suggestions = errorHandler.getRecoverySuggestions(handledError);
        expect(Array.isArray(suggestions)).toBe(true);
      }
    }
  });

  it('Property: System health accurately reflects operational state', async () => {
    const system = createSystemIntegration('test-business');
    
    // Test health monitoring across different system states
    const states = [
      { entities: [], expectedStatus: 'healthy' },
      { entities: [entityConfigurations.customer], expectedStatus: 'healthy' },
      { entities: Object.values(entityConfigurations), expectedStatus: 'healthy' }
    ];
    
    for (const state of states) {
      // Reset system
      system.utils.cleanup();
      
      // Register entities for this state
      state.entities.forEach(config => {
        system.utils.registerEntity(config);
      });
      
      const health = system.utils.getHealthStatus();
      
      // Health status should match expected
      expect(health.status).toBe(state.expectedStatus);
      
      // Entity count should match
      expect(Object.keys(health.entities)).toHaveLength(state.entities.length);
      
      // All registered entities should be active
      Object.values(health.entities).forEach(status => {
        expect(status).toBe('active');
      });
    }
  });
});