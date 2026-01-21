/**
 * System Integration Tests
 * 
 * Comprehensive tests to verify that all refactored systems work together cohesively.
 * Tests CRUD factories, query factories, form dialogs, business logic, and patterns.
 * 
 * @fileoverview Integration tests for the complete system
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { 
  createSystemIntegration, 
  createIntegratedEntitySystem,
  resetSystemIntegration 
} from './systemIntegration';
import { entityConfigurations, Customer, Lead } from './entityConfigurations';
import { useIntegratedSystems } from './useIntegratedSystems';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'test-id', name: 'Test Entity' },
            error: null
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'test-id', name: 'Updated Entity' },
              error: null
            }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          error: null
        }))
      }))
    }))
  }
}));

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
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('System Integration', () => {
  const businessId = 'test-business-id';

  beforeEach(() => {
    resetSystemIntegration();
  });

  afterEach(() => {
    resetSystemIntegration();
  });

  describe('createSystemIntegration', () => {
    it('should create a system integration with all utilities', () => {
      const system = createSystemIntegration(businessId);

      expect(system).toBeDefined();
      expect(system.entities).toBeInstanceOf(Map);
      expect(system.businessLogic).toBeDefined();
      expect(system.errorHandler).toBeDefined();
      expect(system.utils).toBeDefined();
      expect(system.utils.registerEntity).toBeInstanceOf(Function);
      expect(system.utils.getEntity).toBeInstanceOf(Function);
      expect(system.utils.getAllEntities).toBeInstanceOf(Function);
      expect(system.utils.initialize).toBeInstanceOf(Function);
      expect(system.utils.cleanup).toBeInstanceOf(Function);
      expect(system.utils.getHealthStatus).toBeInstanceOf(Function);
    });

    it('should register and retrieve entity systems', () => {
      const system = createSystemIntegration(businessId);
      
      const customerSystem = system.utils.registerEntity(entityConfigurations.customer);
      expect(customerSystem).toBeDefined();
      expect(customerSystem.config.entityName).toBe('customer');
      expect(customerSystem.queries).toBeDefined();
      expect(customerSystem.crud).toBeDefined();
      expect(customerSystem.forms).toBeDefined();
      expect(customerSystem.businessLogic).toBeDefined();

      const retrievedSystem = system.utils.getEntity<Customer>('customer');
      expect(retrievedSystem).toBe(customerSystem);

      const allEntities = system.utils.getAllEntities();
      expect(allEntities).toContain('customer');
    });

    it('should provide health status monitoring', () => {
      const system = createSystemIntegration(businessId);
      
      // Register some entities
      system.utils.registerEntity(entityConfigurations.customer);
      system.utils.registerEntity(entityConfigurations.lead);

      const health = system.utils.getHealthStatus();
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.entities).toBeDefined();
      expect(health.entities.customer).toBeDefined();
      expect(health.entities.lead).toBeDefined();
      expect(health.errors).toBeInstanceOf(Array);
    });

    it('should cleanup resources properly', () => {
      const system = createSystemIntegration(businessId);
      
      system.utils.registerEntity(entityConfigurations.customer);
      expect(system.utils.getAllEntities()).toContain('customer');

      system.utils.cleanup();
      expect(system.utils.getAllEntities()).toHaveLength(0);
    });
  });

  describe('createIntegratedEntitySystem', () => {
    it('should create a complete entity system with all components', () => {
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      expect(entitySystem).toBeDefined();
      expect(entitySystem.config).toBe(entityConfigurations.customer);
      expect(entitySystem.queries).toBeDefined();
      expect(entitySystem.crud).toBeDefined();
      expect(entitySystem.forms).toBeDefined();
      expect(entitySystem.businessLogic).toBeDefined();
      expect(entitySystem.modal).toBeDefined();
      expect(entitySystem.errorHandler).toBeDefined();
      expect(entitySystem.apiUtils).toBeDefined();
    });

    it('should have working CRUD operations', () => {
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      expect(entitySystem.crud.useCreate).toBeInstanceOf(Function);
      expect(entitySystem.crud.useUpdate).toBeInstanceOf(Function);
      expect(entitySystem.crud.useDelete).toBeInstanceOf(Function);
      expect(entitySystem.crud.getTableName()).toBe('customers');
    });

    it('should have working query operations', () => {
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      expect(entitySystem.queries.useEntities).toBeInstanceOf(Function);
      expect(entitySystem.queries.useEntity).toBeInstanceOf(Function);
      expect(entitySystem.queries.useEntitiesInfinite).toBeInstanceOf(Function);
      expect(entitySystem.queries.useEntitiesCount).toBeInstanceOf(Function);
      expect(entitySystem.queries.getTableName()).toBe('customers');
    });

    it('should have integrated form components', () => {
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      expect(entitySystem.forms.FormDialogWithCRUD).toBeDefined();
      expect(entitySystem.forms.crud).toBe(entitySystem.crud);
      expect(entitySystem.forms.getCRUDFactory()).toBe(entitySystem.crud);
    });

    it('should have business logic integration', () => {
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      expect(entitySystem.businessLogic.sales).toBeDefined();
      expect(entitySystem.businessLogic.customers).toBeDefined();
      expect(entitySystem.businessLogic.leads).toBeDefined();
      expect(entitySystem.businessLogic.executeAtomic).toBeInstanceOf(Function);
      expect(entitySystem.businessLogic.getOperationHistory).toBeInstanceOf(Function);
    });

    it('should have pattern utilities', () => {
      const entitySystem = createIntegratedEntitySystem(
        entityConfigurations.customer,
        businessId
      );

      expect(entitySystem.modal.open).toBeInstanceOf(Function);
      expect(entitySystem.modal.close).toBeInstanceOf(Function);
      expect(entitySystem.modal.toggle).toBeInstanceOf(Function);

      expect(entitySystem.errorHandler.handleError).toBeInstanceOf(Function);
      expect(entitySystem.errorHandler.clearError).toBeInstanceOf(Function);
      expect(entitySystem.errorHandler.clearAllErrors).toBeInstanceOf(Function);

      expect(entitySystem.apiUtils.withLoading).toBeInstanceOf(Function);
      expect(entitySystem.apiUtils.withErrorHandling).toBeInstanceOf(Function);
      expect(entitySystem.apiUtils.withOptimisticUpdate).toBeInstanceOf(Function);
    });
  });

  describe('useIntegratedSystems Hook', () => {
    it('should initialize systems automatically', async () => {
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

    it('should provide entity systems', async () => {
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

    it('should provide system actions', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useIntegratedSystems(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.actions.reinitialize).toBeInstanceOf(Function);
      expect(result.current.actions.refreshHealth).toBeInstanceOf(Function);
      expect(result.current.actions.reset).toBeInstanceOf(Function);
    });

    it('should monitor system health', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => 
        useIntegratedSystems({ monitorHealth: true }), 
        { wrapper }
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.status.health).toBeDefined();
      expect(result.current.status.health?.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.current.status.health?.entities).toBeDefined();
    });

    it('should handle reinitialization', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useIntegratedSystems(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.status.isInitialized).toBe(true);

      // Reinitialize
      await act(async () => {
        await result.current.actions.reinitialize();
      });

      expect(result.current.status.isInitialized).toBe(true);
    });

    it('should handle system reset', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useIntegratedSystems(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.status.isInitialized).toBe(true);

      // Reset
      act(() => {
        result.current.actions.reset();
      });

      expect(result.current.status.isInitialized).toBe(false);
      expect(result.current.system).toBeNull();
    });
  });

  describe('End-to-End Integration', () => {
    it('should support complete CRUD workflow', async () => {
      const system = createSystemIntegration(businessId);
      const customerSystem = system.utils.registerEntity(entityConfigurations.customer);

      // Test that all components are wired together
      expect(customerSystem.queries.getTableName()).toBe('customers');
      expect(customerSystem.crud.getTableName()).toBe('customers');
      expect(customerSystem.forms.getCRUDFactory()).toBe(customerSystem.crud);

      // Test configuration consistency
      expect(customerSystem.config.tableName).toBe('customers');
      expect(customerSystem.config.entityName).toBe('customer');
      expect(customerSystem.config.formFields).toBeDefined();
      expect(customerSystem.config.formFields.length).toBeGreaterThan(0);
    });

    it('should support business logic operations', async () => {
      const system = createSystemIntegration(businessId);
      const customerSystem = system.utils.registerEntity(entityConfigurations.customer);

      // Test business logic integration
      expect(customerSystem.businessLogic.sales.createSale).toBeInstanceOf(Function);
      expect(customerSystem.businessLogic.sales.createQuickSale).toBeInstanceOf(Function);
      expect(customerSystem.businessLogic.customers.createCustomer).toBeInstanceOf(Function);
      expect(customerSystem.businessLogic.leads.createLead).toBeInstanceOf(Function);
    });

    it('should support pattern consistency', async () => {
      const system = createSystemIntegration(businessId);
      const customerSystem = system.utils.registerEntity(entityConfigurations.customer);

      // Test modal patterns
      expect(customerSystem.modal.isOpen).toBe(false);
      act(() => {
        customerSystem.modal.open({ name: 'Test Customer' });
      });
      expect(customerSystem.modal.isOpen).toBe(true);
      expect(customerSystem.modal.data).toEqual({ name: 'Test Customer' });

      // Test error handling patterns
      const testError = new Error('Test error');
      const standardizedError = customerSystem.errorHandler.handleError(testError);
      expect(standardizedError.message).toBe('Test error');
      expect(standardizedError.category).toBeDefined();
      expect(standardizedError.severity).toBeDefined();

      // Test API utilities
      expect(customerSystem.apiUtils.withLoading).toBeInstanceOf(Function);
      expect(customerSystem.apiUtils.withErrorHandling).toBeInstanceOf(Function);
      expect(customerSystem.apiUtils.withOptimisticUpdate).toBeInstanceOf(Function);
    });

    it('should maintain data consistency across systems', async () => {
      const system = createSystemIntegration(businessId);
      
      // Register multiple entity systems
      const customerSystem = system.utils.registerEntity(entityConfigurations.customer);
      const leadSystem = system.utils.registerEntity(entityConfigurations.lead);
      const productSystem = system.utils.registerEntity(entityConfigurations.product);

      // All systems should share the same business logic instance
      expect(customerSystem.businessLogic).toBe(system.businessLogic);
      expect(leadSystem.businessLogic).toBe(system.businessLogic);
      expect(productSystem.businessLogic).toBe(system.businessLogic);

      // All systems should have consistent configuration
      expect(customerSystem.config.entityName).toBe('customer');
      expect(leadSystem.config.entityName).toBe('lead');
      expect(productSystem.config.entityName).toBe('product');
    });

    it('should handle system health monitoring', async () => {
      const system = createSystemIntegration(businessId);
      
      // Register entities
      system.utils.registerEntity(entityConfigurations.customer);
      system.utils.registerEntity(entityConfigurations.lead);

      const health = system.utils.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.entities.customer).toBe('active');
      expect(health.entities.lead).toBe('active');
      expect(health.errors).toHaveLength(0);
    });
  });
});

/**
 * Property-based test for system integration
 * Validates that the system maintains consistency across all operations
 */
