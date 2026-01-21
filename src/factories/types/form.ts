/**
 * Form Factory Types
 * 
 * Type definitions for the unified form dialog system that consolidates
 * entity creation and editing into a single, adaptable dialog component.
 * 
 * @fileoverview Form factory type definitions
 * @version 1.0.0
 */

import { ReactNode } from 'react';
import { 
  BaseEntity, 
  BaseFactoryOptions, 
  CreateData, 
  UpdateData, 
  EntityFieldConfig,
  ValidationRule,
  FactoryError
} from './core';

/**
 * Form operation modes.
 */
export type FormMode = 'create' | 'edit' | 'view';

/**
 * Form field types supported by the form factory.
 */
export type FormFieldType = 
  | 'text' 
  | 'email' 
  | 'phone' 
  | 'number' 
  | 'textarea' 
  | 'select' 
  | 'multiselect'
  | 'checkbox' 
  | 'radio' 
  | 'date' 
  | 'datetime' 
  | 'file' 
  | 'custom';

/**
 * Form field configuration interface.
 * Extends the base entity field config with form-specific properties.
 */
export interface FormFieldConfig extends EntityFieldConfig {
  /** Field type for rendering */
  type: FormFieldType;
  
  /** Field width in grid (1-12) */
  width?: number;
  
  /** Field group for organization */
  group?: string;
  
  /** Default value for the field */
  defaultValue?: unknown;
  
  /** Conditional visibility */
  condition?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains';
    value: unknown;
  };
  
  /** Custom render function */
  render?: (props: FormFieldRenderProps) => ReactNode;
  
  /** Field dependencies for validation */
  dependencies?: string[];
  
  /** Auto-focus this field */
  autoFocus?: boolean;
  
  /** Disable field */
  disabled?: boolean;
  
  /** Hide field */
  hidden?: boolean;
  
  /** Field options for select/radio fields */
  options?: Array<string | { label: string; value: unknown }>;
  
  /** Field description/help text */
  description?: string;
}

/**
 * Props passed to custom field render functions.
 */
export interface FormFieldRenderProps {
  /** Field configuration */
  field: FormFieldConfig;
  
  /** Current field value */
  value: unknown;
  
  /** Change handler */
  onChange: (value: unknown) => void;
  
  /** Validation error message */
  error?: string;
  
  /** Field is disabled */
  disabled?: boolean;
  
  /** Form mode */
  mode: FormMode;
  
  /** All form values */
  formValues: Record<string, unknown>;
}

/**
 * Form validation result interface.
 */
export interface FormValidationResult {
  /** Validation passed */
  isValid: boolean;
  
  /** Field-specific errors */
  fieldErrors: Record<string, string>;
  
  /** Form-level errors */
  formErrors: string[];
}

/**
 * Form submission data interface.
 */
export interface FormSubmissionData<T extends BaseEntity> {
  /** Form mode */
  mode: FormMode;
  
  /** Entity ID (for edit mode) */
  entityId?: string;
  
  /** Form data */
  data: FormMode extends 'create' ? CreateData<T> : UpdateData<T>;
  
  /** Original entity (for edit mode) */
  originalEntity?: T;
}

/**
 * Form dialog configuration options.
 */
export interface FormDialogOptions<T extends BaseEntity> extends BaseFactoryOptions {
  /** Entity type name */
  entityType: string;
  
  /** Form title templates */
  titles?: {
    create?: string;
    edit?: string;
    view?: string;
  };
  
  /** Form field configurations */
  fields: FormFieldConfig[];
  
  /** Form validation rules */
  validation?: {
    /** Client-side validation */
    client?: (data: Record<string, unknown>) => FormValidationResult;
    
    /** Server-side validation */
    server?: (data: Record<string, unknown>) => Promise<FormValidationResult>;
  };
  
  /** Form submission handler */
  onSubmit?: (data: FormSubmissionData<T>) => Promise<void>;
  
  /** Form cancellation handler */
  onCancel?: () => void;
  
  /** Custom form sections */
  sections?: FormSectionConfig[];
  
  /** Form layout configuration */
  layout?: FormLayoutConfig;
  
  /** Enable auto-save */
  autoSave?: boolean;
  
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
}

/**
 * Form section configuration for organizing fields.
 */
export interface FormSectionConfig {
  /** Section identifier */
  id: string;
  
  /** Section title */
  title: string;
  
  /** Section description */
  description?: string;
  
  /** Fields in this section */
  fields: string[];
  
  /** Section is collapsible */
  collapsible?: boolean;
  
  /** Section is initially collapsed */
  defaultCollapsed?: boolean;
  
