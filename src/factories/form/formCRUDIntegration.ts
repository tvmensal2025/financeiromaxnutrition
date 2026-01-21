/**
 * Form-CRUD Integration
 * 
 * Integration utilities that connect the unified form dialog system
 * with the CRUD factory system for seamless data operations.
 * 
 * @fileoverview Form-CRUD integration utilities
 * @version 1.0.0
 */

import React from 'react';
import { BaseEntity, CreateData, UpdateData } from '../types/core';
import { FormFactory, FormDialogOptions, FormMode, FormSubmissionData } from '../types/form';
import { CRUDFactory } from '../types/crud';
import { createFormFactory } from './createFormFactory';
import { createCRUDFactory } from '../createCRUDFactory';

/**
 * Options for creating an integrated form-CRUD factory.
 */
export interface FormCRUDIntegrationOptions<T extends BaseEntity> extends FormDialogOptions<T> {
  /** CRUD factory instance */
  crudFactory: CRUDFactory<T>;
  
  /** Custom data transformation before submission */
  transformData?: {
    /** Transform data before create operation */
    beforeCreate?: (data: CreateData<T>) => CreateData<T>;
    /** Transform data before update operation */
    beforeUpdate?: (data: UpdateData<T>) => UpdateData<T>;
  };
  
  /** Custom success handlers */
  onOperationSuccess?: {
    /** Called after successful create */
    onCreate?: (data: T) => void;
    /** Called after successful update */
    onUpdate?: (data: T) => void;
    /** Called after successful delete */
    onDelete?: () => void;
  };
  
  /** Custom error handlers */
  onOperationError?: {
    /** Called on create error */
    onCreate?: (error: Error) => void;
    /** Called on update error */
    onUpdate?: (error: Error) => void;
    /** Called on delete error */
    onDelete?: (error: Error) => void;
  };
}

/**
 * Integrated form-CRUD factory interface.
 */
export interface FormCRUDFactory<T extends BaseEntity> extends FormFactory<T> {
  /** CRUD operations */
  crud: CRUDFactory<T>;
  
  /** Create a form dialog with integrated CRUD operations */
  FormDialogWithCRUD: React.FC<FormCRUDDialogProps<T>>;
  
  /** Get the CRUD factory instance */
  getCRUDFactory: () => CRUDFactory<T>;
}

/**
 * Props for the integrated form dialog with CRUD operations.
 */
export interface FormCRUDDialogProps<T extends BaseEntity> {
  /** Dialog is open */
  isOpen: boolean;
  
  /** Close dialog handler */
  onClose: () => void;
  
  /** Form mode */
  mode: FormMode;
  
  /** Initial form data */
  initialData?: Partial<T>;
  
  /** Entity ID for edit mode */
  entityId?: string;
  
  /** Custom success callback */
  onSuccess?: (data: T, mode: FormMode) => void;
  
  /** Custom error callback */
  onError?: (error: Error, mode: FormMode) => void;
  
  /** Additional props */
  [key: string]: unknown;
}

/**
 * Creates an integrated form-CRUD factory that combines form dialog
 * functionality with CRUD operations.
 * 
 * @template T - The entity type extending BaseEntity
 * @param options - Integration configuration options
 * @returns An integrated form-CRUD factory
 * 
 * @example
 * ```typescript
 * interface Customer extends BaseEntity {
 *   name: string;
 *   email?: string;
 *   phone?: string;
 * }
 * 
 * const customerCRUD = createCRUDFactory<Customer>({
 *   tableName: 'customers',
 *   successMessages: {
 *     create: 'Cliente criado!',
 *     update: 'Cliente atualizado!',
 *     delete: 'Cliente removido!'
 *   }
 * });
 * 
 * const customerFormCRUD = createFormCRUDIntegration<Customer>({
 *   entityType: 'Customer',
 *   fields: customerFormFields,
 *   crudFactory: customerCRUD,
 *   transformData: {
 *     beforeCreate: (data) => ({ ...data, status: 'active' })
 *   }
 * });
 * 
 * // Usage in component
 * const { FormDialogWithCRUD } = customerFormCRUD;
 * 
 * <FormDialogWithCRUD
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   mode="create"
 *   onSuccess={(customer) => console.log('Created:', customer)}
 * />
 * ```
 * 
 * **Validates: Requirements 3.4**
 */
