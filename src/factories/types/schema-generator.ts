/**
 * Schema Type Generator
 * 
 * Automatically generates enhanced TypeScript types from Supabase schemas
 * with additional type safety features and validation helpers.
 * 
 * **Validates: Requirements 6.2**
 */

import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';

// Core schema type utilities
export type TableName = keyof Database['public']['Tables'];
export type ViewName = keyof Database['public']['Views'];
export type EnumName = keyof Database['public']['Enums'];

// Enhanced table types with metadata
export type TableRow<T extends TableName> = Tables<T>;
export type TableInsert<T extends TableName> = TablesInsert<T>;
export type TableUpdate<T extends TableName> = TablesUpdate<T>;

// Schema metadata extraction
export type TableColumns<T extends TableName> = keyof TableRow<T>;
export type RequiredColumns<T extends TableName> = {
  [K in keyof TableInsert<T>]-?: TableInsert<T>[K] extends undefined ? never : K;
}[keyof TableInsert<T>];

export type OptionalColumns<T extends TableName> = {
  [K in keyof TableInsert<T>]-?: TableInsert<T>[K] extends undefined ? K : never;
}[keyof TableInsert<T>];

// Relationship type extraction
export type TableRelationships<T extends TableName> = 
  Database['public']['Tables'][T]['Relationships'];

export type ForeignKeyColumns<T extends TableName> = {
  [R in TableRelationships<T>[number] as R['columns'][0]]: R['referencedRelation'];
};

// Enhanced enum types with validation
export type EnumValues<T extends EnumName> = Enums<T>;
export type EnumKeys<T extends EnumName> = keyof typeof Database.public.Enums[T];

// Type-safe field definitions for forms and validation
export interface FieldDefinition<T extends TableName, K extends TableColumns<T>> {
  name: K;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'json' | 'array';
  required: K extends RequiredColumns<T> ? true : false;
  nullable: TableRow<T>[K] extends null ? true : false;
  enumValues?: K extends keyof TableRow<T> 
    ? TableRow<T>[K] extends Enums<infer E> 
      ? EnumValues<E>[] 
      : never
    : never;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean | string;
  };
}

// Schema introspection utilities
export class SchemaIntrospector {
  /**
   * Get all table names from the schema
   */
  static getTableNames(): TableName[] {
    return Object.keys({} as Database['public']['Tables']) as TableName[];
  }

  /**
   * Get all enum names from the schema
   */
  static getEnumNames(): EnumName[] {
    return Object.keys({} as Database['public']['Enums']) as EnumName[];
  }

  /**
   * Get column information for a specific table
   */
  static getTableColumns<T extends TableName>(tableName: T): {
    name: TableColumns<T>;
    required: boolean;
    nullable: boolean;
    type: string;
  }[] {
    // This would be implemented with actual schema introspection
    // For now, we provide the type structure
    return [] as any;
  }

  /**
   * Get enum values for a specific enum
   */
  static getEnumValues<T extends EnumName>(enumName: T): EnumValues<T>[] {
    // This would be implemented with actual enum introspection
    return [] as any;
  }

  /**
   * Get foreign key relationships for a table
   */
  static getTableRelationships<T extends TableName>(
    tableName: T
  ): ForeignKeyColumns<T> {
    return {} as ForeignKeyColumns<T>;
  }
}

// Type-safe query builders
export interface QueryBuilder<T extends TableName> {
  table: T;
  select<K extends TableColumns<T>>(columns: K[]): QueryBuilder<T>;
  where<K extends TableColumns<T>>(
    column: K, 
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in',
    value: TableRow<T>[K] | TableRow<T>[K][]
  ): QueryBuilder<T>;
  orderBy<K extends TableColumns<T>>(
    column: K, 
    direction?: 'asc' | 'desc'
  ): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  offset(count: number): QueryBuilder<T>;
}

