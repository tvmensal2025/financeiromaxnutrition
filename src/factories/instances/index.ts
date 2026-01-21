/**
 * Factory Instances - Entry Point
 * 
 * Centralized export for all pre-configured factory instances.
 * Components should import from this module to use standardized factories.
 * 
 * @fileoverview Factory instances entry point
 * @version 1.0.0
 */

// Query factory instances
export * from './queryFactories';

// CRUD factory instances  
export * from './crudFactories';

// Form factory instances
export { customerFormFactory } from '../form/instances/customerFormFactory';
export { leadFormFactory } from '../form/instances/leadFormFactory';

// Business logic instances
export { 
  SaleCreationService,
  createSaleCreationService,
  useSaleCreationService 
} from '../business-logic/saleCreationService';

// Pattern instances
export { useModal } from '../patterns/useModal';
export { useErrorHandler } from '../patterns/useErrorHandler';
export { useApiCall } from '../patterns/useApiCall';