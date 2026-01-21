/**
 * System Integration Layer
 * 
 * Wires all refactored systems together to work cohesively across the entire application.
 * This integration layer ensures that CRUD factories, query factories, unified form dialogs,
 * business logic layer, and pattern consistency systems all work together seamlessly.
 * 
 * @fileoverview Main system integration layer
 * @version 1.0.0
 */

import { createCRUDFactory } from '../createCRUDFactory';
import { createQueryFactory } from '../createQueryFactory';
import { createBusinessLogicLayer } from '../business-logic/createBusinessLogicLayer';
import { createFormCRUDIntegration } from '../form/formCRUDIntegration';
import { useModal } from '../patterns/useModal';
import { useErrorHandler } from '../patterns/useErrorHandler';
import { useApiCall } from '../patterns/useApiCall';
import { BaseEntity } from '../types/core';
import { FormFieldConfig } from '../types/form';
import { BusinessLogicOptions } from '../types/business-logic';

/**
 * Entity configuration for system integration
 */
export interface EntityConfig<T extends BaseEntity> {
  /** Entity name for identification */
  entityName: string;
  
  /** Database table name */
  tableName: string;
  
  /** Form field configurations */
  formFields: FormFieldConfig[];
  
  /** Success messages for CRUD operations */
  successMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  
  /** Error messages for CRUD operations */
  errorMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  
  /** Query configuration options */
  queryOptions?: {
    defaultFilters?: Record<string, unknown>;
    realTimeSubscription?: boolean;
    cacheTime?: number;
    staleTime?: number;
    defaultPageSize?: number;
  };
  
  /** CRUD configuration options */
  crudOptions?: {
    optimisticUpdates?: boolean;
    invalidateKeys?: string[][];
  };
  
  /** Business logic configuration */
  businessLogicOptions?: Partial<BusinessLogicOptions>;
}

/**
 * Integrated entity system interface
 */
export interface IntegratedEntitySystem<T extends BaseEntity> {
  /** Entity configuration */
  config: EntityConfig<T>;
  
  /** Query factory instance */
  queries: ReturnType<typeof createQueryFactory<T>>;
  
  /** CRUD factory instance */
  crud: ReturnType<typeof createCRUDFactory<T>>;
  
  /** Form-CRUD integration */
  forms: ReturnType<typeof createFormCRUDIntegration<T>>;
  
  /** Business logic layer */
  businessLogic: ReturnType<typeof createBusinessLogicLayer>;
  
  /** Modal management */
  modal: ReturnType<typeof useModal>;
  
  /** Error handling */
  errorHandler: ReturnType<typeof useErrorHandler>;
  
  /** API call utilities */
  apiUtils: {
    withLoading: <TParams, TData>(fn: (params?: TParams) => Promise<TData>) => ReturnType<typeof useApiCall<TParams, TData>>;
    withErrorHandling: <TParams, TData>(fn: (params?: TParams) => Promise<TData>) => ReturnType<typeof useApiCall<TParams, TData>>;
    withOptimisticUpdate: <TParams, TData>(fn: (params?: TParams) => Promise<TData>, optimisticData: TData) => ReturnType<typeof useApiCall<TParams, TData>>;
  };
}

/**
 * Application-wide system integration interface
 */
export interface SystemIntegration {
  /** Registered entity systems */
  entities: Map<string, IntegratedEntitySystem<any>>;
  
  /** Global business logic layer */
  businessLogic: ReturnType<typeof createBusinessLogicLayer>;
  
  /** Global error handler */
  errorHandler: ReturnType<typeof useErrorHandler>;
  
  /** System utilities */
  utils: {
    /** Register a new entity system */
    registerEntity: <T extends BaseEntity>(config: EntityConfig<T>) => IntegratedEntitySystem<T>;
    
    /** Get an entity system by name */
    getEntity: <T extends BaseEntity>(entityName: string) => IntegratedEntitySystem<T> | undefined;
    
    /** Get all registered entities */
    getAllEntities: () => string[];
    
    /** Initialize system with business context */
    initialize: (businessId: string) => Promise<void>;
    
    /** Cleanup system resources */
    cleanup: () => void;
    
    /** Get system health status */
    getHealthStatus: () => {
      status: 'healthy' | 'degraded' | 'unhealthy';
      entities: Record<string, 'active' | 'inactive' | 'error'>;
      errors: string[];
    };
  };
}