  /** Section conditional visibility */
  condition?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains';
    value: unknown;
  };
}

/**
 * Form layout configuration.
 */
export interface FormLayoutConfig {
  /** Number of columns in grid */
  columns?: number;
  
  /** Form width */
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  
  /** Form height */
  height?: 'auto' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  
  /** Enable sticky form actions */
  stickyActions?: boolean;
  
  /** Form spacing */
  spacing?: 'compact' | 'normal' | 'relaxed';
}

/**
 * Form dialog props interface.
 */
export interface FormDialogProps<T extends BaseEntity> {
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
  
  /** Custom form configuration */
  config?: Partial<FormDialogOptions<T>>;
  
  /** Additional props */
  [key: string]: unknown;
}

/**
 * Form factory interface that defines the form operations available.
 * Generic over the entity type for full type safety.
 */
export interface FormFactory<T extends BaseEntity> {
  /**
   * Create a form dialog component.
   * Returns a React component for entity forms.
   */
  FormDialog: (props: FormDialogProps<T>) => ReactNode;
  
  /**
   * Get form field configurations.
   * Returns the configured fields for the entity.
   */
  getFields: () => FormFieldConfig[];
  
  /**
   * Validate form data.
   * Returns validation result for the provided data.
   */
  validate: (data: Record<string, unknown>) => Promise<FormValidationResult>;
  
  /**
   * Get the entity type name.
   * Useful for debugging and configuration.
   */
  getEntityType: () => string;
  
  /**
   * Get the factory configuration.
   * Useful for introspection and debugging.
   */
  getConfig: () => FormDialogOptions<T>;
}

/**
 * Form factory function type.
 * Defines the signature for creating form factories.
 */
export type CreateFormFactory = <T extends BaseEntity>(
  options: FormDialogOptions<T>
) => FormFactory<T>;

/**
 * Form state interface for managing form data.
 */
export interface FormState<T extends BaseEntity> {
  /** Current form values */
  values: Record<string, unknown>;
  
  /** Form validation errors */
  errors: Record<string, string>;
  
  /** Form is submitting */
  isSubmitting: boolean;
  
  /** Form is valid */
  isValid: boolean;
  
  /** Form has been touched */
  touched: Record<string, boolean>;
  
  /** Form is dirty (has changes) */
  isDirty: boolean;
  
  /** Original form values */
  initialValues: Record<string, unknown>;
}

/**
 * Form actions interface for managing form state.
 */
export interface FormActions<T extends BaseEntity> {
  /** Set field value */
  setValue: (field: string, value: unknown) => void;
  
  /** Set multiple field values */
  setValues: (values: Record<string, unknown>) => void;
  
  /** Set field error */
  setError: (field: string, error: string) => void;
  
  /** Clear field error */
  clearError: (field: string) => void;
  
  /** Clear all errors */
  clearErrors: () => void;
  
  /** Mark field as touched */
  setTouched: (field: string, touched?: boolean) => void;
  
  /** Reset form to initial values */
  reset: () => void;
  
  /** Submit form */
  submit: () => Promise<void>;
  
  /** Validate form */
  validate: () => Promise<FormValidationResult>;
}

/**
 * Form hook interface for managing form state and actions.
 */
export interface FormHook<T extends BaseEntity> {
  /** Form state */
  state: FormState<T>;
  
  /** Form actions */
  actions: FormActions<T>;
  
  /** Form configuration */
  config: FormDialogOptions<T>;
}

/**
 * Form factory builder interface.
 * Provides a fluent API for configuring form factories.
 */
export interface FormFactoryBuilder<T extends BaseEntity> {
  /** Set entity type */
  entityType(type: string): FormFactoryBuilder<T>;
  
  /** Configure form titles */
  titles(titles: FormDialogOptions<T>['titles']): FormFactoryBuilder<T>;
  
  /** Add form fields */
  fields(fields: FormFieldConfig[]): FormFactoryBuilder<T>;
  
  /** Add form validation */
  validation(validation: FormDialogOptions<T>['validation']): FormFactoryBuilder<T>;
  
  /** Configure form layout */
  layout(layout: FormLayoutConfig): FormFactoryBuilder<T>;
  
  /** Add form sections */
  sections(sections: FormSectionConfig[]): FormFactoryBuilder<T>;
  
  /** Enable auto-save */
  withAutoSave(interval?: number): FormFactoryBuilder<T>;
  
  /** Add submission handler */
  onSubmit(handler: FormDialogOptions<T>['onSubmit']): FormFactoryBuilder<T>;
  
  /** Build the form factory */
  build(): FormFactory<T>;
}