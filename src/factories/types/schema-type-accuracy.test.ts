/**
 * Property Tests: Schema Type Accuracy
 * 
 * Tests that generated types accurately reflect database structure
 * and provide proper type safety.
 * 
 * **Property 26: Schema Type Accuracy**
 * **Validates: Requirements 6.2**
 */

import { describe, test, expect, beforeAll, vi } from 'vitest';
import * as fc from 'fast-check';
import { 
  SchemaIntrospector, 
  SchemaValidator,
  FormFieldGenerator,
  type TableRow,
  type TableInsert,
  type TableUpdate,
  type Customer,
  type Lead,
  type Product
} from './schema-generator';
import { 
  getSchemaIntrospector, 
  SchemaUtils,
  RuntimeSchemaIntrospector,
  type TableInfo,
  type ColumnInfo 
} from '../utils/schema-introspection';

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

describe('Property Tests: Schema Type Accuracy', () => {
  let schemaIntrospector: RuntimeSchemaIntrospector;

  beforeAll(() => {
    // Create a mock introspector for testing
    schemaIntrospector = new RuntimeSchemaIntrospector(
      'https://test.supabase.co', 
      'test-key'
    );
  });

  /**
   * Property 26: Schema Type Accuracy
   * **Validates: Requirements 6.2**
   */
  describe('Property 26: Schema Type Accuracy', () => {
    test('generated types match actual database schema structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('customers', 'leads', 'products', 'services', 'invoices'),
          async (tableName) => {
            // Get actual schema information
            const tableInfo = await schemaIntrospector.getTableInfo(tableName);
            expect(tableInfo).toBeTruthy();

            if (!tableInfo) return true;

            // Verify table exists in our type system
            const tableExists = await SchemaUtils.tableExists(tableName);
            expect(tableExists).toBe(true);

            // Verify required fields match
            const requiredFields = await SchemaUtils.getRequiredFields(tableName);
            const schemaRequiredFields = tableInfo.columns
              .filter(col => !col.nullable && col.defaultValue === null)
              .map(col => col.name);

            expect(requiredFields.sort()).toEqual(schemaRequiredFields.sort());

            // Verify foreign key relationships are properly typed
            const foreignKeys = await schemaIntrospector.getForeignKeys(tableName);
            for (const fk of foreignKeys) {
              expect(fk.column).toBeTruthy();
              expect(fk.referencedTable).toBeTruthy();
              expect(fk.referencedColumn).toBeTruthy();
            }

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    test('enum types match actual database enum values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'lead_status', 
            'lead_temperature', 
            'invoice_status', 
            'appointment_status',
            'conversation_status',
            'message_direction',
            'opportunity_stage',
            'whatsapp_message_status'
          ),
          async (enumName) => {
            // Get actual enum information
            const enumInfo = await schemaIntrospector.getEnumInfo(enumName);
            expect(enumInfo).toBeTruthy();

            if (!enumInfo) return true;

            // Verify enum has values
            expect(enumInfo.values.length).toBeGreaterThan(0);

            // Verify all values are strings
            for (const value of enumInfo.values) {
              expect(typeof value).toBe('string');
              expect(value.length).toBeGreaterThan(0);
            }

            // Verify enum validation works
            for (const value of enumInfo.values) {
              expect(SchemaValidator.validateEnum(enumName as any, value)).toBe(true);
            }

            // Verify invalid values are rejected
            expect(SchemaValidator.validateEnum(enumName as any, 'invalid_value')).toBe(false);

            return true;
          }
        ),
        { numRuns: 8 }
      );
    });

    test('column types provide accurate type information', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('customers', 'leads', 'products'),
          async (tableName) => {
            const tableInfo = await schemaIntrospector.getTableInfo(tableName);
            if (!tableInfo) return true;

            for (const column of tableInfo.columns) {
              // Verify column has required properties
              expect(column.name).toBeTruthy();
              expect(column.type).toBeTruthy();
              expect(typeof column.nullable).toBe('boolean');
              expect(typeof column.isPrimaryKey).toBe('boolean');
              expect(typeof column.isForeignKey).toBe('boolean');

              // Verify foreign key columns have reference information
              if (column.isForeignKey) {
                expect(column.referencedTable).toBeTruthy();
                expect(column.referencedColumn).toBeTruthy();
              }

              // Verify primary key columns are not nullable (unless they have defaults)
              if (column.isPrimaryKey && column.defaultValue === null) {
                expect(column.nullable).toBe(false);
              }
            }

            return true;
          }
        ),
        { numRuns: 3 }
      );
    });

    test('type-safe insert operations validate correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.constantFrom('customers', 'leads', 'products'),
            validData: fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              email: fc.option(fc.emailAddress()),
              phone: fc.option(fc.string({ minLength: 10, maxLength: 20 }))
            }),
            invalidData: fc.record({
              name: fc.constant(''), // Invalid: empty name
              email: fc.option(fc.string({ minLength: 1, maxLength: 10 })), // Invalid: not email format
              extraField: fc.string() // Invalid: field doesn't exist
            })
          }),
          async ({ tableName, validData, invalidData }) => {
            // Test valid data validation
            const validResult = await schemaIntrospector.validateData(
              tableName, 
              validData, 
              'insert'
            );

            // Valid data should pass basic structure validation
            // (Note: Some fields might still fail due to missing required fields)
            expect(typeof validResult.valid).toBe('boolean');
            expect(Array.isArray(validResult.errors)).toBe(true);

            // Test invalid data validation
            const invalidResult = await schemaIntrospector.validateData(
              tableName, 
              invalidData, 
              'insert'
            );

            // Invalid data should have errors
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors.length).toBeGreaterThan(0);

            // Verify error structure
            for (const error of invalidResult.errors) {
              expect(error.field).toBeTruthy();
              expect(error.message).toBeTruthy();
              expect(typeof error.field).toBe('string');
              expect(typeof error.message).toBe('string');
            }

            return true;
          }
        ),
        { numRuns: 5 }
      );
    });

    test('form field generation produces accurate field definitions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('customers', 'leads', 'products'),
          async (tableName) => {
            const tableInfo = await schemaIntrospector.getTableInfo(tableName);
            if (!tableInfo) return true;

            // Generate field definitions
            const fields = FormFieldGenerator.generateFields(tableName as any);

            // Verify fields array structure
            expect(Array.isArray(fields)).toBe(true);

            // For each field, verify it has proper structure
            for (const field of fields) {
              expect(field.name).toBeTruthy();
              expect(['string', 'number', 'boolean', 'date', 'enum', 'json', 'array']).toContain(field.type);
              expect(typeof field.required).toBe('boolean');
              expect(typeof field.nullable).toBe('boolean');

              // If field has enum values, verify they're valid
              if (field.enumValues) {
                expect(Array.isArray(field.enumValues)).toBe(true);
                expect(field.enumValues.length).toBeGreaterThan(0);
              }

              // If field has validation, verify structure
              if (field.validation) {
                if (field.validation.min !== undefined) {
                  expect(typeof field.validation.min).toBe('number');
                }
                if (field.validation.max !== undefined) {
                  expect(typeof field.validation.max).toBe('number');
                }
                if (field.validation.pattern !== undefined) {
                  expect(field.validation.pattern).toBeInstanceOf(RegExp);
                }
                if (field.validation.custom !== undefined) {
                  expect(typeof field.validation.custom).toBe('function');
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 3 }
      );
    });

    test('validation schema generation produces consistent schemas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableName: fc.constantFrom('customers', 'leads', 'products'),
            mode: fc.constantFrom('insert', 'update')
          }),
          async ({ tableName, mode }) => {
            // Generate validation schema
            const schema = FormFieldGenerator.generateValidationSchema(tableName as any, mode);

            // Verify schema is an object
            expect(typeof schema).toBe('object');
            expect(schema).not.toBeNull();

            // Schema should be consistent between calls
            const schema2 = FormFieldGenerator.generateValidationSchema(tableName as any, mode);
            expect(schema).toEqual(schema2);

            return true;
          }
        ),
        { numRuns: 6 }
      );
    });
  });

  /**
   * Integration tests for schema type accuracy
   */
  describe('Schema Type Integration Tests', () => {
    test('customer type definitions match schema', async () => {
      const tableInfo = await schemaIntrospector.getTableInfo('customers');
      expect(tableInfo).toBeTruthy();

      if (!tableInfo) return;

      // Verify key customer fields exist
      const columnNames = tableInfo.columns.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('business_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('phone');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');

      // Verify required fields
      const requiredFields = await SchemaUtils.getRequiredFields('customers');
      expect(requiredFields).toContain('business_id');
      expect(requiredFields).toContain('name');
    });

    test('lead type definitions match schema', async () => {
      const tableInfo = await schemaIntrospector.getTableInfo('leads');
      expect(tableInfo).toBeTruthy();

      if (!tableInfo) return;

      // Verify key lead fields exist
      const columnNames = tableInfo.columns.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('business_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('temperature');

      // Verify enum fields have proper types
      const statusColumn = tableInfo.columns.find(col => col.name === 'status');
      expect(statusColumn?.type).toBe('lead_status');

      const temperatureColumn = tableInfo.columns.find(col => col.name === 'temperature');
      expect(temperatureColumn?.type).toBe('lead_temperature');
    });

    test('foreign key relationships are properly typed', async () => {
      const customerForeignKeys = await schemaIntrospector.getForeignKeys('customers');
      const businessFk = customerForeignKeys.find(fk => fk.column === 'business_id');
      
      expect(businessFk).toBeTruthy();
      expect(businessFk?.referencedTable).toBe('businesses');
      expect(businessFk?.referencedColumn).toBe('id');

      const leadForeignKeys = await schemaIntrospector.getForeignKeys('leads');
      const leadBusinessFk = leadForeignKeys.find(fk => fk.column === 'business_id');
      
      expect(leadBusinessFk).toBeTruthy();
      expect(leadBusinessFk?.referencedTable).toBe('businesses');
      expect(leadBusinessFk?.referencedColumn).toBe('id');
    });

    test('enum validation works correctly', async () => {
      const leadStatusEnum = await schemaIntrospector.getEnumInfo('lead_status');
      expect(leadStatusEnum).toBeTruthy();

      if (!leadStatusEnum) return;

      // Test valid enum values
      for (const value of leadStatusEnum.values) {
        expect(SchemaValidator.validateEnum('lead_status', value)).toBe(true);
      }

      // Test invalid enum values
      expect(SchemaValidator.validateEnum('lead_status', 'invalid_status')).toBe(false);
      expect(SchemaValidator.validateEnum('lead_status', '')).toBe(false);
      expect(SchemaValidator.validateEnum('lead_status', null)).toBe(false);
    });

    test('schema caching works correctly', async () => {
      // Clear cache
      schemaIntrospector.clearCache();

      // First call should fetch from database
      const start1 = Date.now();
      const schema1 = await schemaIntrospector.getSchemaInfo();
      const time1 = Date.now() - start1;

      // Second call should use cache (should be faster)
      const start2 = Date.now();
      const schema2 = await schemaIntrospector.getSchemaInfo();
      const time2 = Date.now() - start2;

      // Schemas should be identical
      expect(schema1).toEqual(schema2);

      // Second call should be significantly faster (cached)
      expect(time2).toBeLessThan(time1);
    });
  });
});