/**
 * Core Factory Types
 * 
 * Base interfaces and types that are shared across all factory implementations.
 * These types provide the foundation for type-safe generic factory operations.
 * 
 * @fileoverview Core factory type definitions
 * @version 1.0.0
 */

/**
 * Base entity interface that all database entities must extend.
 * Provides common fields that exist on all Supabase tables.
 */
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Business entity interface for entities that belong to a business.
 * Most entities in the CRM system extend this interface.
 */
export interface BusinessEntity extends BaseEntity {
  business_id: string;
}

/**
 * Generic error handling interface for factory operations.
 * Provides structured error information with context.
 * Extends Error to be compatible with TanStack Query.
 */
export interface FactoryError extends Error {
  code?: string;
  context?: string;
  originalError?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Success callback function type for factory operations.
 * Called when an operation completes successfully.
 */
export type SuccessCallback<T = unknown> = (
  operation: 'create' | 'update' | 'delete' | 'query',
  data?: T
) => void;

/**
 * Error callback function type for factory operations.
 * Called when an operation encounters an error.
 */
export type ErrorCallback = (error: FactoryError, operation: string) => void;

/**
 * Factory configuration options that are common across all factory types.
 * Provides standardized configuration interface.
 */
export interface BaseFactoryOptions {
  /** Success callback for operation completion */
  onSuccess?: SuccessCallback;
  
  /** Error callback for operation failures */
  onError?: ErrorCallback;
  
  /** Enable optimistic updates for better UX */
  optimisticUpdates?: boolean;
  
  /** Custom cache time in milliseconds */
  cacheTime?: number;
  
  /** Enable debug logging for development */
  debug?: boolean;
}

/**
 * Query filter interface for standardized filtering across entities.
 * Supports common filtering patterns used throughout the application.
 */
export interface QueryFilters {
  /** Text search across searchable fields */
  search?: string;
  
  /** Fields to search in when using text search */
  searchFields?: string[];
  
  /** Filter by specific field values */
  where?: Record<string, unknown>;
  
  /** Sort configuration */
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  
  /** Pagination configuration */
  pagination?: {
    page: number;
    pageSize: number;
  };
  
  /** Date range filtering */
  dateRange?: {
    field: string;
    from?: string;
    to?: string;
  };
  
  /** Additional query parameters */
  [key: string]: unknown;
}

/**
 * Pagination result interface for query responses.
 * Provides consistent pagination metadata.
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Factory operation result interface.
 * Standardizes the response format for all factory operations.
 */
export interface FactoryResult<T> {
  success: boolean;
  data?: T;
  error?: FactoryError;
  metadata?: {
    operation: string;
    timestamp: string;
    duration?: number;
  };
}

/**
 * Type utility to extract the entity type from a factory.
 * Useful for type inference in generic contexts.
 */
export type ExtractEntityType<T> = T extends BaseEntity ? T : never;

/**
 * Type utility to create insert data type from entity type.
 * Omits auto-generated fields like id, created_at, updated_at.
 */
export type CreateData<T extends BaseEntity> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type utility to create update data type from entity type.
 * Makes all fields optional except id, and omits auto-generated fields.
 */
export type UpdateData<T extends BaseEntity> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;

/**
 * Type utility for entity field configuration.
 * Used by form factories to understand entity structure.
 */
export interface EntityFieldConfig {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'text' | 'select';
  label: string;
  required: boolean;
  validation?: ValidationRule[];
  options?: { label: string; value: unknown }[];
  placeholder?: string;
  helpText?: string;
}

/**
 * Validation rule interface for field validation.
 * Supports common validation patterns.
 */
export interface ValidationRule {
  type: 'required' | 'email' | 'phone' | 'minLength' | 'maxLength' | 'pattern' | 'custom' | 'min' | 'max' | 'step';
  value?: unknown;
  message: string;
  validator?: (value: unknown) => boolean;
  validate?: (value: unknown, formValues?: Record<string, unknown>) => string | null;
}

/**
 * Entity configuration interface for factory setup.
 * Defines how entities should be handled by factories.
 */
export interface EntityConfig<T extends BaseEntity> {
  /** Supabase table name */
  tableName: string;
  
  /** Human-readable entity name */
  displayName: string;
  
  /** Field configurations for forms and validation */
  fields: EntityFieldConfig[];
  
  /** Default query filters */
  defaultFilters?: QueryFilters;
  
  /** Fields that should be searchable */
  searchableFields?: (keyof T)[];
  
  /** Business logic hooks */
  businessLogic?: {
    beforeCreate?: (data: CreateData<T>) => Promise<CreateData<T>>;
    afterCreate?: (entity: T) => Promise<void>;
    beforeUpdate?: (id: string, data: UpdateData<T>) => Promise<UpdateData<T>>;
    afterUpdate?: (entity: T) => Promise<void>;
    beforeDelete?: (id: string) => Promise<void>;
    afterDelete?: (id: string) => Promise<void>;
  };
}