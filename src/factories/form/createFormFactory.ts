/**
 * Form Factory Creator
 * 
 * Factory function that creates form configurations and components
 * for different entity types with consistent patterns and validation.
 * 
 * @fileoverview Form factory implementation
 * @version 1.0.0
 */

import React from 'react';
import { BaseEntity, CreateData, UpdateData } from '../types/core';
import { 
  FormFactory, 
  FormDialogOptions, 
  FormFieldConfig, 
  FormValidationResult,
  FormDialogProps,
  CreateFormFactory
} from '../types/form';
import { UnifiedFormDialog } from './UnifiedFormDialog';

/**
 * Creates a form factory for a specific entity type.
 * 
 * @param options - Form dialog configuration options
 * @returns Form factory with dialog component and utilities
 */
export const createFormFactory: CreateFormFactory = <T extends BaseEntity>(
  options: FormDialogOptions<T>
): FormFactory<T> => {
  // Validate configuration
  if (!options.entityType) {
    throw new Error('Entity type is required for form factory');
  }
  
  if (!options.fields || options.fields.length === 0) {
    throw new Error('At least one field is required for form factory');
  }

  // Default validation function
  const defaultValidate = (data: Record<string, unknown>): FormValidationResult => {
    const fieldErrors: Record<string, string> = {};
    const formErrors: string[] = [];

    // Basic required field validation
    options.fields.forEach(field => {
      const value = data[field.name];
      
      if (field.required && (value === undefined || value === null || value === '')) {
        fieldErrors[field.name] = `${field.label} é obrigatório`;
      }
    });

    return {
      isValid: Object.keys(fieldErrors).length === 0 && formErrors.length === 0,
      fieldErrors,
      formErrors
    };
  };

  // Form Dialog Component
  const FormDialog: React.FC<FormDialogProps<T>> = (props) => {
    const {
      isOpen,
      onClose,
      mode = 'create',
      initialData,
      entityId,
      config: propConfig,
      ...restProps
    } = props;

    // Merge configuration
    const mergedConfig = {
      ...options,
      ...propConfig,
      fields: propConfig?.fields || options.fields,
    };

    // Generate title
    const getTitle = () => {
      if (propConfig?.titles) {
        return propConfig.titles[mode];
      }
      if (options.titles) {
        return options.titles[mode];
      }
      
      const entityName = options.entityType;
      switch (mode) {
        case 'create':
          return `Novo ${entityName}`;
        case 'edit':
          return `Editar ${entityName}`;
        case 'view':
          return `Visualizar ${entityName}`;
        default:
          return entityName;
      }
    };

    // Handle form submission
    const handleSubmit = async (data: T, formMode: typeof mode) => {
      if (options.onSubmit) {
        await options.onSubmit({
          mode: formMode,
          entityId,
          data: data as CreateData<T> | UpdateData<T>, // Proper type assertion
          originalEntity: initialData as T
        });
      }
    };

    return React.createElement(UnifiedFormDialog, {
      isOpen,
      onClose,
      mode,
      initialData,
      entityId,
      fields: mergedConfig.fields,
      onSubmit: handleSubmit as any, // Type assertion needed for generic constraints
      validate: mergedConfig.validation?.client || defaultValidate,
      title: getTitle(),
      sections: mergedConfig.sections,
      ...restProps
    });
  };

  // Validation function
  const validate = async (data: Record<string, unknown>): Promise<FormValidationResult> => {
    // Client-side validation
    const clientResult = options.validation?.client 
      ? options.validation.client(data)
      : defaultValidate(data);

    // Server-side validation if provided
    if (options.validation?.server && clientResult.isValid) {
      try {
        const serverResult = await options.validation.server(data);
        return {
          isValid: serverResult.isValid,
          fieldErrors: { ...clientResult.fieldErrors, ...serverResult.fieldErrors },
          formErrors: [...clientResult.formErrors, ...serverResult.formErrors]
        };
      } catch (error) {
        return {
          isValid: false,
          fieldErrors: clientResult.fieldErrors,
          formErrors: [...clientResult.formErrors, 'Erro de validação no servidor']
        };
      }
    }

    return clientResult;
  };

  return {
    FormDialog,
    getFields: () => options.fields,
    validate,
    getEntityType: () => options.entityType,
    getConfig: () => options
  };
};

/**
 * Utility function to create common field configurations.
 */
export const createFieldConfig = {
  /**
   * Creates a text field configuration.
   */
  text: (name: string, label: string, options: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
    name,
    label,
    type: 'text',
    required: false,
    ...options
  }),

  /**
   * Creates an email field configuration.
   */
  email: (name: string, label: string, options: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
    name,
    label,
    type: 'email',
    required: false,
    validation: [
      {
        type: 'email',
        message: 'Email inválido',
        validate: (value: unknown) => {
          if (typeof value !== 'string') return null;
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(value) ? null : 'Email inválido';
        }
      }
    ],
    ...options
  }),

  /**
   * Creates a phone field configuration.
   */
  phone: (name: string, label: string, options: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
    name,
    label,
    type: 'phone',
    required: false,
    ...options
  }),

  /**
   * Creates a number field configuration.
   */
  number: (name: string, label: string, options: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
    name,
    label,
    type: 'number',
    required: false,
    ...options
  }),

  /**
   * Creates a textarea field configuration.
   */
  textarea: (name: string, label: string, options: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
    name,
    label,
    type: 'textarea',
    required: false,
    ...options
  }),

  /**
   * Creates a select field configuration.
   */
  select: (
    name: string, 
    label: string, 
    selectOptions: Array<string | { label: string; value: string }>,
    fieldOptions: Partial<FormFieldConfig> = {}
  ): FormFieldConfig => ({
    name,
    label,
    type: 'select',
    required: false,
    options: selectOptions.map(opt => 
      typeof opt === 'string' 
        ? { label: opt, value: opt }
        : { label: opt.label, value: opt.value }
    ),
    ...fieldOptions
  }),

  /**
   * Creates a checkbox field configuration.
   */
  checkbox: (name: string, label: string, options: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
    name,
    label,
    type: 'checkbox',
    required: false,
    ...options
  }),

  /**
   * Creates a date field configuration.
   */
  date: (name: string, label: string, options: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
    name,
    label,
    type: 'date',
    required: false,
    ...options
  })
};

export default createFormFactory;