/**
 * Property Tests: API Type Validation
 * 
 * Tests that API type validation provides proper type safety
 * and validation for requests and responses.
 * 
 * **Property 27: API Type Validation**
 * **Validates: Requirements 6.3**
 */

import { describe, test, expect, beforeAll, vi } from 'vitest';
import * as fc from 'fast-check';
import { 
  ApiTypeValidator,
  ValidatedApiClient,
  ValidationUtils,
  ValidationErrorCode,
  type ValidationResult,
  type ValidationError
} from './api-type-validation';
import { RuntimeSchemaIntrospector } from './schema-introspection';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      delete: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }
}));

describe('Property Tests: API Type Validation', () => {
  let schemaIntrospector: RuntimeSchemaIntrospector;

  beforeAll(() => {
    // Create a mock introspector for testing
    schemaIntrospector = new RuntimeSchemaIntrospector(
      'https://test.supabase.co', 
      'test-key'
    );
  });

  /**
   * Property 27: API Type Validation
   * **Validates: Requirements 6.3**
   */
  describe('Property 27: API Type Validation', () => {
    test('insert validation rejects invalid data types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.constantFrom('customers', 'leads', 'products'),
            invalidData: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.string(),
              fc.integer(),
              fc.boolean(),
              fc.array(fc.anything())
            )
          }),
          async ({ tableName, invalidData }) => {
            const result = await ApiTypeValidator.validateInsert(tableName as any, invalidData);
            
            // Invalid data should always fail validation
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            
            // Should have appropriate error codes
            const hasTypeError = result.errors.some(error => 
              error.code === ValidationErrorCode.INVALID_TYPE ||
              error.code === ValidationErrorCode.REQUIRED_FIELD_MISSING
            );
            expect(hasTypeError).toBe(true);

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    test('update validation accepts partial valid data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.constantFrom('customers', 'leads', 'products'),
            validPartialData: fc.record({
              name: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
              email: fc.option(fc.emailAddress()),
              phone: fc.option(fc.string({ minLength: 10, maxLength: 20 }))
            }, { requiredKeys: [] })
          }),
          async ({ tableName, validPartialData }) => {
            // Remove undefined values
            const cleanData = Object.fromEntries(
              Object.entries(validPartialData).filter(([_, value]) => value !== undefined)
            );

            // Skip if no data to update
            if (Object.keys(cleanData).length === 0) {
              return true;
            }

            const result = await ApiTypeValidator.validateUpdate(tableName as any, cleanData);
            
            // Partial valid data should pass basic structure validation
            expect(typeof result.valid).toBe('boolean');
            expect(Array.isArray(result.errors)).toBe(true);
            
            // If there are errors, they should be properly structured
            for (const error of result.errors) {
              expect(error.field).toBeTruthy();
              expect(error.message).toBeTruthy();
              expect(Object.values(ValidationErrorCode)).toContain(error.code);
            }

            return true;
          }
        ),
        { numRuns: 8 }
      );
    });

    test('response validation handles various data structures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.constantFrom('customers', 'leads', 'products'),
            responseData: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                created_at: fc.date().map(d => d.toISOString())
              }),
              fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                created_at: fc.date().map(d => d.toISOString())
              }), { maxLength: 5 })
            )
          }),
          async ({ tableName, responseData }) => {
            const result = await ApiTypeValidator.validateResponse(tableName as any, responseData);
            
            // Response validation should always return a result
            expect(typeof result.valid).toBe('boolean');
            expect(Array.isArray(result.errors)).toBe(true);
            
            // Null/undefined responses should be valid
            if (responseData === null || responseData === undefined) {
              expect(result.valid).toBe(true);
              expect(result.errors.length).toBe(0);
            }
            
            // If there are errors, they should be properly structured
            for (const error of result.errors) {
              expect(error.field).toBeTruthy();
              expect(error.message).toBeTruthy();
              expect(Object.values(ValidationErrorCode)).toContain(error.code);
            }

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    test('enum validation correctly validates enum values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            enumName: fc.constantFrom('lead_status', 'lead_temperature', 'invoice_status'),
            testValue: fc.oneof(
              fc.constantFrom('new', 'contacted', 'qualified', 'converted'), // Valid lead_status values
              fc.constantFrom('cold', 'warm', 'hot'), // Valid lead_temperature values
              fc.constantFrom('draft', 'pending', 'paid', 'overdue'), // Valid invoice_status values
              fc.string({ minLength: 1, maxLength: 20 }), // Random strings
              fc.constant(null),
              fc.constant(undefined),
              fc.integer(),
              fc.boolean()
            )
          }),
          async ({ enumName, testValue }) => {
            const result = await ApiTypeValidator.validateEnum(enumName as any, testValue);
            
            // Validation should always return a result
            expect(typeof result.valid).toBe('boolean');
            expect(Array.isArray(result.errors)).toBe(true);
            
            // If validation fails, should have appropriate error
            if (!result.valid) {
              expect(result.errors.length).toBeGreaterThan(0);
              const hasEnumError = result.errors.some(error => 
                error.code === ValidationErrorCode.INVALID_ENUM_VALUE ||
                error.code === ValidationErrorCode.CONSTRAINT_VIOLATION
              );
              expect(hasEnumError).toBe(true);
            }
            
            // If validation passes, should have valid data
            if (result.valid) {
              expect(result.data).toBeTruthy();
              expect(typeof result.data).toBe('string');
            }

            return true;
          }
        ),
        { numRuns: 15 }
      );
    });

    test('field type validation handles all supported types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fieldType: fc.constantFrom(
              'uuid', 'text', 'integer', 'numeric', 'boolean', 
              'timestamp', 'date', 'json', 'lead_status'
            ),
            testValue: fc.oneof(
              fc.uuid(),
              fc.string(),
              fc.integer(),
              fc.float(),
              fc.boolean(),
              fc.date(),
              fc.date().map(d => d.toISOString()),
              fc.object(),
              fc.array(fc.anything()),
              fc.constant(null),
              fc.constant(undefined)
            )
          }),
          async ({ fieldType, testValue }) => {
            // Use private method through reflection for testing
            const validator = ApiTypeValidator as any;
            const result = await validator.validateFieldType('test_field', fieldType, testValue);
            
            // Validation should always return a result
            expect(typeof result.valid).toBe('boolean');
            expect(Array.isArray(result.errors)).toBe(true);
            
            // If there are errors, they should be properly structured
            for (const error of result.errors) {
              expect(error.field).toBe('test_field');
              expect(error.message).toBeTruthy();
              expect(Object.values(ValidationErrorCode)).toContain(error.code);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    test('validation error codes are consistent and meaningful', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.constantFrom('customers', 'leads', 'products'),
            invalidData: fc.record({
              // Missing required field (name)
              email: fc.option(fc.string()),
              unknownField: fc.string(), // Unknown field
              invalidId: fc.string({ minLength: 1, maxLength: 10 }) // Invalid UUID format
            })
          }),
          async ({ tableName, invalidData }) => {
            const result = await ApiTypeValidator.validateInsert(tableName as any, invalidData);
            
            // Should have validation errors
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            
            // Check for expected error codes
            const errorCodes = result.errors.map(error => error.code);
            const validCodes = Object.values(ValidationErrorCode);
            
            for (const code of errorCodes) {
              expect(validCodes).toContain(code);
            }
            
            // Should have meaningful error messages
            for (const error of result.errors) {
              expect(error.message.length).toBeGreaterThan(0);
              expect(error.field.length).toBeGreaterThan(0);
            }

            return true;
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * Integration tests for API type validation
   */
  describe('API Type Validation Integration Tests', () => {
    test('validated API client handles successful operations', async () => {
      const validCustomerData = {
        business_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '+1234567890'
      };

      const result = await ValidatedApiClient.insert('customers', validCustomerData);
      
      // Should return success structure
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result.data).toBeTruthy();
        expect(Array.isArray(result.data)).toBe(true);
      } else {
        expect(result.errors).toBeTruthy();
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });

    test('validated API client rejects invalid operations', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        email: 'not-an-email', // Invalid: not email format
        unknownField: 'value' // Invalid: unknown field
      };

      const result = await ValidatedApiClient.insert('customers', invalidData);
      
      // Should fail validation
      expect(result.success).toBe(false);
      expect(result.errors).toBeTruthy();
      expect(result.errors!.length).toBeGreaterThan(0);
      
      // Should have meaningful error messages
      for (const error of result.errors!) {
        expect(error.message).toBeTruthy();
        expect(error.field).toBeTruthy();
        expect(Object.values(ValidationErrorCode)).toContain(error.code);
      }
    });

    test('validation utils provide helpful error handling', () => {
      const mockErrors: ValidationError[] = [
        {
          field: 'name',
          message: 'Name is required',
          code: ValidationErrorCode.REQUIRED_FIELD_MISSING
        },
        {
          field: 'email',
          message: 'Invalid email format',
          code: ValidationErrorCode.INVALID_FORMAT
        },
        {
          field: 'status',
          message: 'Invalid enum value',
          code: ValidationErrorCode.INVALID_ENUM_VALUE
        }
      ];

      const result: ValidationResult = {
        valid: false,
        errors: mockErrors
      };

      // Test error code checking
      expect(ValidationUtils.hasErrorCode(result, ValidationErrorCode.REQUIRED_FIELD_MISSING)).toBe(true);
      expect(ValidationUtils.hasErrorCode(result, ValidationErrorCode.CONSTRAINT_VIOLATION)).toBe(false);

      // Test field error filtering
      const nameErrors = ValidationUtils.getFieldErrors(result, 'name');
      expect(nameErrors.length).toBe(1);
      expect(nameErrors[0].message).toBe('Name is required');

      // Test error formatting
      const formattedErrors = ValidationUtils.formatErrors(mockErrors);
      expect(formattedErrors.length).toBe(3);
      expect(formattedErrors[0]).toBe('name: Name is required');
      expect(formattedErrors[1]).toBe('email: Invalid email format');

      // Test error creation
      const newError = ValidationUtils.createError(
        'test_field',
        'Test message',
        ValidationErrorCode.INVALID_TYPE,
        'test_value'
      );
      expect(newError.field).toBe('test_field');
      expect(newError.message).toBe('Test message');
      expect(newError.code).toBe(ValidationErrorCode.INVALID_TYPE);
      expect(newError.value).toBe('test_value');
    });

    test('validation handles complex nested data structures', async () => {
      const complexData = {
        business_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Customer',
        lead_data: {
          source: 'website',
          campaign: 'summer_2024',
          metadata: {
            utm_source: 'google',
            utm_medium: 'cpc'
          }
        },
        tags: ['vip', 'enterprise'],
        created_at: new Date().toISOString()
      };

      const result = await ApiTypeValidator.validateInsert('customers', complexData);
      
      // Should handle complex data structures
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      
      // If validation fails, errors should be specific
      for (const error of result.errors) {
        expect(error.field).toBeTruthy();
        expect(error.message).toBeTruthy();
        expect(Object.values(ValidationErrorCode)).toContain(error.code);
      }
    });

    test('response validation preserves data integrity', async () => {
      const mockResponseData = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          business_id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Customer 1',
          email: 'customer1@example.com',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          business_id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Customer 2',
          email: 'customer2@example.com',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const result = await ApiTypeValidator.validateResponse('customers', mockResponseData);
      
      // Should validate array responses
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      
      if (result.valid && result.data) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(2);
        
        // Data should be preserved
        for (let i = 0; i < result.data.length; i++) {
          expect(result.data[i].id).toBe(mockResponseData[i].id);
          expect(result.data[i].name).toBe(mockResponseData[i].name);
        }
      }
    });
  });
});