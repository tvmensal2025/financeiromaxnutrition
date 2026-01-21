/**
 * Runtime API Type Validation
 * 
 * Provides runtime type validation for API requests and responses
 * to ensure type safety throughout the API layer.
 * 
 * **Validates: Requirements 6.3**
 */

import type { 
  Database, 
  TableName, 
  TableRow, 
  TableInsert, 
  TableUpdate,
  EnumName,
  EnumValues 
} from '../types/schema-generator';
import { getSchemaIntrospector } from './schema-introspection';

// Validation result types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
  value?: any;
}

export enum ValidationErrorCode {
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  UNKNOWN_FIELD = 'UNKNOWN_FIELD'
}

// Type validation utilities
export class ApiTypeValidator {
  private static schemaIntrospector: ReturnType<typeof getSchemaIntrospector> | null = null;

  private static getIntrospector() {
    if (!this.schemaIntrospector) {
      try {
        this.schemaIntrospector = getSchemaIntrospector();
      } catch (error) {
        // In test environment, create a mock introspector
        if (process.env.NODE_ENV === 'test') {
          this.schemaIntrospector = new (require('./schema-introspection').RuntimeSchemaIntrospector)(
            'https://test.supabase.co',
            'test-key'
          );
        } else {
          throw error;
        }
      }
    }
    return this.schemaIntrospector;
  }

  /**
   * Validate insert data for a table
   */
  static async validateInsert<T extends TableName>(
    tableName: T,
    data: unknown
  ): Promise<ValidationResult & { data?: TableInsert<T> }> {
    const errors: ValidationError[] = [];

    // Basic type check
    if (!data || typeof data !== 'object') {
      errors.push({
        field: 'root',
        message: 'Data must be an object',
        code: ValidationErrorCode.INVALID_TYPE,
        value: data
      });
      return { valid: false, errors };
    }

    const typedData = data as Record<string, any>;

    try {
      // Get table schema information
      const tableInfo = await this.getIntrospector().getTableInfo(tableName);
      if (!tableInfo) {
        errors.push({
          field: 'table',
          message: `Table '${tableName}' not found`,
          code: ValidationErrorCode.CONSTRAINT_VIOLATION
        });
        return { valid: false, errors };
      }

      // Validate each field
      for (const column of tableInfo.columns) {
        const value = typedData[column.name];
        const hasValue = value !== undefined && value !== null;

        // Check required fields
        if (!column.nullable && column.defaultValue === null && !hasValue) {
          errors.push({
            field: column.name,
            message: `Field '${column.name}' is required`,
            code: ValidationErrorCode.REQUIRED_FIELD_MISSING
          });
          continue;
        }

        // Skip validation if no value provided
        if (!hasValue) continue;

        // Validate field type
        const typeValidation = await this.validateFieldType(column.name, column.type, value);
        if (!typeValidation.valid) {
          errors.push(...typeValidation.errors);
        }
      }

      // Check for unknown fields
      for (const key in typedData) {
        const columnExists = tableInfo.columns.some(col => col.name === key);
        if (!columnExists) {
          errors.push({
            field: key,
            message: `Unknown field '${key}' for table '${tableName}'`,
            code: ValidationErrorCode.UNKNOWN_FIELD,
            value: typedData[key]
          });
        }
      }

      const isValid = errors.length === 0;
      return {
        valid: isValid,
        errors,
        data: isValid ? (typedData as TableInsert<T>) : undefined
      };

    } catch (error) {
      errors.push({
        field: 'validation',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: ValidationErrorCode.CONSTRAINT_VIOLATION
      });
      return { valid: false, errors };
    }
  }

