/**
 * Form-CRUD Integration Tests
 * 
 * Tests for the integration between form dialog system and CRUD factory.
 * 
 * @fileoverview Form-CRUD integration tests
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFormCRUDIntegration, createEntityManagementSystem } from './formCRUDIntegration';
import { createCRUDFactory } from '../createCRUDFactory';
import { FormFieldConfig } from '../types/form';

// Mock dependencies
vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn()
  }))
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: { id: '1', name: 'Test' }, error: null }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: { id: '1', name: 'Updated' }, error: null }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null }))
      }))
    }))
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    business: { id: 'business-1' }
  }))
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn()
  }))
}));

// Test entity interface
interface TestEntity {
  id: string;
  name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

describe('Form-CRUD Integration', () => {
  const testFields: FormFieldConfig[] = [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: false
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFormCRUDIntegration', () => {
    it('creates an integrated form-CRUD factory', () => {
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities',
        successMessages: {
          create: 'Created successfully',
          update: 'Updated successfully',
          delete: 'Deleted successfully'
        }
      });

      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType: 'TestEntity',
        fields: testFields,
        crudFactory
      });

      expect(integrated).toBeDefined();
      expect(integrated.FormDialog).toBeDefined();
      expect(integrated.FormDialogWithCRUD).toBeDefined();
      expect(integrated.crud).toBe(crudFactory);
      expect(integrated.getCRUDFactory()).toBe(crudFactory);
    });

    it('provides form factory methods', () => {
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType: 'TestEntity',
        fields: testFields,
        crudFactory
      });

      expect(integrated.getFields()).toEqual(testFields);
      expect(integrated.getEntityType()).toBe('TestEntity');
      expect(integrated.getConfig()).toBeDefined();
      expect(typeof integrated.validate).toBe('function');
    });

    it('supports data transformation', () => {
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const transformData = {
        beforeCreate: vi.fn((data) => ({ ...data, status: 'active' })),
        beforeUpdate: vi.fn((data) => ({ ...data, updated: true }))
      };

      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType: 'TestEntity',
        fields: testFields,
        crudFactory,
        transformData
      });

      expect(integrated).toBeDefined();
      // Transformation functions are stored in the configuration
      expect(integrated.getConfig().transformData).toBeDefined();
    });

    it('supports custom success and error handlers', () => {
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const onOperationSuccess = {
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn()
      };

      const onOperationError = {
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn()
      };

      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType: 'TestEntity',
        fields: testFields,
        crudFactory,
        onOperationSuccess,
        onOperationError
      });

      expect(integrated).toBeDefined();
      // Handlers are stored in the configuration
      expect(integrated.getConfig().onOperationSuccess).toBeDefined();
      expect(integrated.getConfig().onOperationError).toBeDefined();
    });
  });

  describe('createEntityManagementSystem', () => {
    it('creates a complete entity management system', () => {
      const system = createEntityManagementSystem<TestEntity>({
        entityType: 'TestEntity',
        tableName: 'test_entities',
        fields: testFields,
        successMessages: {
          create: 'Created!',
          update: 'Updated!',
          delete: 'Deleted!'
        }
      });

      expect(system).toBeDefined();
      expect(system.FormDialog).toBeDefined();
      expect(system.FormDialogWithCRUD).toBeDefined();
      expect(system.crud).toBeDefined();
      expect(system.getCRUDFactory()).toBeDefined();
    });

    it('uses provided CRUD factory if available', () => {
      const customCRUDFactory = createCRUDFactory<TestEntity>({
        tableName: 'custom_table'
      });

      const system = createEntityManagementSystem<TestEntity>({
        entityType: 'TestEntity',
        tableName: 'test_entities',
        fields: testFields,
        crudFactory: customCRUDFactory
      });

      expect(system.getCRUDFactory()).toBe(customCRUDFactory);
    });

    it('creates CRUD factory if not provided', () => {
      const system = createEntityManagementSystem<TestEntity>({
        entityType: 'TestEntity',
        tableName: 'test_entities',
        fields: testFields
      });

      expect(system.getCRUDFactory()).toBeDefined();
      expect(system.getCRUDFactory().getTableName()).toBe('test_entities');
    });
  });

  describe('Integration Properties', () => {
    it('maintains form factory interface', () => {
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType: 'TestEntity',
        fields: testFields,
        crudFactory
      });

      // Should have all form factory methods
      expect(typeof integrated.FormDialog).toBe('function');
      expect(typeof integrated.getFields).toBe('function');
      expect(typeof integrated.validate).toBe('function');
      expect(typeof integrated.getEntityType).toBe('function');
      expect(typeof integrated.getConfig).toBe('function');
    });

    it('maintains CRUD factory interface', () => {
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType: 'TestEntity',
        fields: testFields,
        crudFactory
      });

      // Should have all CRUD factory methods
      expect(typeof integrated.crud.useCreate).toBe('function');
      expect(typeof integrated.crud.useUpdate).toBe('function');
      expect(typeof integrated.crud.useDelete).toBe('function');
      expect(typeof integrated.crud.getTableName).toBe('function');
      expect(typeof integrated.crud.getConfig).toBe('function');
    });

    it('provides integrated dialog component', () => {
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType: 'TestEntity',
        fields: testFields,
        crudFactory
      });

      expect(typeof integrated.FormDialogWithCRUD).toBe('function');
      expect(integrated.FormDialogWithCRUD.name).toBe('FormDialogWithCRUD');
    });
  });
});

/**
 * Property-Based Tests for Form CRUD Integration
 * 
 * Property tests to validate that the form-CRUD integration works correctly
 * across different entity types and operation scenarios.
 */

