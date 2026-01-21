/**
 * Factory Infrastructure - Entry Point
 * 
 * This module provides the main exports for the factory system that eliminates
 * code duplication through generic factories for CRUD operations, query hooks,
 * and form dialogs.
 * 
 * @fileoverview Advanced refactoring factory system entry point
 * @version 1.0.0
 */

// Core factory types and interfaces
export * from './types/core';
export * from './types/crud';
export * from './types/query';
export * from './types/form';
export * from './types/business-logic';

// Factory implementations
export { createCRUDFactory } from './createCRUDFactory';
export { createQueryFactory } from './createQueryFactory';
// export * from './form/createFormFactory';
// export * from './business-logic/createBusinessLogicLayer';

// Pre-configured factory instances (recommended for components)
export * from './instances';

// Utility types and helpers
export * from './utils/type-helpers';
export * from './utils/validation-helpers';