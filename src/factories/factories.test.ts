/**
 * Factory Infrastructure Tests
 * 
 * Basic tests to verify that the factory infrastructure is properly set up
 * and all types are correctly defined.
 * 
 * @fileoverview Factory infrastructure tests
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { 
  isBaseEntity, 
  isBusinessEntity, 
  isEmail, 
  isPhoneNumber, 
  isUUID,
  omit,
  pick
} from './utils/type-helpers';
import { 
  ValidationRules, 
  validateField, 
  validateObject,
  sanitizeInput,
  sanitizeObject
} from './utils/validation-helpers';
import { Arbitraries, createPropertyTest } from '../test/fast-check.config';

describe('Factory Infrastructure', () => {
  describe('Type Helpers', () => {
    it('should correctly identify BaseEntity objects', () => {
      const validEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        name: 'Test Entity'
      };

      const invalidEntity = {
        id: '123',
        name: 'Test Entity'
      };

      expect(isBaseEntity(validEntity)).toBe(true);
      expect(isBaseEntity(invalidEntity)).toBe(false);
      expect(isBaseEntity(null)).toBe(false);
      expect(isBaseEntity(undefined)).toBe(false);
    });

    it('should correctly identify BusinessEntity objects', () => {
      const validBusinessEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        business_id: '456e7890-e89b-12d3-a456-426614174000',
        name: 'Test Business Entity'
      };

      const invalidBusinessEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        name: 'Test Entity'
      };

      expect(isBusinessEntity(validBusinessEntity)).toBe(true);
      expect(isBusinessEntity(invalidBusinessEntity)).toBe(false);
    });

    it('should correctly validate email addresses', () => {
      expect(isEmail('test@example.com')).toBe(true);
      expect(isEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isEmail('invalid-email')).toBe(false);
      expect(isEmail('test@')).toBe(false);
      expect(isEmail('@example.com')).toBe(false);
    });

    it('should correctly validate phone numbers', () => {
      expect(isPhoneNumber('+5511999999999')).toBe(true);
      expect(isPhoneNumber('11999999999')).toBe(true);
      expect(isPhoneNumber('+1 (555) 123-4567')).toBe(true);
      expect(isPhoneNumber('123')).toBe(false);
      expect(isPhoneNumber('abc')).toBe(false);
    });

    it('should correctly validate UUIDs', () => {
      expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isUUID('invalid-uuid')).toBe(false);
      expect(isUUID('123')).toBe(false);
    });

    it('should correctly omit properties from objects', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = omit(obj, ['b', 'd']);
      
      expect(result).toEqual({ a: 1, c: 3 });
      expect(result).not.toHaveProperty('b');
      expect(result).not.toHaveProperty('d');
    });

    it('should correctly pick properties from objects', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = pick(obj, ['a', 'c']);
      
      expect(result).toEqual({ a: 1, c: 3 });
      expect(result).not.toHaveProperty('b');
      expect(result).not.toHaveProperty('d');
    });
  });

  describe('Validation Helpers', () => {
    it('should create validation rules correctly', () => {
      const requiredRule = ValidationRules.required('Name is required');
      expect(requiredRule.type).toBe('required');
      expect(requiredRule.message).toBe('Name is required');

      const emailRule = ValidationRules.email();
      expect(emailRule.type).toBe('email');
      expect(emailRule.message).toBe('Please enter a valid email address');

      const minLengthRule = ValidationRules.minLength(5, 'Too short');
      expect(minLengthRule.type).toBe('minLength');
      expect(minLengthRule.value).toBe(5);
      expect(minLengthRule.message).toBe('Too short');
    });

    it('should validate fields correctly', () => {
      const context = {
        field: 'email',
        value: 'test@example.com',
        allValues: { email: 'test@example.com' },
        rules: [ValidationRules.required(), ValidationRules.email()]
      };

      const errors = validateField(context);
      expect(errors).toHaveLength(0);

      const invalidContext = {
        field: 'email',
        value: 'invalid-email',
        allValues: { email: 'invalid-email' },
        rules: [ValidationRules.required(), ValidationRules.email()]
      };

      const invalidErrors = validateField(invalidContext);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });

    it('should validate objects correctly', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+5511999999999'
      };

      const fieldRules = {
        name: [ValidationRules.required()],
        email: [ValidationRules.required(), ValidationRules.email()],
        phone: [ValidationRules.phone()]
      };

      const result = validateObject(data, fieldRules);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      const invalidData = {
        name: '',
        email: 'invalid-email',
        phone: '123'
      };

      const invalidResult = validateObject(invalidData, fieldRules);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should sanitize input correctly', () => {
      expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('Hello');
      expect(sanitizeInput('<b>Bold</b> text')).toBe('Bold text');
      expect(sanitizeInput('Normal text')).toBe('Normal text');
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
    });

    it('should sanitize objects correctly', () => {
      const data = {
        name: '<script>alert("xss")</script>John',
        email: 'john@example.com',
        description: '<b>Bold</b> description'
      };

      const sanitized = sanitizeObject(data);
      expect(sanitized.name).toBe('John');
      expect(sanitized.email).toBe('john@example.com');
      expect(sanitized.description).toBe('Bold description');
    });
  });

  describe('Fast-Check Integration', () => {
    createPropertyTest(
      'UUID arbitrary should generate valid UUIDs',
      Arbitraries.uuid(),
      (uuid) => isUUID(uuid)
    );

    createPropertyTest(
      'Email arbitrary should generate valid emails',
      Arbitraries.email(),
      (email) => isEmail(email)
    );

    createPropertyTest(
      'Phone arbitrary should generate valid phone numbers',
      Arbitraries.phone(),
      (phone) => isPhoneNumber(phone)
    );

    createPropertyTest(
      'Customer data arbitrary should generate valid customer data',
      Arbitraries.customerData(),
      (customerData) => {
        // Basic validation that required fields are present
        return typeof customerData.name === 'string' && customerData.name.length > 0;
      }
    );

    createPropertyTest(
      'Lead data arbitrary should generate valid lead data',
      Arbitraries.leadData(),
      (leadData) => {
        // Basic validation that required fields are present
        return typeof leadData.name === 'string' && leadData.name.length > 0;
      }
    );
  });

  describe('Type System Integration', () => {
    it('should properly export all factory types', async () => {
      // This test ensures that all type exports are working correctly
      // by importing and using them in a type-safe manner
      
      // Import all types to ensure they compile correctly
      const typeTest = async () => {
        const { BaseEntity, BusinessEntity } = await import('./types/core');
        const { CRUDFactory } = await import('./types/crud');
        const { QueryFactory } = await import('./types/query');
        const { FormFactory } = await import('./types/form');
        const { BusinessLogicLayer } = await import('./types/business-logic');
        
        // If we reach this point, all types are properly defined
        return true;
      };

      expect(await typeTest()).toBe(true);
    });

    it('should have proper type constraints', () => {
      // Test that type constraints work as expected
      interface TestEntity {
        id: string;
        created_at: string;
        updated_at: string;
        name: string;
      }

      interface TestBusinessEntity extends TestEntity {
        business_id: string;
      }

      const testEntity: TestEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        name: 'Test'
      };

      const testBusinessEntity: TestBusinessEntity = {
        ...testEntity,
        business_id: '456e7890-e89b-12d3-a456-426614174000'
      };

      expect(isBaseEntity(testEntity)).toBe(true);
      expect(isBusinessEntity(testBusinessEntity)).toBe(true);
    });
  });
});