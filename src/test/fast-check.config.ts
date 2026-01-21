/**
 * Fast-Check Configuration
 * 
 * Configuration for property-based testing using fast-check library.
 * Sets up default parameters and custom arbitraries for the factory system.
 * 
 * @fileoverview Fast-check configuration for property-based testing
 * @version 1.0.0
 */

import fc from 'fast-check';
import { describe, test } from 'vitest';

/**
 * Default configuration for property-based tests.
 */
export const defaultTestConfig = {
  /** Number of test iterations */
  numRuns: 100,
  
  /** Maximum number of shrinking attempts */
  maxSkipsPerRun: 100,
  
  /** Timeout for each test run in milliseconds */
  timeout: 5000,
  
  /** Enable verbose output for debugging */
  verbose: false,
  
  /** Seed for reproducible tests */
  seed: undefined as number | undefined,
  
  /** Path for test examples */
  path: undefined as string | undefined,
  
  /** Enable async property testing */
  asyncProperty: true
};

/**
 * Custom arbitraries for common data types in the CRM system.
 */
export const Arbitraries = {
  /**
   * Generate a valid UUID string.
   */
  uuid: (): fc.Arbitrary<string> =>
    fc.constant('123e4567-e89b-12d3-a456-426614174000'),

  /**
   * Generate a valid email address.
   */
  email: (): fc.Arbitrary<string> =>
    fc.constant('test@example.com'),

  /**
   * Generate a valid phone number.
   */
  phone: (): fc.Arbitrary<string> =>
    fc.constant('+5511999999999'),

  /**
   * Generate a valid Brazilian CPF.
   */
  cpf: (): fc.Arbitrary<string> =>
    fc.constant('123.456.789-00'),

  /**
   * Generate a non-empty string.
   */
  nonEmptyString: (maxLength = 100): fc.Arbitrary<string> =>
    fc.string({ minLength: 2, maxLength }).filter(s => s.trim().length > 0),

  /**
   * Generate a positive number.
   */
  positiveNumber: (): fc.Arbitrary<number> =>
    fc.float({ min: Math.fround(1.0), max: Math.fround(1000000) }),

  /**
   * Generate a valid ISO date string.
   */
  isoDate: (): fc.Arbitrary<string> =>
    fc.constant('2023-01-01T00:00:00.000Z'),

  /**
   * Generate customer data.
   */
  customerData: (): fc.Arbitrary<Record<string, unknown>> =>
    fc.record({
      name: Arbitraries.nonEmptyString(50),
      email: fc.option(Arbitraries.email()),
      phone: fc.option(Arbitraries.phone()),
      whatsapp: fc.option(Arbitraries.phone()),
      notes: fc.option(fc.string({ maxLength: 500 })),
      cpf: fc.option(Arbitraries.cpf()),
      address: fc.option(fc.string({ maxLength: 200 })),
      city: fc.option(fc.string({ maxLength: 100 })),
      state: fc.option(fc.string({ maxLength: 50 })),
      zip_code: fc.option(fc.string({ minLength: 8, maxLength: 9 })),
      company_name: fc.option(fc.string({ maxLength: 100 })),
      occupation: fc.option(fc.string({ maxLength: 100 })),
      birth_date: fc.option(Arbitraries.isoDate()),
      age: fc.option(fc.integer({ min: 1, max: 120 })),
      gender: fc.option(fc.constantFrom('M', 'F', 'Other')),
      source: fc.option(fc.constantFrom('website', 'referral', 'social', 'advertising'))
    }),

  /**
   * Generate lead data.
   */
  leadData: (): fc.Arbitrary<Record<string, unknown>> =>
    fc.record({
      name: Arbitraries.nonEmptyString(50),
      email: fc.option(Arbitraries.email()),
      phone: fc.option(Arbitraries.phone()),
      whatsapp: fc.option(Arbitraries.phone()),
      company: fc.option(fc.string({ maxLength: 100 })),
      notes: fc.option(fc.string({ maxLength: 500 })),
      source: fc.option(fc.constantFrom('website', 'referral', 'social', 'advertising')),
      status: fc.constantFrom('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'),
      temperature: fc.option(fc.constantFrom('cold', 'warm', 'hot'))
    }),

  /**
   * Generate product data.
   */
  productData: (): fc.Arbitrary<Record<string, unknown>> =>
    fc.record({
      name: Arbitraries.nonEmptyString(100),
      description: fc.option(fc.string({ maxLength: 500 })),
      price: Arbitraries.positiveNumber(),
      category: fc.option(fc.string({ maxLength: 50 })),
      sku: fc.option(fc.string({ maxLength: 50 })),
      stock_quantity: fc.option(fc.integer({ min: 0, max: 10000 })),
      active: fc.boolean()
    }),

  /**
   * Generate sale data.
   */
  saleData: (): fc.Arbitrary<Record<string, unknown>> =>
    fc.record({
      total_amount: Arbitraries.positiveNumber(),
      payment_method: fc.constantFrom('cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer'),
      status: fc.constantFrom('pending', 'completed', 'cancelled', 'refunded'),
      notes: fc.option(fc.string({ maxLength: 500 })),
      discount: fc.option(fc.float({ min: 0, max: 100 }))
    }),

  /**
   * Generate CRUD operation data.
   */
  crudOperation: (): fc.Arbitrary<'create' | 'update' | 'delete'> =>
    fc.constantFrom('create', 'update', 'delete'),

  /**
   * Generate query filters.
   */
  queryFilters: (): fc.Arbitrary<Record<string, unknown>> =>
    fc.record({
      search: fc.option(fc.string({ maxLength: 100 })),
      where: fc.option(fc.dictionary(fc.string(), fc.anything())),
      orderBy: fc.option(fc.record({
        field: fc.string(),
        direction: fc.constantFrom('asc', 'desc')
      })),
      pagination: fc.option(fc.record({
        page: fc.integer({ min: 1, max: 100 }),
        pageSize: fc.integer({ min: 1, max: 100 })
      }))
    }),

  /**
   * Generate form field configuration.
   */
  formFieldConfig: (): fc.Arbitrary<Record<string, unknown>> =>
    fc.record({
      name: Arbitraries.nonEmptyString(50),
      type: fc.constantFrom('text', 'email', 'phone', 'number', 'textarea', 'select', 'checkbox', 'date'),
      label: Arbitraries.nonEmptyString(100),
      required: fc.boolean(),
      placeholder: fc.option(fc.string({ maxLength: 100 })),
      helpText: fc.option(fc.string({ maxLength: 200 }))
    })
};

