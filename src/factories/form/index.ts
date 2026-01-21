/**
 * Form Factory Exports
 * 
 * Central export point for all form factory components and utilities.
 * 
 * @fileoverview Form factory exports
 * @version 1.0.0
 */

// Core components
export { UnifiedFormDialog } from './UnifiedFormDialog';
export { createFormFactory, createFieldConfig } from './createFormFactory';

// Type definitions
export type {
  FormFieldConfig,
  FormMode,
  FormDialogProps,
  FormValidationResult,
  FormFieldType,
  FormFactory,
  FormDialogOptions,
  FormSectionConfig,
  FormLayoutConfig,
  FormFieldRenderProps
} from '../types/form';

// Entity configurations
export {
  customerFormFields,
  customerFormSections,
  customerFormTitles,
  type CustomerFormData
} from './configs/customerFormConfig';

export {
  leadFormFields,
  leadFormSections,
  leadFormTitles,
  type LeadFormData
} from './configs/leadFormConfig';

// Pre-configured factory instances
export { customerFormFactory } from './instances/customerFormFactory';
export { leadFormFactory } from './instances/leadFormFactory';

// Default export
export default createFormFactory;