import fc from 'fast-check';
import { Arbitraries, createPropertyTest } from '../../test/fast-check.config';

describe('Property Tests - Form CRUD Integration', () => {
  /**
   * Property 14: Form CRUD Integration
   * **Validates: Requirements 3.4**
   * 
   * For any form submission (create or update), the form dialog should
   * properly trigger the appropriate CRUD operations.
   */
  createPropertyTest(
    'Property 14: Form CRUD Integration - Form submissions trigger correct CRUD operations',
    fc.record({
      entityType: fc.constantFrom('customer', 'lead', 'product', 'service'),
      tableName: fc.constantFrom('customers', 'leads', 'products', 'services'),
      operation: fc.constantFrom('create', 'update'),
      entityData: fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        email: fc.option(fc.string({ minLength: 5, maxLength: 50 })),
        phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
        notes: fc.option(fc.string({ maxLength: 200 }))
      }),
      entityId: fc.option(fc.uuid()),
      hasTransformation: fc.boolean(),
      hasSuccessHandler: fc.boolean(),
      hasErrorHandler: fc.boolean()
    }),
    async ({ 
      entityType, 
      tableName, 
      operation, 
      entityData, 
      entityId, 
      hasTransformation,
      hasSuccessHandler,
      hasErrorHandler 
    }) => {
      // Create CRUD factory
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName,
        successMessages: {
          create: `${entityType} created successfully`,
          update: `${entityType} updated successfully`,
          delete: `${entityType} deleted successfully`
        }
      });

      // Setup transformation functions if needed
      const transformData = hasTransformation ? {
        beforeCreate: (data: any) => ({ ...data, transformed: true }),
        beforeUpdate: (data: any) => ({ ...data, updated: true })
      } : undefined;

      // Setup success handlers if needed
      const onOperationSuccess = hasSuccessHandler ? {
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn()
      } : undefined;

      // Setup error handlers if needed
      const onOperationError = hasErrorHandler ? {
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn()
      } : undefined;

      // Create integrated form-CRUD factory
      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType,
        fields: [
          {
            name: 'name',
            label: 'Name',
            type: 'text',
            required: true
          },
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            required: false
          }
        ],
        crudFactory,
        transformData,
        onOperationSuccess,
        onOperationError
      });

      // Property 1: Integration should be created successfully
      expect(integrated).toBeDefined();
      expect(integrated.FormDialogWithCRUD).toBeDefined();
      expect(integrated.crud).toBe(crudFactory);

      // Property 2: CRUD factory should be accessible
      expect(integrated.getCRUDFactory()).toBe(crudFactory);
      expect(integrated.getCRUDFactory().getTableName()).toBe(tableName);

      // Property 3: Form factory methods should be available
      expect(integrated.getFields()).toHaveLength(2);
      expect(integrated.getEntityType()).toBe(entityType);

      // Property 4: Configuration should include integration options
      const config = integrated.getConfig();
      expect(config).toBeDefined();
      
      if (hasTransformation) {
        expect(config.transformData).toBeDefined();
      }
      
      if (hasSuccessHandler) {
        expect(config.onOperationSuccess).toBeDefined();
      }
      
      if (hasErrorHandler) {
        expect(config.onOperationError).toBeDefined();
      }

      // Property 5: Both form and CRUD operations should be available
      expect(typeof integrated.FormDialog).toBe('function');
      expect(typeof integrated.FormDialogWithCRUD).toBe('function');
      expect(typeof integrated.crud.useCreate).toBe('function');
      expect(typeof integrated.crud.useUpdate).toBe('function');
      expect(typeof integrated.crud.useDelete).toBe('function');

      return true;
    },
    { numRuns: 25 }
  );

  /**
   * Property 15: Entity Management System Completeness
   * **Validates: Requirements 3.4**
   * 
   * For any entity configuration, the entity management system should
   * provide complete CRUD and form capabilities.
   */
  createPropertyTest(
    'Property 15: Entity Management System - Complete entity management capabilities',
    fc.record({
      entityType: fc.string({ minLength: 3, maxLength: 20 }),
      tableName: fc.string({ minLength: 3, maxLength: 30 }),
      fieldCount: fc.integer({ min: 1, max: 8 }),
      hasSuccessMessages: fc.boolean(),
      hasErrorMessages: fc.boolean(),
      hasCustomCRUD: fc.boolean()
    }),
    async ({ 
      entityType, 
      tableName, 
      fieldCount, 
      hasSuccessMessages, 
      hasErrorMessages,
      hasCustomCRUD 
    }) => {
      // Generate fields dynamically
      const fields = Array.from({ length: fieldCount }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text' as const,
        required: i === 0 // First field is required
      }));

      // Setup messages if needed
      const successMessages = hasSuccessMessages ? {
        create: `${entityType} created!`,
        update: `${entityType} updated!`,
        delete: `${entityType} deleted!`
      } : undefined;

      const errorMessages = hasErrorMessages ? {
        create: `Failed to create ${entityType}`,
        update: `Failed to update ${entityType}`,
        delete: `Failed to delete ${entityType}`
      } : undefined;

      // Setup custom CRUD factory if needed
      const customCRUDFactory = hasCustomCRUD ? createCRUDFactory<TestEntity>({
        tableName: `custom_${tableName}`,
        successMessages,
        errorMessages
      }) : undefined;

      // Create entity management system
      const system = createEntityManagementSystem<TestEntity>({
        entityType,
        tableName,
        fields,
        successMessages,
        errorMessages,
        ...(customCRUDFactory && { crudFactory: customCRUDFactory })
      });

      // Property 1: System should be created successfully
      expect(system).toBeDefined();

      // Property 2: All required components should be available
      expect(system.FormDialog).toBeDefined();
      expect(system.FormDialogWithCRUD).toBeDefined();
      expect(system.crud).toBeDefined();

      // Property 3: CRUD factory should have correct configuration
      const crudFactory = system.getCRUDFactory();
      expect(crudFactory).toBeDefined();
      
      if (hasCustomCRUD) {
        expect(crudFactory.getTableName()).toBe(`custom_${tableName}`);
      } else {
        expect(crudFactory.getTableName()).toBe(tableName);
      }

      // Property 4: Form configuration should match input
      expect(system.getFields()).toEqual(fields);
      expect(system.getEntityType()).toBe(entityType);

      // Property 5: All CRUD operations should be available
      expect(typeof system.crud.useCreate).toBe('function');
      expect(typeof system.crud.useUpdate).toBe('function');
      expect(typeof system.crud.useDelete).toBe('function');

      // Property 6: Form operations should be available
      expect(typeof system.validate).toBe('function');
      expect(typeof system.getConfig).toBe('function');

      return true;
    },
    { numRuns: 20 }
  );

  /**
   * Property 16: Data Transformation Consistency
   * **Validates: Requirements 3.4**
   * 
   * For any data transformation configuration, the integration should
   * apply transformations consistently across operations.
   */
  createPropertyTest(
    'Property 16: Data Transformation - Consistent data transformation across operations',
    fc.record({
      baseData: fc.record({
        name: fc.string({ minLength: 1, maxLength: 30 }),
        value: fc.integer({ min: 1, max: 1000 }),
        active: fc.boolean()
      }),
      createTransform: fc.record({
        addField: fc.string({ minLength: 1, maxLength: 10 }),
        addValue: fc.anything()
      }),
      updateTransform: fc.record({
        addField: fc.string({ minLength: 1, maxLength: 10 }),
        addValue: fc.anything()
      })
    }),
    async ({ baseData, createTransform, updateTransform }) => {
      const crudFactory = createCRUDFactory<TestEntity>({
        tableName: 'test_entities'
      });

      // Create transformation functions
      const transformData = {
        beforeCreate: (data: any) => ({
          ...data,
          [createTransform.addField]: createTransform.addValue,
          createdTransformed: true
        }),
        beforeUpdate: (data: any) => ({
          ...data,
          [updateTransform.addField]: updateTransform.addValue,
          updatedTransformed: true
        })
      };

      const integrated = createFormCRUDIntegration<TestEntity>({
        entityType: 'TestEntity',
        fields: [
          {
            name: 'name',
            label: 'Name',
            type: 'text',
            required: true
          },
          {
            name: 'value',
            label: 'Value',
            type: 'number',
            required: false
          }
        ],
        crudFactory,
        transformData
      });

      // Property 1: Integration should store transformation functions
      const config = integrated.getConfig();
      expect(config.transformData).toBeDefined();
      expect(config.transformData?.beforeCreate).toBeDefined();
      expect(config.transformData?.beforeUpdate).toBeDefined();

      // Property 2: Transformation functions should be callable
      const createResult = config.transformData!.beforeCreate!(baseData);
      expect(createResult).toHaveProperty('createdTransformed', true);
      expect(createResult).toHaveProperty(createTransform.addField, createTransform.addValue);
      expect(createResult.name).toBe(baseData.name);

      const updateResult = config.transformData!.beforeUpdate!(baseData);
      expect(updateResult).toHaveProperty('updatedTransformed', true);
      expect(updateResult).toHaveProperty(updateTransform.addField, updateTransform.addValue);
      expect(updateResult.name).toBe(baseData.name);

      // Property 3: Original data should be preserved
      expect(createResult.value).toBe(baseData.value);
      expect(createResult.active).toBe(baseData.active);
      expect(updateResult.value).toBe(baseData.value);
      expect(updateResult.active).toBe(baseData.active);

      return true;
    },
    { numRuns: 15 }
  );
});