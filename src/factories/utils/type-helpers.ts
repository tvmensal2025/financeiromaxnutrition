/**
 * Type Helper Utilities
 * 
 * Utility types and helper functions for working with TypeScript generics
 * and type inference in the factory system.
 * 
 * @fileoverview Type helper utilities for factory system
 * @version 1.0.0
 */

import { BaseEntity, BusinessEntity } from '../types/core';

/**
 * Extract keys from a type that are of a specific type.
 * Useful for getting only string fields, number fields, etc.
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Extract keys from a type that are optional.
 * Useful for understanding which fields can be omitted.
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Extract keys from a type that are required.
 * Useful for validation and form generation.
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Make specific keys optional in a type.
 * More flexible than Partial<T>.
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific keys required in a type.
 * More flexible than Required<T>.
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Deep partial type that makes all nested properties optional.
 * Useful for update operations with nested objects.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract the value type from a Promise.
 * Useful for working with async factory operations.
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Create a union type from an array of string literals.
 * Useful for creating type-safe enums from arrays.
 */
export type ArrayToUnion<T extends readonly string[]> = T[number];

/**
 * Check if a type is a BaseEntity.
 * Useful for type guards and validation.
 */
export type IsBaseEntity<T> = T extends BaseEntity ? true : false;

/**
 * Check if a type is a BusinessEntity.
 * Useful for type guards and validation.
 */
export type IsBusinessEntity<T> = T extends BusinessEntity ? true : false;

/**
 * Extract entity type from a factory type.
 * Useful for type inference in generic contexts.
 */
export type ExtractEntityFromFactory<T> = T extends { entity: infer E } ? E : never;

/**
 * Create a type with only the database fields (excluding computed fields).
 * Useful for insert/update operations.
 */
export type DatabaseFields<T extends BaseEntity> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/**
 * Create a type for entity creation data.
 * Omits auto-generated fields and makes business_id required for business entities.
 */
export type CreateEntityData<T extends BaseEntity> = T extends BusinessEntity
  ? RequiredBy<DatabaseFields<T>, 'business_id'>
  : DatabaseFields<T>;

/**
 * Create a type for entity update data.
 * Makes all fields optional except business_id which should not be updated.
 */
export type UpdateEntityData<T extends BaseEntity> = T extends BusinessEntity
  ? Partial<Omit<DatabaseFields<T>, 'business_id'>>
  : Partial<DatabaseFields<T>>;

/**
 * Extract string literal types from an object's values.
 * Useful for creating type-safe constants.
 */
export type ValueOf<T> = T[keyof T];

/**
 * Create a type that represents a function's parameters as an object.
 * Useful for creating configuration objects from function signatures.
 */
export type FunctionParams<T extends (...args: any[]) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;

/**
 * Create a type that represents a function's return type.
 * More explicit than ReturnType<T> for documentation purposes.
 */
export type FunctionReturn<T extends (...args: any[]) => any> = ReturnType<T>;

/**
 * Create a type that excludes null and undefined.
 * Useful for ensuring non-nullable types.
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Create a type that represents the keys of an object as a union.
 * More explicit than keyof T for documentation purposes.
 */
export type KeysOf<T> = keyof T;

/**
 * Create a type that represents a nested property path.
 * Useful for type-safe property access in deep objects.
 */
export type PropertyPath<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? `${K}` | `${K}.${PropertyPath<T[K]>}`
    : `${K}`
  : never;

/**
 * Get the type of a nested property by path.
 * Useful for type-safe property access.
 */
export type PropertyType<T, P extends PropertyPath<T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends PropertyPath<T[K]>
      ? PropertyType<T[K], Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

/**
 * Type guard to check if a value is a BaseEntity.
 */
export function isBaseEntity(value: unknown): value is BaseEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'created_at' in value &&
    'updated_at' in value &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).created_at === 'string' &&
    typeof (value as any).updated_at === 'string'
  );
}

/**
 * Type guard to check if a value is a BusinessEntity.
 */
export function isBusinessEntity(value: unknown): value is BusinessEntity {
  return (
    isBaseEntity(value) &&
    'business_id' in value &&
    typeof (value as any).business_id === 'string'
  );
}

/**
 * Type guard to check if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a valid UUID.
 */
export function isUUID(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard to check if a value is a valid email.
 */
export function isEmail(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Type guard to check if a value is a valid phone number.
 */
export function isPhoneNumber(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  
  // Basic phone number validation (can be enhanced)
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(value);
}

/**
 * Utility function to safely access nested properties.
 */
export function getNestedProperty<T, P extends PropertyPath<T>>(
  obj: T,
  path: P
): PropertyType<T, P> | undefined {
  const keys = path.split('.') as Array<keyof any>;
  let current: any = obj;
  
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

/**
 * Utility function to safely set nested properties.
 */
export function setNestedProperty<T>(
  obj: T,
  path: string,
  value: unknown
): T {
  const keys = path.split('.');
  const result = { ...obj } as any;
  let current = result;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    } else {
      current[key] = { ...current[key] };
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return result;
}

/**
 * Utility function to omit properties from an object.
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Utility function to pick properties from an object.
 */
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}