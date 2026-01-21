/**
 * Customer Form Factory Instance
 * 
 * Pre-configured form factory for Customer entities.
 * 
 * @fileoverview Customer form factory instance
 * @version 1.0.0
 */

import { createFormFactory } from '../createFormFactory';
import { customerFormConfig } from '../configs/customerFormConfig';

/**
 * Customer form data interface
 */
export interface CustomerFormData {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company_name?: string;
  notes?: string;
}

/**
 * Customer form factory instance with pre-configured fields and validation.
 */
export const customerFormFactory = createFormFactory<CustomerFormData>({
  entityType: 'Cliente',
  titles: {
    create: 'Criar Cliente',
    edit: 'Editar Cliente'
  },
  fields: customerFormConfig.fields,
  sections: [],
  validation: {
    client: (data) => {
      const fieldErrors: Record<string, string> = {};
      const formErrors: string[] = [];

      // Required field validation
      if (!data.name || String(data.name).trim() === '') {
        fieldErrors.name = 'Nome é obrigatório';
      }

      // Email validation if provided
      if (data.email && typeof data.email === 'string' && data.email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
          fieldErrors.email = 'Email inválido';
        }
      }

      return {
        isValid: Object.keys(fieldErrors).length === 0 && formErrors.length === 0,
        fieldErrors,
        formErrors
      };
    }
  },
  layout: {
    columns: 2,
    width: 'md',
    spacing: 'normal'
  }
});

export default customerFormFactory;