  /**
   * Validate update data for a table
   */
  static async validateUpdate<T extends TableName>(
    tableName: T,
    data: unknown
  ): Promise<ValidationResult & { data?: TableUpdate<T> }> {
    const errors: ValidationError[] = [];

    // Basic type check
    if (!data || typeof data !== 'object') {
      errors.push({
        field: 'root',
        message: 'Data must be an object',
        code: ValidationErrorCode.INVALID_TYPE,
        value: data
      });
      return { valid: false, errors };
    }

    const typedData = data as Record<string, any>;

    try {
      // Get table schema information
      const tableInfo = await this.getIntrospector().getTableInfo(tableName);
      if (!tableInfo) {
        errors.push({
          field: 'table',
          message: `Table '${tableName}' not found`,
          code: ValidationErrorCode.CONSTRAINT_VIOLATION
        });
        return { valid: false, errors };
      }

      // Validate each provided field
      for (const key in typedData) {
        const column = tableInfo.columns.find(col => col.name === key);
        
        if (!column) {
          errors.push({
            field: key,
            message: `Unknown field '${key}' for table '${tableName}'`,
            code: ValidationErrorCode.UNKNOWN_FIELD,
            value: typedData[key]
          });
          continue;
        }

        const value = typedData[key];
        
        // Skip null values for nullable fields
        if (value === null && column.nullable) {
          continue;
        }

        // Validate field type
        const typeValidation = await this.validateFieldType(column.name, column.type, value);
        if (!typeValidation.valid) {
          errors.push(...typeValidation.errors);
        }
      }

      const isValid = errors.length === 0;
      return {
        valid: isValid,
        errors,
        data: isValid ? (typedData as TableUpdate<T>) : undefined
      };

    } catch (error) {
      errors.push({
        field: 'validation',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: ValidationErrorCode.CONSTRAINT_VIOLATION
      });
      return { valid: false, errors };
    }
  }

  /**
   * Validate response data from API
   */
  static async validateResponse<T extends TableName>(
    tableName: T,
    data: unknown
  ): Promise<ValidationResult & { data?: TableRow<T> | TableRow<T>[] }> {
    const errors: ValidationError[] = [];

    if (data === null || data === undefined) {
      return { valid: true, errors: [], data: data as any };
    }

    // Handle array responses
    if (Array.isArray(data)) {
      const validatedItems: TableRow<T>[] = [];
      
      for (let i = 0; i < data.length; i++) {
        const itemValidation = await this.validateSingleResponse(tableName, data[i], `[${i}]`);
        errors.push(...itemValidation.errors);
        
        if (itemValidation.data) {
          validatedItems.push(itemValidation.data);
        }
      }

      const isValid = errors.length === 0;
      return {
        valid: isValid,
        errors,
        data: isValid ? validatedItems : undefined
      };
    }

    // Handle single item response
    const singleValidation = await this.validateSingleResponse(tableName, data);
    return {
      valid: singleValidation.valid,
      errors: singleValidation.errors,
      data: singleValidation.data
    };
  }

  /**
   * Validate a single response item
   */
  private static async validateSingleResponse<T extends TableName>(
    tableName: T,
    data: unknown,
    fieldPrefix = ''
  ): Promise<ValidationResult & { data?: TableRow<T> }> {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      errors.push({
        field: fieldPrefix || 'root',
        message: 'Response data must be an object',
        code: ValidationErrorCode.INVALID_TYPE,
        value: data
      });
      return { valid: false, errors };
    }

    const typedData = data as Record<string, any>;

