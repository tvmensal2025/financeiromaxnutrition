/**
 * Integrated Systems Hook
 * 
 * React hook that provides easy access to all integrated systems.
 * This hook initializes and manages the system integration for React components.
 * 
 * @fileoverview React hook for integrated systems
 * @version 1.0.0
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getSystemIntegration, 
  resetSystemIntegration, 
  SystemIntegration,
  IntegratedEntitySystem 
} from './systemIntegration';
import { 
  entityConfigurations,
  Customer,
  Lead,
  Product,
  Service,
  Transaction
} from './entityConfigurations';

/**
 * Integrated systems interface for React components
 */
export interface IntegratedSystems {
  /** System integration instance */
  system: SystemIntegration;
  
  /** Entity systems */
  entities: {
    customers: IntegratedEntitySystem<Customer>;
    leads: IntegratedEntitySystem<Lead>;
    products: IntegratedEntitySystem<Product>;
    services: IntegratedEntitySystem<Service>;
    transactions: IntegratedEntitySystem<Transaction>;
  };
  
  /** System status */
  status: {
    isInitialized: boolean;
    isLoading: boolean;
    error: string | null;
    health: ReturnType<SystemIntegration['utils']['getHealthStatus']> | null;
  };
  
  /** System actions */
  actions: {
    /** Reinitialize the system */
    reinitialize: () => Promise<void>;
    
    /** Refresh system health */
    refreshHealth: () => void;
    
    /** Reset and cleanup system */
    reset: () => void;
  };
}

/**
 * Hook options
 */
export interface UseIntegratedSystemsOptions {
  /** Whether to auto-initialize on mount */
  autoInitialize?: boolean;
  
  /** Whether to monitor system health */
  monitorHealth?: boolean;
  
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
}

/**
 * React hook for accessing integrated systems.
 * 
 * @param options - Hook configuration options
 * @returns Integrated systems interface
 * 
 * @example
 * ```tsx
 * function CustomerManagement() {
 *   const { entities, status, actions } = useIntegratedSystems();
 *   
 *   // Use customer system
 *   const customers = entities.customers.queries.useEntities();
 *   const createCustomer = entities.customers.crud.useCreate();
 *   const { FormDialogWithCRUD } = entities.customers.forms;
 *   
 *   if (status.isLoading) {
 *     return <div>Loading systems...</div>;
 *   }
 *   
 *   if (status.error) {
 *     return <div>Error: {status.error}</div>;
 *   }
 *   
 *   return (
 *     <div>
 *       <h1>Customers</h1>
 *       {customers.data?.map(customer => (
 *         <div key={customer.id}>{customer.name}</div>
 *       ))}
 *       
 *       <FormDialogWithCRUD
 *         isOpen={isDialogOpen}
 *         onClose={() => setIsDialogOpen(false)}
 *         mode="create"
 *       />
 *     </div>
 *   );
 * }
 * ```
 * 
 * **Validates: All requirements - Complete system integration for React components**
 */
