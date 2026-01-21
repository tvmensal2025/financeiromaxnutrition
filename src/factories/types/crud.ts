/**
 * CRUD Factory Types
 * 
 * Type definitions for the generic CRUD factory system that generates
 * type-safe create, read, update, delete operations for any entity type.
 * 
 * @fileoverview CRUD factory type definitions
 * @version 1.0.0
 */

import { UseMutationResult } from '@tanstack/react-query';
import { 
  BaseEntity, 
  BaseFactoryOptions, 
  CreateData, 
  UpdateData, 
  FactoryError,
  SuccessCallback,
  ErrorCallback
} from './core';

/**
 * CRUD operation types that the factory can perform.
 */
export type CRUDOperation = 'create' | 'update' | 'delete';

/**
 * Configuration options for CRUD factory creation.
 * Extends base factory options with CRUD-specific settings.
 */
export interface CRUDFactoryOptions extends BaseFactoryOptions {
  /** Supabase table name for the entity */
  tableName: string;
  
  /** Success message templates for different operations */
  successMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  
  /** Error message templates for different operations */
  errorMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  
  /** Query keys to invalidate after successful operations */
  invalidateKeys?: string[][];
  
  /** Enable optimistic updates for better UX */
  optimisticUpdates?: boolean;
  
  /** Custom success callback for specific operations */
  onSuccess?: SuccessCallback;
  
  /** Custom error callback for specific operations */
  onError?: ErrorCallback;
}

/**
 * Variables for update operations.
 * Combines entity ID with partial update data.
 */
export interface UpdateVariables<T extends BaseEntity> {
  id: string;
  data: UpdateData<T>;
}

/**
 * CRUD factory interface that defines the operations available.
 * Generic over the entity type for full type safety.
 */
export interface CRUDFactory<T extends BaseEntity> {
  /**
   * Create a new entity.
   * Returns a React Query mutation for creating entities.
   */
  useCreate: () => UseMutationResult<T, FactoryError, CreateData<T>>;
  
  /**
   * Update an existing entity.
   * Returns a React Query mutation for updating entities.
   */
  useUpdate: () => UseMutationResult<T, FactoryError, UpdateVariables<T>>;
  
  /**
   * Delete an entity.
   * Returns a React Query mutation for deleting entities.
   */
  useDelete: () => UseMutationResult<void, FactoryError, string>;
  
  /**
   * Get the table name for this factory.
   * Useful for debugging and query key generation.
   */
  getTableName: () => string;
  
  /**
   * Get the factory configuration.
   * Useful for introspection and debugging.
   */
  getConfig: () => CRUDFactoryOptions;
}

/**
 * CRUD mutation hooks interface.
 * Provides a structured way to access all CRUD operations for an entity.
 */
export interface CRUDMutations<T extends BaseEntity> {
  create: UseMutationResult<T, FactoryError, CreateData<T>>;
  update: UseMutationResult<T, FactoryError, UpdateVariables<T>>;
  delete: UseMutationResult<void, FactoryError, string>;
}

/**
 * CRUD factory function type.
 * Defines the signature for creating CRUD factories.
 */
export type CreateCRUDFactory = <T extends BaseEntity>(
  options: CRUDFactoryOptions
) => CRUDFactory<T>;

/**
 * Optimistic update configuration for CRUD operations.
 * Defines how optimistic updates should be applied.
 */
export interface OptimisticUpdateConfig<T extends BaseEntity> {
  /** Enable optimistic updates */
  enabled: boolean;
  
  /** Function to generate optimistic data for create operations */
  generateOptimisticCreate?: (data: CreateData<T>) => T;
  
  /** Function to generate optimistic data for update operations */
  generateOptimisticUpdate?: (current: T, updates: UpdateData<T>) => T;
  
  /** Rollback strategy when optimistic update fails */
  rollbackStrategy?: 'revert' | 'refetch' | 'custom';
  
  /** Custom rollback function */
  customRollback?: (error: FactoryError, operation: CRUDOperation) => void;
}

/**
 * CRUD operation context interface.
 * Provides context information during CRUD operations.
 */
export interface CRUDOperationContext<T extends BaseEntity> {
  /** The operation being performed */
  operation: CRUDOperation;
  
  /** The entity being operated on (for update/delete) */
  entity?: T;
  
  /** The data being used (for create/update) */
  data?: CreateData<T> | UpdateData<T>;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  
  /** Timestamp when operation started */
  startTime: number;
}

/**
 * CRUD factory builder interface.
 * Provides a fluent API for configuring CRUD factories.
 */
export interface CRUDFactoryBuilder<T extends BaseEntity> {
  /** Set the table name */
  table(name: string): CRUDFactoryBuilder<T>;
  
  /** Configure success messages */
  successMessages(messages: CRUDFactoryOptions['successMessages']): CRUDFactoryBuilder<T>;
  
  /** Configure error messages */
  errorMessages(messages: CRUDFactoryOptions['errorMessages']): CRUDFactoryBuilder<T>;
  
  /** Configure query invalidation */
  invalidateKeys(keys: string[][]): CRUDFactoryBuilder<T>;
  
  /** Enable optimistic updates */
  withOptimisticUpdates(config?: OptimisticUpdateConfig<T>): CRUDFactoryBuilder<T>;
  
  /** Add success callback */
  onSuccess(callback: SuccessCallback): CRUDFactoryBuilder<T>;
  
  /** Add error callback */
  onError(callback: ErrorCallback): CRUDFactoryBuilder<T>;
  
  /** Build the CRUD factory */
  build(): CRUDFactory<T>;
}

/**
 * CRUD factory registry interface.
 * Manages multiple CRUD factories for different entities.
 */
export interface CRUDFactoryRegistry {
  /** Register a CRUD factory for an entity */
  register<T extends BaseEntity>(entityName: string, factory: CRUDFactory<T>): void;
  
  /** Get a CRUD factory for an entity */
  get<T extends BaseEntity>(entityName: string): CRUDFactory<T> | undefined;
  
  /** Check if a factory is registered */
  has(entityName: string): boolean;
  
  /** Get all registered entity names */
  getEntityNames(): string[];
  
  /** Clear all registered factories */
  clear(): void;
}