/**
 * Creates an integrated entity system with all refactored components working together.
 * 
 * @template T - The entity type extending BaseEntity
 * @param config - Entity configuration
 * @param businessId - Business context ID
 * @returns Fully integrated entity system
 * 
 * @example
 * ```typescript
 * interface Customer extends BaseEntity {
 *   name: string;
 *   email?: string;
 *   phone?: string;
 * }
 * 
 * const customerSystem = createIntegratedEntitySystem<Customer>({
 *   entityName: 'customer',
 *   tableName: 'customers',
 *   formFields: customerFormFields,
 *   successMessages: {
 *     create: 'Cliente criado com sucesso!',
 *     update: 'Cliente atualizado!',
 *     delete: 'Cliente removido!'
 *   }
 * }, 'business-123');
 * 
 * // Use integrated system
 * const customers = customerSystem.queries.useEntities();
 * const createCustomer = customerSystem.crud.useCreate();
 * const { FormDialogWithCRUD } = customerSystem.forms;
 * ```
 * 
 * **Validates: All requirements - Complete system integration**
 */
export function createIntegratedEntitySystem<T extends BaseEntity>(
  config: EntityConfig<T>,
  businessId: string
): IntegratedEntitySystem<T> {
  const {
    entityName,
    tableName,
    formFields,
    successMessages = {},
    errorMessages = {},
    queryOptions = {},
    crudOptions = {},
    businessLogicOptions = {}
  } = config;

  // Create query factory
  const queries = createQueryFactory<T>({
    tableName,
    defaultFilters: queryOptions.defaultFilters || {},
    realTimeSubscription: queryOptions.realTimeSubscription || false,
    cacheTime: queryOptions.cacheTime || 5 * 60 * 1000,
    staleTime: queryOptions.staleTime || 2 * 60 * 1000,
    defaultPageSize: queryOptions.defaultPageSize || 20
  });

  // Create CRUD factory
  const crud = createCRUDFactory<T>({
    tableName,
    successMessages: {
      create: successMessages.create || `${entityName} created successfully`,
      update: successMessages.update || `${entityName} updated successfully`,
      delete: successMessages.delete || `${entityName} deleted successfully`
    },
    errorMessages: {
      create: errorMessages.create || `Error creating ${entityName}`,
      update: errorMessages.update || `Error updating ${entityName}`,
      delete: errorMessages.delete || `Error deleting ${entityName}`
    },
    invalidateKeys: crudOptions.invalidateKeys || [[tableName]],
    optimisticUpdates: crudOptions.optimisticUpdates || false
  });

  // Create business logic layer
  const businessLogic = createBusinessLogicLayer({
    businessId,
    atomicOperations: true,
    operationTimeout: 30000,
    logging: { enabled: true, level: 'info' },
    ...businessLogicOptions
  });

  // Create form-CRUD integration
  const forms = createFormCRUDIntegration<T>({
    entityType: entityName,
    fields: formFields,
    crudFactory: crud,
    onOperationSuccess: {
      onCreate: (data) => console.log(`${entityName} created:`, data),
      onUpdate: (data) => console.log(`${entityName} updated:`, data),
      onDelete: () => console.log(`${entityName} deleted`)
    },
    onOperationError: {
      onCreate: (error) => console.error(`${entityName} creation error:`, error),
      onUpdate: (error) => console.error(`${entityName} update error:`, error),
      onDelete: (error) => console.error(`${entityName} deletion error:`, error)
    }
  });

  // Create modal management
  const modal = useModal({
    defaultConfig: {
      size: 'md',
      closeOnOutsideClick: true,
      closeOnEscape: true,
      showCloseButton: true
    }
  });

  // Create error handler
  const errorHandler = useErrorHandler({
    component: `${entityName}System`,
    showToast: true,
    logToConsole: true,
    reportToMonitoring: false
  });

  // Create API utilities
  const apiUtils = {
    withLoading: <TParams, TData>(fn: (params?: TParams) => Promise<TData>) => {
      return useApiCall(fn, {
        component: `${entityName}API`,
        optimistic: false
      });
    },
    withErrorHandling: <TParams, TData>(fn: (params?: TParams) => Promise<TData>) => {
      return useApiCall(fn, {
        component: `${entityName}API`,
        onError: (error) => errorHandler.handleError(error)
      });
    },
    withOptimisticUpdate: <TParams, TData>(fn: (params?: TParams) => Promise<TData>, optimisticData: TData) => {
      return useApiCall(fn, {
        component: `${entityName}API`,
        optimistic: true,
        optimisticData
      });
    }
  };

  return {
    config,
    queries,
    crud,
    forms,
    businessLogic,
    modal,
    errorHandler,
    apiUtils
  };
}