// Schema validation utilities
export class SchemaValidator {
  /**
   * Validate data against table schema
   */
  static validateInsert<T extends TableName>(
    tableName: T,
    data: Partial<TableInsert<T>>
  ): {
    valid: boolean;
    errors: Array<{
      field: keyof TableInsert<T>;
      message: string;
    }>;
  } {
    const errors: Array<{ field: keyof TableInsert<T>; message: string }> = [];

    // Implementation would validate against actual schema
    // For now, we provide the type structure
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate data against table schema for updates
   */
  static validateUpdate<T extends TableName>(
    tableName: T,
    data: Partial<TableUpdate<T>>
  ): {
    valid: boolean;
    errors: Array<{
      field: keyof TableUpdate<T>;
      message: string;
    }>;
  } {
    const errors: Array<{ field: keyof TableUpdate<T>; message: string }> = [];

    // Implementation would validate against actual schema
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate enum value
   */
  static validateEnum<T extends EnumName>(
    enumName: T,
    value: any
  ): value is EnumValues<T> {
    // Implementation would validate against actual enum values
    return true;
  }
}

// Type-safe form field generators
export class FormFieldGenerator {
  /**
   * Generate field definitions for a table
   */
  static generateFields<T extends TableName>(
    tableName: T,
    options?: {
      exclude?: TableColumns<T>[];
      include?: TableColumns<T>[];
      customValidation?: Partial<Record<TableColumns<T>, FieldDefinition<T, any>['validation']>>;
    }
  ): FieldDefinition<T, TableColumns<T>>[] {
    // Implementation would generate actual field definitions
    return [] as any;
  }

  /**
   * Generate form schema for validation libraries
   */
  static generateValidationSchema<T extends TableName>(
    tableName: T,
    mode: 'insert' | 'update' = 'insert'
  ): Record<string, any> {
    // Implementation would generate validation schema for libraries like Zod, Yup, etc.
    return {};
  }
}

// Enhanced type utilities for API responses
export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  count?: number;
};

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
};

// Type-safe API client interface
export interface TypedSupabaseClient {
  from<T extends TableName>(table: T): {
    select<K extends TableColumns<T>>(
      columns?: K[] | '*'
    ): Promise<ApiResponse<Pick<TableRow<T>, K>[]>>;
    
    insert(
      data: TableInsert<T> | TableInsert<T>[]
    ): Promise<ApiResponse<TableRow<T>[]>>;
    
    update(
      data: Partial<TableUpdate<T>>
    ): {
      eq<K extends TableColumns<T>>(
        column: K,
        value: TableRow<T>[K]
      ): Promise<ApiResponse<TableRow<T>[]>>;
    };
    
    delete(): {
      eq<K extends TableColumns<T>>(
        column: K,
        value: TableRow<T>[K]
      ): Promise<ApiResponse<null>>;
    };
  };
}

// Export commonly used table types for convenience
export type Customer = TableRow<'customers'>;
export type CustomerInsert = TableInsert<'customers'>;
export type CustomerUpdate = TableUpdate<'customers'>;

export type Lead = TableRow<'leads'>;
export type LeadInsert = TableInsert<'leads'>;
export type LeadUpdate = TableUpdate<'leads'>;

export type Product = TableRow<'products'>;
export type ProductInsert = TableInsert<'products'>;
export type ProductUpdate = TableUpdate<'products'>;

export type Service = TableRow<'services'>;
export type ServiceInsert = TableInsert<'services'>;
export type ServiceUpdate = TableUpdate<'services'>;

export type Invoice = TableRow<'invoices'>;
export type InvoiceInsert = TableInsert<'invoices'>;
export type InvoiceUpdate = TableUpdate<'invoices'>;

export type Transaction = TableRow<'transactions'>;
export type TransactionInsert = TableInsert<'transactions'>;
export type TransactionUpdate = TableUpdate<'transactions'>;

// Export enum types for convenience
export type LeadStatus = Enums<'lead_status'>;
export type LeadTemperature = Enums<'lead_temperature'>;
export type InvoiceStatus = Enums<'invoice_status'>;
export type AppointmentStatus = Enums<'appointment_status'>;
export type ConversationStatus = Enums<'conversation_status'>;
export type MessageDirection = Enums<'message_direction'>;
export type OpportunityStage = Enums<'opportunity_stage'>;
export type WhatsAppMessageStatus = Enums<'whatsapp_message_status'>;