export function createFormCRUDIntegration<T extends BaseEntity>(
  options: FormCRUDIntegrationOptions<T>
): FormCRUDFactory<T> {
  const {
    crudFactory,
    transformData,
    onOperationSuccess,
    onOperationError,
    ...formOptions
  } = options;

  // Create the base form factory
  const formFactory = createFormFactory<T>({
    ...formOptions,
    onSubmit: async (submissionData: FormSubmissionData<T>) => {
      const { mode, data, entityId } = submissionData;
      
      try {
        switch (mode) {
          case 'create': {
            const createMutation = crudFactory.useCreate();
            const transformedData = transformData?.beforeCreate 
              ? transformData.beforeCreate(data as CreateData<T>)
              : data as CreateData<T>;
            
            const result = await createMutation.mutateAsync(transformedData);
            onOperationSuccess?.onCreate?.(result);
            break;
          }
          
          case 'edit': {
            if (!entityId) {
              throw new Error('Entity ID is required for update operation');
            }
            
            const updateMutation = crudFactory.useUpdate();
            const transformedData = transformData?.beforeUpdate 
              ? transformData.beforeUpdate(data as UpdateData<T>)
              : data as UpdateData<T>;
            
            const result = await updateMutation.mutateAsync({
              id: entityId,
              data: transformedData
            });
            onOperationSuccess?.onUpdate?.(result);
            break;
          }
          
          default:
            throw new Error(`Unsupported form mode: ${mode}`);
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        switch (mode) {
          case 'create':
            onOperationError?.onCreate?.(errorObj);
            break;
          case 'edit':
            onOperationError?.onUpdate?.(errorObj);
            break;
        }
        
        throw errorObj;
      }
    }
  });

  // Create the integrated form dialog component
  const FormDialogWithCRUD: React.FC<FormCRUDDialogProps<T>> = ({
    isOpen,
    onClose,
    mode,
    initialData,
    entityId,
    onSuccess,
    onError,
    ...props
  }) => {
    // Get CRUD mutation hooks
    const createMutation = crudFactory.useCreate();
    const updateMutation = crudFactory.useUpdate();
    
    // Determine loading state
    const isLoading = createMutation.isPending || updateMutation.isPending;

    // Handle form submission
    const handleSubmit = async (data: T, formMode: FormMode) => {
      try {
        let result: T;
        
        switch (formMode) {
          case 'create': {
            const transformedData = transformData?.beforeCreate 
              ? transformData.beforeCreate(data as CreateData<T>)
              : data as CreateData<T>;
            
            result = await createMutation.mutateAsync(transformedData);
            onOperationSuccess?.onCreate?.(result);
            break;
          }
          
          case 'edit': {
            if (!entityId) {
              throw new Error('Entity ID is required for update operation');
            }
            
            const transformedData = transformData?.beforeUpdate 
              ? transformData.beforeUpdate(data as UpdateData<T>)
              : data as UpdateData<T>;
            
            result = await updateMutation.mutateAsync({
              id: entityId,
              data: transformedData
            });
            onOperationSuccess?.onUpdate?.(result);
            break;
          }
          
          default:
            throw new Error(`Unsupported form mode: ${formMode}`);
        }
        
        // Call custom success callback
        onSuccess?.(result, formMode);
        
        // Close dialog on success
        onClose();
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        // Call operation-specific error handlers
        switch (formMode) {
          case 'create':
            onOperationError?.onCreate?.(errorObj);
            break;
          case 'edit':
            onOperationError?.onUpdate?.(errorObj);
            break;
        }
        
        // Call custom error callback
        onError?.(errorObj, formMode);
      }
    };

    // Render the form dialog
    return React.createElement(formFactory.FormDialog, {
      isOpen,
      onClose,
      mode,
      initialData,
      entityId,
      onSubmit: handleSubmit,
      isLoading,
      ...props
    });
  };

  // Enhanced getConfig that includes integration options
  const getConfig = () => ({
    ...formFactory.getConfig(),
    transformData,
    onOperationSuccess,
    onOperationError
  });

  return {
    ...formFactory,
    crud: crudFactory,
    FormDialogWithCRUD,
    getCRUDFactory: () => crudFactory,
    getConfig
  };
}

/**
 * Utility function to create a complete entity management system
 * with both form and CRUD capabilities.
 * 
 * @template T - The entity type extending BaseEntity
 * @param entityConfig - Entity configuration
 * @returns Complete entity management system
 * 
 * @example
 * ```typescript
 * const customerSystem = createEntityManagementSystem<Customer>({
 *   entityType: 'Customer',
 *   tableName: 'customers',
 *   fields: customerFormFields,
 *   successMessages: {
 *     create: 'Cliente criado!',
 *     update: 'Cliente atualizado!',
 *     delete: 'Cliente removido!'
 *   }
 * });
 * 
 * // Use in component
 * const { FormDialogWithCRUD, crud } = customerSystem;
 * const createCustomer = crud.useCreate();
 * const updateCustomer = crud.useUpdate();
 * const deleteCustomer = crud.useDelete();
 * ```
 */
export function createEntityManagementSystem<T extends BaseEntity>(
  entityConfig: FormCRUDIntegrationOptions<T> & {
    tableName: string;
    successMessages?: Record<string, string>;
    errorMessages?: Record<string, string>;
  }
) {
  const { tableName, successMessages, errorMessages, ...formCRUDOptions } = entityConfig;
  
  // Create CRUD factory if not provided
  const crudFactory = entityConfig.crudFactory || createCRUDFactory<T>({
    tableName,
    successMessages,
    errorMessages,
    invalidateKeys: [[tableName]],
    optimisticUpdates: true
  });
  
  // Create integrated form-CRUD factory
  return createFormCRUDIntegration<T>({
    ...formCRUDOptions,
    crudFactory
  });
}

export default createFormCRUDIntegration;