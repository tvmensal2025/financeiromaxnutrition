/**
 * Validation Helper Utilities
 * 
 * Utility functions for validating data in the factory system.
 * Provides common validation patterns and error handling.
 * 
 * @fileoverview Validation helper utilities for factory system
 * @version 1.0.0
 */

import { ValidationRule, FactoryError } from '../types/core';
import { isEmail, isPhoneNumber, isUUID, isNonEmptyString } from './type-helpers';

/**
 * Validation result interface.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, string[]>;
}

/**
 * Validation context interface.
 */
export interface ValidationContext {
  field: string;
  value: unknown;
  allValues: Record<string, unknown>;
  rules: ValidationRule[];
}

/**
 * Create a validation error.
 */
export function createValidationError(
  message: string,
  field?: string,
  code?: string
): FactoryError {
  return {
    message,
    code: code || 'VALIDATION_ERROR',
    context: field ? `field:${field}` : 'validation',
    metadata: { field }
  };
}

/**
 * Validate a single field against its rules.
 */
export function validateField(context: ValidationContext): string[] {
  const { field, value, allValues, rules } = context;
  const errors: string[] = [];

  for (const rule of rules) {
    const error = validateRule(rule, value, allValues, field);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Validate a single rule against a value.
 */
export function validateRule(
  rule: ValidationRule,
  value: unknown,
  allValues: Record<string, unknown>,
  field: string
): string | null {
  switch (rule.type) {
    case 'required':
      return validateRequired(value, rule.message);
    
    case 'email':
      return validateEmail(value, rule.message);
    
    case 'phone':
      return validatePhone(value, rule.message);
    
    case 'minLength':
      return validateMinLength(value, rule.value as number, rule.message);
    
    case 'maxLength':
      return validateMaxLength(value, rule.value as number, rule.message);
    
    case 'pattern':
      return validatePattern(value, rule.value as RegExp, rule.message);
    
    case 'custom':
      return validateCustom(value, rule.validator!, allValues, field, rule.message);
    
    default:
      return null;
  }
}

/**
 * Validate required field.
 */
export function validateRequired(value: unknown, message: string): string | null {
  if (value === null || value === undefined || value === '') {
    return message;
  }
  
  if (Array.isArray(value) && value.length === 0) {
    return message;
  }
  
  return null;
}

/**
 * Validate email format.
 */
export function validateEmail(value: unknown, message: string): string | null {
  if (value === null || value === undefined || value === '') {
    return null; // Empty values are handled by required rule
  }
  
  if (!isEmail(value)) {
    return message;
  }
  
  return null;
}

/**
 * Validate phone number format.
 */
export function validatePhone(value: unknown, message: string): string | null {
  if (value === null || value === undefined || value === '') {
    return null; // Empty values are handled by required rule
  }
  
  if (!isPhoneNumber(value)) {
    return message;
  }
  
  return null;
}

/**
 * Validate minimum length.
 */
export function validateMinLength(
  value: unknown,
  minLength: number,
  message: string
): string | null {
  if (value === null || value === undefined) {
    return null; // Empty values are handled by required rule
  }
  
  const stringValue = String(value);
  if (stringValue.length < minLength) {
    return message;
  }
  
  return null;
}

/**
 * Validate maximum length.
 */
export function validateMaxLength(
  value: unknown,
  maxLength: number,
  message: string
): string | null {
  if (value === null || value === undefined) {
    return null; // Empty values are handled by required rule
  }
  
  const stringValue = String(value);
  if (stringValue.length > maxLength) {
    return message;
  }
  
  return null;
}

/**
 * Validate against a regular expression pattern.
 */
export function validatePattern(
  value: unknown,
  pattern: RegExp,
  message: string
): string | null {
  if (value === null || value === undefined || value === '') {
    return null; // Empty values are handled by required rule
  }
  
  const stringValue = String(value);
  if (!pattern.test(stringValue)) {
    return message;
  }
  
  return null;
}

/**
 * Validate using a custom validator function.
 */
export function validateCustom(
  value: unknown,
  validator: (value: unknown) => boolean,
  allValues: Record<string, unknown>,
  field: string,
  message: string
): string | null {
  try {
    if (!validator(value)) {
      return message;
    }
    return null;
  } catch (error) {
    return `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Validate an entire object against field rules.
 */
export function validateObject(
  data: Record<string, unknown>,
  fieldRules: Record<string, ValidationRule[]>
): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};
  let hasErrors = false;

  for (const [field, rules] of Object.entries(fieldRules)) {
    const context: ValidationContext = {
      field,
      value: data[field],
      allValues: data,
      rules
    };

    const errors = validateField(context);
    if (errors.length > 0) {
      fieldErrors[field] = errors;
      hasErrors = true;
    }
  }

  return {
    isValid: !hasErrors,
    errors: Object.values(fieldErrors).flat(),
    fieldErrors
  };
}

/**
 * Common validation rules factory.
 */
export const ValidationRules = {
  /**
   * Create a required field rule.
   */
  required(message = 'This field is required'): ValidationRule {
    return {
      type: 'required',
      message
    };
  },

  /**
   * Create an email validation rule.
   */
  email(message = 'Please enter a valid email address'): ValidationRule {
    return {
      type: 'email',
      message
    };
  },

  /**
   * Create a phone number validation rule.
   */
  phone(message = 'Please enter a valid phone number'): ValidationRule {
    return {
      type: 'phone',
      message
    };
  },

  /**
   * Create a minimum length validation rule.
   */
  minLength(length: number, message?: string): ValidationRule {
    return {
      type: 'minLength',
      value: length,
      message: message || `Must be at least ${length} characters long`
    };
  },

  /**
   * Create a maximum length validation rule.
   */
  maxLength(length: number, message?: string): ValidationRule {
    return {
      type: 'maxLength',
      value: length,
      message: message || `Must be no more than ${length} characters long`
    };
  },

  /**
   * Create a pattern validation rule.
   */
  pattern(regex: RegExp, message = 'Invalid format'): ValidationRule {
    return {
      type: 'pattern',
      value: regex,
      message
    };
  },

  /**
   * Create a custom validation rule.
   */
  custom(
    validator: (value: unknown) => boolean,
    message = 'Invalid value'
  ): ValidationRule {
    return {
      type: 'custom',
      validator,
      message
    };
  },

  /**
   * Create a UUID validation rule.
   */
  uuid(message = 'Please enter a valid UUID'): ValidationRule {
    return {
      type: 'custom',
      validator: isUUID,
      message
    };
  },

  /**
   * Create a non-empty string validation rule.
   */
  nonEmptyString(message = 'This field cannot be empty'): ValidationRule {
    return {
      type: 'custom',
      validator: isNonEmptyString,
      message
    };
  },

  /**
   * Create a numeric validation rule.
   */
  numeric(message = 'Please enter a valid number'): ValidationRule {
    return {
      type: 'custom',
      validator: (value) => !isNaN(Number(value)),
      message
    };
  },

  /**
   * Create a positive number validation rule.
   */
  positive(message = 'Please enter a positive number'): ValidationRule {
    return {
      type: 'custom',
      validator: (value) => {
        const num = Number(value);
        return !isNaN(num) && num > 0;
      },
      message
    };
  },

  /**
   * Create a date validation rule.
   */
  date(message = 'Please enter a valid date'): ValidationRule {
    return {
      type: 'custom',
      validator: (value) => {
        if (!value) return true; // Let required rule handle empty values
        const date = new Date(String(value));
        return !isNaN(date.getTime());
      },
      message
    };
  },

  /**
   * Create a future date validation rule.
   */
  futureDate(message = 'Date must be in the future'): ValidationRule {
    return {
      type: 'custom',
      validator: (value) => {
        if (!value) return true; // Let required rule handle empty values
        const date = new Date(String(value));
        return !isNaN(date.getTime()) && date > new Date();
      },
      message
    };
  },

  /**
   * Create a past date validation rule.
   */
  pastDate(message = 'Date must be in the past'): ValidationRule {
    return {
      type: 'custom',
      validator: (value) => {
        if (!value) return true; // Let required rule handle empty values
        const date = new Date(String(value));
        return !isNaN(date.getTime()) && date < new Date();
      },
      message
    };
  }
};

/**
 * Sanitize input data by removing potentially harmful content.
 */
export function sanitizeInput(value: unknown): unknown {
  if (typeof value === 'string') {
    // Basic HTML/script tag removal
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }
  
  return value;
}

/**
 * Sanitize an entire object.
 */
export function sanitizeObject(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = sanitizeInput(value);
  }
  
  return sanitized;
}