export function useIntegratedSystems(
  options: UseIntegratedSystemsOptions = {}
): IntegratedSystems {
  const {
    autoInitialize = true,
    monitorHealth = true,
    healthCheckInterval = 30000 // 30 seconds
  } = options;

  const { business } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<ReturnType<SystemIntegration['utils']['getHealthStatus']> | null>(null);
  const [system, setSystem] = useState<SystemIntegration | null>(null);

  // Initialize system integration
  const initializeSystem = useCallback(async () => {
    if (!business?.id) {
      setError('Business context is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get or create system integration
      const systemIntegration = getSystemIntegration(business.id);
      
      // Register all entity systems
      const customerSystem = systemIntegration.utils.registerEntity(entityConfigurations.customer);
      const leadSystem = systemIntegration.utils.registerEntity(entityConfigurations.lead);
      const productSystem = systemIntegration.utils.registerEntity(entityConfigurations.product);
      const serviceSystem = systemIntegration.utils.registerEntity(entityConfigurations.service);
      const transactionSystem = systemIntegration.utils.registerEntity(entityConfigurations.transaction);

      // Initialize the system
      await systemIntegration.utils.initialize(business.id);

      setSystem(systemIntegration);
      setIsInitialized(true);
      
      // Initial health check
      if (monitorHealth) {
        const healthStatus = systemIntegration.utils.getHealthStatus();
        setHealth(healthStatus);
      }

      console.log('Integrated systems initialized successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize systems';
      setError(errorMessage);
      console.error('Failed to initialize integrated systems:', err);
    } finally {
      setIsLoading(false);
    }
  }, [business?.id, monitorHealth]);

  // Reinitialize system
  const reinitialize = useCallback(async () => {
    setIsInitialized(false);
    resetSystemIntegration();
    await initializeSystem();
  }, [initializeSystem]);

  // Refresh health status
  const refreshHealth = useCallback(() => {
    if (system && monitorHealth) {
      const healthStatus = system.utils.getHealthStatus();
      setHealth(healthStatus);
    }
  }, [system, monitorHealth]);

  // Reset system
  const reset = useCallback(() => {
    setIsInitialized(false);
    setSystem(null);
    setHealth(null);
    setError(null);
    resetSystemIntegration();
  }, []);

  // Auto-initialize on mount or business change
  useEffect(() => {
    if (autoInitialize && business?.id && !isInitialized && !isLoading) {
      initializeSystem();
    }
  }, [autoInitialize, business?.id, isInitialized, isLoading, initializeSystem]);

  // Health monitoring
  useEffect(() => {
    if (!monitorHealth || !system || !isInitialized) return;

    const interval = setInterval(() => {
      refreshHealth();
    }, healthCheckInterval);

    return () => clearInterval(interval);
  }, [monitorHealth, system, isInitialized, healthCheckInterval, refreshHealth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (system) {
        system.utils.cleanup();
      }
    };
  }, [system]);

  // Create entity systems interface
  const entities = system ? {
    customers: system.utils.getEntity<Customer>('customer')!,
    leads: system.utils.getEntity<Lead>('lead')!,
    products: system.utils.getEntity<Product>('product')!,
    services: system.utils.getEntity<Service>('service')!,
    transactions: system.utils.getEntity<Transaction>('transaction')!
  } : {
    customers: null as any,
    leads: null as any,
    products: null as any,
    services: null as any,
    transactions: null as any
  };

  return {
    system: system!,
    entities,
    status: {
      isInitialized,
      isLoading,
      error,
      health
    },
    actions: {
      reinitialize,
      refreshHealth,
      reset
    }
  };
}

/**
 * Hook for accessing a specific entity system.
 * 
 * @param entityName - Name of the entity system to access
 * @returns Entity system or null if not available
 * 
 * @example
 * ```tsx
 * function CustomerList() {
 *   const customerSystem = useEntitySystem<Customer>('customer');
 *   
 *   if (!customerSystem) {
 *     return <div>Loading customer system...</div>;
 *   }
 *   
 *   const customers = customerSystem.queries.useEntities();
 *   const createCustomer = customerSystem.crud.useCreate();
 *   
 *   return (
 *     <div>
 *       {customers.data?.map(customer => (
 *         <div key={customer.id}>{customer.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useEntitySystem<T extends { id: string }>(
  entityName: string
): IntegratedEntitySystem<T> | null {
  const { system, status } = useIntegratedSystems();
  
  if (!status.isInitialized || !system) {
    return null;
  }
  
  return system.utils.getEntity<T>(entityName) || null;
}

/**
 * Hook for accessing the global business logic layer.
 * 
 * @returns Business logic layer or null if not available
 * 
 * @example
 * ```tsx
 * function SaleCreation() {
 *   const businessLogic = useBusinessLogic();
 *   
 *   const handleCreateSale = async () => {
 *     if (!businessLogic) return;
 *     
 *     const result = await businessLogic.sales.createSale({
 *       products: [{ productId: 'prod-1', quantity: 1, unitPrice: 100 }],
 *       paymentMethod: 'pix'
 *     });
 *     
 *     if (result.success) {
 *       console.log('Sale created:', result.data);
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handleCreateSale}>
 *       Create Sale
 *     </button>
 *   );
 * }
 * ```
 */
export function useBusinessLogic() {
  const { system, status } = useIntegratedSystems();
  
  if (!status.isInitialized || !system) {
    return null;
  }
  
  return system.businessLogic;
}

/**
 * Hook for accessing the global error handler.
 * 
 * @returns Error handler or null if not available
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const errorHandler = useGlobalErrorHandler();
 *   
 *   const handleOperation = async () => {
 *     try {
 *       await someRiskyOperation();
 *     } catch (error) {
 *       errorHandler?.handleError(error, {
 *         action: 'risky_operation',
 *         component: 'MyComponent'
 *       });
 *     }
 *   };
 *   
 *   return <button onClick={handleOperation}>Do Something</button>;
 * }
 * ```
 */
export function useGlobalErrorHandler() {
  const { system, status } = useIntegratedSystems();
  
  if (!status.isInitialized || !system) {
    return null;
  }
  
  return system.errorHandler;
}

/**
 * Hook for monitoring system health.
 * 
 * @returns System health status
 * 
 * @example
 * ```tsx
 * function SystemHealthIndicator() {
 *   const health = useSystemHealth();
 *   
 *   if (!health) return null;
 *   
 *   const statusColor = {
 *     healthy: 'green',
 *     degraded: 'yellow',
 *     unhealthy: 'red'
 *   }[health.status];
 *   
 *   return (
 *     <div style={{ color: statusColor }}>
 *       System Status: {health.status}
 *       {health.errors.length > 0 && (
 *         <ul>
 *           {health.errors.map((error, i) => (
 *             <li key={i}>{error}</li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSystemHealth() {
  const { status } = useIntegratedSystems();
  return status.health;
}

export default useIntegratedSystems;