/**
 * Integration Layer Exports
 * 
 * Main entry point for the integrated systems layer.
 * Exports all components needed to use the fully integrated refactored systems.
 * 
 * @fileoverview Integration layer exports
 * @version 1.0.0
 */

// Core integration
export {
  createSystemIntegration,
  createIntegratedEntitySystem,
  getSystemIntegration,
  resetSystemIntegration,
  type SystemIntegration,
  type IntegratedEntitySystem,
  type EntityConfig
} from './systemIntegration';

// Entity configurations
export {
  entityConfigurations,
  customerConfig,
  leadConfig,
  productConfig,
  serviceConfig,
  transactionConfig,
  type Customer,
  type Lead,
  type Product,
  type Service,
  type Transaction
} from './entityConfigurations';

// React hooks
export {
  useIntegratedSystems,
  useEntitySystem,
  useBusinessLogic,
  useGlobalErrorHandler,
  useSystemHealth,
  type IntegratedSystems,
  type UseIntegratedSystemsOptions
} from './useIntegratedSystems';

// Demo component
export { IntegratedSystemsDemo } from './IntegratedSystemsDemo';

// Default export for convenience
export { default } from './systemIntegration';