    try {
      // Get table schema information
      const tableInfo = await this.getIntrospector().getTableInfo(tableName);
      if (!tableInfo) {
        errors.push({
          field: fieldPrefix + 'table',
          message: `Table '${tableName}' not found`,
          code: ValidationErrorCode.CONSTRAINT_VIOLATION
        });
        return { valid: false, errors };
      }

      // Validate each field in response
      for (const key in typedData) {
        const column = tableInfo.columns.find(col => col.name === key);
        
        if (!column) {
          // Allow extra fields in responses (they might be computed fields)
          continue;
        }

        const value = typedData[key];
        
        // Skip null values for nullable fields
        if (value === null && column.nullable) {
          continue;
        }

        // Validate field type
        const typeValidation = await this.validateFieldType(
          fieldPrefix + column.name, 
          column.type, 
          value
        );
        if (!typeValidation.valid) {
          errors.push(...typeValidation.errors);
        }
      }

      const isValid = errors.length === 0;
      return {
        valid: isValid,
        errors,
        data: isValid ? (typedData as TableRow<T>) : undefined
      };

    } catch (error) {
      errors.push({
        field: fieldPrefix + 'validation',
        message: `Response validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: ValidationErrorCode.CONSTRAINT_VIOLATION
      });
      return { valid: false, errors };
    }
  }

  /**
   * Validate individual field type
   */
  private static async validateFieldType(
    fieldName: string,
    fieldType: string,
    value: any
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    try {
      switch (fieldType) {
        case 'uuid':
          if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            errors.push({
              field: fieldName,
              message: `Invalid UUID format`,
              code: ValidationErrorCode.INVALID_FORMAT,
              value
            });
          }
          break;

        case 'text':
        case 'varchar':
          if (typeof value !== 'string') {
            errors.push({
              field: fieldName,
              message: `Must be a string`,
              code: ValidationErrorCode.INVALID_TYPE,
              value
            });
          }
          break;

        case 'integer':
        case 'bigint':
          if (!Number.isInteger(value)) {
            errors.push({
              field: fieldName,
              message: `Must be an integer`,
              code: ValidationErrorCode.INVALID_TYPE,
              value
            });
          }
          break;

        case 'numeric':
        case 'decimal':
        case 'real':
        case 'double precision':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push({
              field: fieldName,
              message: `Must be a number`,
              code: ValidationErrorCode.INVALID_TYPE,
              value
            });
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push({
              field: fieldName,
              message: `Must be a boolean`,
              code: ValidationErrorCode.INVALID_TYPE,
              value
            });
          }
          break;

        case 'timestamp':
        case 'timestamptz':
        case 'date':
          if (!(value instanceof Date) && typeof value !== 'string') {
            errors.push({
              field: fieldName,
              message: `Must be a Date or ISO string`,
              code: ValidationErrorCode.INVALID_TYPE,
              value
            });
          } else if (typeof value === 'string' && isNaN(Date.parse(value))) {
            errors.push({
              field: fieldName,
              message: `Must be a valid date string`,
              code: ValidationErrorCode.INVALID_FORMAT,
              value
            });
          }
          break;

        case 'json':
        case 'jsonb':
          // JSON fields can be any valid JSON value
          try {
            JSON.stringify(value);
          } catch {
            errors.push({
              field: fieldName,
              message: `Must be valid JSON`,
              code: ValidationErrorCode.INVALID_FORMAT,
              value
            });
          }
          break;

        default:
          // Check if it's an enum type
          if (fieldType.includes('_')) {
            const enumInfo = await this.getIntrospector().getEnumInfo(fieldType);
            if (enumInfo) {
              if (!enumInfo.values.includes(value)) {
                errors.push({
                  field: fieldName,
                  message: `Invalid enum value. Valid values: ${enumInfo.values.join(', ')}`,
                  code: ValidationErrorCode.INVALID_ENUM_VALUE,
                  value
                });
              }
            }
          }
          break;
      }
    } catch (error) {
      errors.push({
        field: fieldName,
        message: `Type validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: ValidationErrorCode.CONSTRAINT_VIOLATION,
        value
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate enum value
   */
  static async validateEnum<T extends EnumName>(
    enumName: T,
    value: unknown
  ): Promise<ValidationResult & { data?: EnumValues<T> }> {
    const errors: ValidationError[] = [];

    try {
      const enumInfo = await this.getIntrospector().getEnumInfo(enumName);
      if (!enumInfo) {
        errors.push({
          field: 'enum',
          message: `Enum '${enumName}' not found`,
          code: ValidationErrorCode.CONSTRAINT_VIOLATION
        });
        return { valid: false, errors };
      }

      if (typeof value !== 'string' || !enumInfo.values.includes(value)) {
        errors.push({
          field: 'value',
          message: `Invalid enum value. Valid values: ${enumInfo.values.join(', ')}`,
          code: ValidationErrorCode.INVALID_ENUM_VALUE,
          value
        });
        return { valid: false, errors };
      }

      return {
        valid: true,
        errors: [],
        data: value as EnumValues<T>
      };

    } catch (error) {
      errors.push({
        field: 'validation',
        message: `Enum validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: ValidationErrorCode.CONSTRAINT_VIOLATION
      });
      return { valid: false, errors };
    }
  }
}

// Type-safe API wrapper with validation
export class ValidatedApiClient {
  /**
   * Insert data with validation
   */
  static async insert<T extends TableName>(
    tableName: T,
    data: unknown
  ): Promise<{
    success: boolean;
    data?: TableRow<T>[];
    errors?: ValidationError[];
  }> {
    // Validate input data
    const validation = await ApiTypeValidator.validateInsert(tableName, data);
    
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      // Here you would make the actual API call
      // For now, we'll simulate a successful response
      const response = { ...validation.data, id: 'generated-id' } as TableRow<T>;
      
      // Validate response
      const responseValidation = await ApiTypeValidator.validateResponse(tableName, [response]);
      
      if (!responseValidation.valid) {
        return {
          success: false,
          errors: responseValidation.errors
        };
      }

      return {
        success: true,
        data: responseValidation.data as TableRow<T>[]
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'api',
          message: `API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: ValidationErrorCode.CONSTRAINT_VIOLATION
        }]
      };
    }
  }

  /**
   * Update data with validation
   */
  static async update<T extends TableName>(
    tableName: T,
    data: unknown,
    id: string
  ): Promise<{
    success: boolean;
    data?: TableRow<T>[];
    errors?: ValidationError[];
  }> {
    // Validate input data
    const validation = await ApiTypeValidator.validateUpdate(tableName, data);
    
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      // Here you would make the actual API call
      // For now, we'll simulate a successful response
      const response = { ...validation.data, id } as TableRow<T>;
      
      // Validate response
      const responseValidation = await ApiTypeValidator.validateResponse(tableName, [response]);
      
      if (!responseValidation.valid) {
        return {
          success: false,
          errors: responseValidation.errors
        };
      }

      return {
        success: true,
        data: responseValidation.data as TableRow<T>[]
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'api',
          message: `API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: ValidationErrorCode.CONSTRAINT_VIOLATION
        }]
      };
    }
  }

  /**
   * Select data with response validation
   */
  static async select<T extends TableName>(
    tableName: T,
    filters?: Record<string, any>
  ): Promise<{
    success: boolean;
    data?: TableRow<T>[];
    errors?: ValidationError[];
  }> {
    try {
      // Here you would make the actual API call
      // For now, we'll simulate a response
      const mockResponse: any[] = [];
      
      // Validate response
      const responseValidation = await ApiTypeValidator.validateResponse(tableName, mockResponse);
      
      if (!responseValidation.valid) {
        return {
          success: false,
          errors: responseValidation.errors
        };
      }

      return {
        success: true,
        data: responseValidation.data as TableRow<T>[]
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'api',
          message: `API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: ValidationErrorCode.CONSTRAINT_VIOLATION
        }]
      };
    }
  }
}

// Utility functions for common validation tasks
export const ValidationUtils = {
  /**
   * Check if validation result has specific error code
   */
  hasErrorCode(result: ValidationResult, code: ValidationErrorCode): boolean {
    return result.errors.some(error => error.code === code);
  },

  /**
   * Get errors for a specific field
   */
  getFieldErrors(result: ValidationResult, fieldName: string): ValidationError[] {
    return result.errors.filter(error => error.field === fieldName);
  },

  /**
   * Format validation errors for display
   */
  formatErrors(errors: ValidationError[]): string[] {
    return errors.map(error => {
      const fieldPrefix = error.field !== 'root' ? `${error.field}: ` : '';
      return `${fieldPrefix}${error.message}`;
    });
  },

  /**
   * Create a validation error
   */
  createError(
    field: string,
    message: string,
    code: ValidationErrorCode,
    value?: any
  ): ValidationError {
    return { field, message, code, value };
  }
};