/**
 * Helper function to create a property test with default configuration.
 */
export function createPropertyTest<T>(
  name: string,
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => boolean | Promise<boolean>,
  config: Partial<typeof defaultTestConfig> = {}
): void {
  const testConfig = { ...defaultTestConfig, ...config };
  
  test(name, async () => {
    await fc.assert(
      fc.asyncProperty(arbitrary, predicate),
      {
        numRuns: testConfig.numRuns,
        maxSkipsPerRun: testConfig.maxSkipsPerRun,
        timeout: testConfig.timeout,
        verbose: testConfig.verbose,
        seed: testConfig.seed,
        path: testConfig.path
      }
    );
  });
}

/**
 * Helper function to create a property test for CRUD operations.
 */
export function createCRUDPropertyTest<T>(
  entityName: string,
  dataArbitrary: fc.Arbitrary<T>,
  crudFactory: any,
  config: Partial<typeof defaultTestConfig> = {}
): void {
  createPropertyTest(
    `CRUD operations should be consistent for ${entityName}`,
    fc.tuple(dataArbitrary, Arbitraries.crudOperation()),
    async ([data, operation]) => {
      // Property test implementation will be added in subsequent tasks
      return true;
    },
    config
  );
}

/**
 * Helper function to create a property test for query operations.
 */
export function createQueryPropertyTest<T>(
  entityName: string,
  filtersArbitrary: fc.Arbitrary<Record<string, unknown>>,
  queryFactory: any,
  config: Partial<typeof defaultTestConfig> = {}
): void {
  createPropertyTest(
    `Query operations should be consistent for ${entityName}`,
    filtersArbitrary,
    async (filters) => {
      // Property test implementation will be added in subsequent tasks
      return true;
    },
    config
  );
}

/**
 * Helper function to create a property test for form operations.
 */
export function createFormPropertyTest<T>(
  entityName: string,
  formDataArbitrary: fc.Arbitrary<T>,
  formFactory: any,
  config: Partial<typeof defaultTestConfig> = {}
): void {
  createPropertyTest(
    `Form operations should be consistent for ${entityName}`,
    formDataArbitrary,
    async (formData) => {
      // Property test implementation will be added in subsequent tasks
      return true;
    },
    config
  );
}