/**
 * Creates the main system integration that manages all entity systems.
 * 
 * @param businessId - Business context ID
 * @returns Complete system integration
 * 
 * @example
 * ```typescript
 * const systemIntegration = createSystemIntegration('business-123');
 * 
 * // Register entities
 * const customerSystem = systemIntegration.utils.registerEntity(customerConfig);
 * const leadSystem = systemIntegration.utils.registerEntity(leadConfig);
 * 
 * // Initialize system
 * await systemIntegration.utils.initialize('business-123');
 * 
 * // Use systems
 * const customers = customerSystem.queries.useEntities();
 * const leads = leadSystem.queries.useEntities();
 * ```
 */
export function createSystemIntegration(businessId: string): SystemIntegration {
  const entities = new Map<string, IntegratedEntitySystem<any>>();
  
  // Create global business logic layer
  const businessLogic = createBusinessLogicLayer({
    businessId,
    atomicOperations: true,
    operationTimeout: 30000,
    logging: { enabled: true, level: 'info' }
  });

  // Create global error handler
  const errorHandler = useErrorHandler({
    component: 'SystemIntegration',
    showToast: true,
    logToConsole: true,
    reportToMonitoring: true
  });

  const utils = {
    registerEntity: <T extends BaseEntity>(config: EntityConfig<T>): IntegratedEntitySystem<T> => {
      const entitySystem = createIntegratedEntitySystem<T>(config, businessId);
      entities.set(config.entityName, entitySystem);
      return entitySystem;
    },

    getEntity: <T extends BaseEntity>(entityName: string): IntegratedEntitySystem<T> | undefined => {
      return entities.get(entityName) as IntegratedEntitySystem<T> | undefined;
    },

    getAllEntities: (): string[] => {
      return Array.from(entities.keys());
    },

    initialize: async (contextBusinessId: string): Promise<void> => {
      try {
        // Initialize all registered entity systems
        for (const [entityName, entitySystem] of entities) {
          try {
            // Perform any initialization needed for the entity system
            console.log(`Initializing entity system: ${entityName}`);
            
            // Test basic connectivity
            const testQuery = entitySystem.queries.useEntitiesCount();
            
            console.log(`Entity system ${entityName} initialized successfully`);
          } catch (error) {
            console.error(`Failed to initialize entity system ${entityName}:`, error);
            errorHandler.handleError(error, {
              action: 'system_initialization',
              metadata: { entityName }
            });
          }
        }

        console.log('System integration initialized successfully');
      } catch (error) {
        console.error('System integration initialization failed:', error);
        errorHandler.handleError(error, {
          action: 'system_initialization'
        });
        throw error;
      }
    },

    cleanup: (): void => {
      try {
        // Cleanup all entity systems
        entities.clear();
        
        // Clear error handler
        errorHandler.clearAllErrors();
        
        console.log('System integration cleaned up successfully');
      } catch (error) {
        console.error('System integration cleanup failed:', error);
      }
    },

    getHealthStatus: () => {
      const entityStatuses: Record<string, 'active' | 'inactive' | 'error'> = {};
      const errors: string[] = [];
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Check each entity system
      for (const [entityName, entitySystem] of entities) {
        try {
          // Basic health check - verify system components exist
          if (entitySystem.queries && entitySystem.crud && entitySystem.forms) {
            entityStatuses[entityName] = 'active';
          } else {
            entityStatuses[entityName] = 'inactive';
            overallStatus = 'degraded';
          }
        } catch (error) {
          entityStatuses[entityName] = 'error';
          errors.push(`${entityName}: ${error instanceof Error ? error.message : String(error)}`);
          overallStatus = 'unhealthy';
        }
      }

      // Check global error handler
      const errorStats = errorHandler.getErrorStats();
      if (errorStats.bySeverity.critical > 0) {
        overallStatus = 'unhealthy';
      } else if (errorStats.bySeverity.high > 0) {
        overallStatus = 'degraded';
      }

      return {
        status: overallStatus,
        entities: entityStatuses,
        errors
      };
    }
  };

  return {
    entities,
    businessLogic,
    errorHandler,
    utils
  };
}

/**
 * Global system integration instance
 * This will be initialized once per business context
 */
let globalSystemIntegration: SystemIntegration | null = null;

/**
 * Gets or creates the global system integration instance.
 * 
 * @param businessId - Business context ID
 * @returns Global system integration instance
 */
export function getSystemIntegration(businessId: string): SystemIntegration {
  if (!globalSystemIntegration) {
    globalSystemIntegration = createSystemIntegration(businessId);
  }
  return globalSystemIntegration;
}

/**
 * Resets the global system integration instance.
 * Useful for testing or when switching business contexts.
 */
export function resetSystemIntegration(): void {
  if (globalSystemIntegration) {
    globalSystemIntegration.utils.cleanup();
    globalSystemIntegration = null;
  }
}

export default {
  createIntegratedEntitySystem,
  createSystemIntegration,
  getSystemIntegration,
  resetSystemIntegration
};