describe('System Integration Properties', () => {
  it('Property: All registered entities maintain consistent configuration', () => {
    const system = createSystemIntegration('test-business');
    
    // Register all entity configurations
    Object.values(entityConfigurations).forEach(config => {
      const entitySystem = system.utils.registerEntity(config);
      
      // Verify configuration consistency
      expect(entitySystem.config).toBe(config);
      expect(entitySystem.queries.getTableName()).toBe(config.tableName);
      expect(entitySystem.crud.getTableName()).toBe(config.tableName);
      
      // Verify form integration
      expect(entitySystem.forms.getCRUDFactory()).toBe(entitySystem.crud);
      
      // Verify business logic sharing
      expect(entitySystem.businessLogic).toBe(system.businessLogic);
    });
  });

  it('Property: System health accurately reflects entity states', () => {
    const system = createSystemIntegration('test-business');
    
    // Initially no entities
    let health = system.utils.getHealthStatus();
    expect(Object.keys(health.entities)).toHaveLength(0);
    
    // Register entities one by one
    const configs = Object.values(entityConfigurations);
    configs.forEach((config, index) => {
      system.utils.registerEntity(config);
      health = system.utils.getHealthStatus();
      
      expect(Object.keys(health.entities)).toHaveLength(index + 1);
      expect(health.entities[config.entityName]).toBe('active');
    });
  });

  it('Property: All entity systems provide complete functionality', () => {
    const system = createSystemIntegration('test-business');
    
    Object.values(entityConfigurations).forEach(config => {
      const entitySystem = system.utils.registerEntity(config);
      
      // Verify all required components exist
      expect(entitySystem.queries).toBeDefined();
      expect(entitySystem.crud).toBeDefined();
      expect(entitySystem.forms).toBeDefined();
      expect(entitySystem.businessLogic).toBeDefined();
      expect(entitySystem.modal).toBeDefined();
      expect(entitySystem.errorHandler).toBeDefined();
      expect(entitySystem.apiUtils).toBeDefined();
      
      // Verify all required methods exist
      expect(entitySystem.queries.useEntities).toBeInstanceOf(Function);
      expect(entitySystem.queries.useEntity).toBeInstanceOf(Function);
      expect(entitySystem.crud.useCreate).toBeInstanceOf(Function);
      expect(entitySystem.crud.useUpdate).toBeInstanceOf(Function);
      expect(entitySystem.crud.useDelete).toBeInstanceOf(Function);
      expect(entitySystem.forms.FormDialogWithCRUD).toBeDefined();
    });
  });
});