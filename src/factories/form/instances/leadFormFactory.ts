/**
 * Lead Form Factory Instance
 * 
 * Pre-configured form factory for Lead entities.
 * 
 * @fileoverview Lead form factory instance
 * @version 1.0.0
 */

import { createFormFactory } from '../createFormFactory';
import { leadFormConfig } from '../configs/leadFormConfig';

/**
 * Lead form data interface
 */
export interface LeadFormData {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  source: string;
  status: string;
  temperature?: string;
  notes?: string;
}

/**
 * Lead form factory instance with pre-configured fields and validation.
 */
export const leadFormFactory = createFormFactory<LeadFormData>({
  entityType: 'Lead',
  titles: {
    create: 'Criar Lead',
    edit: 'Editar Lead'
  },
  fields: leadFormConfig.fields,
  sections: [],
  validation: {
    client: (data) => {
      const fieldErrors: Record<string, string> = {};
      const formErrors: string[] = [];

      // Required field validation
      if (!data.name || String(data.name).trim() === '') {
        fieldErrors.name = 'Nome é obrigatório';
      }

      if (!data.status) {
        fieldErrors.status = 'Status é obrigatório';
      }

      if (!data.source) {
        fieldErrors.source = 'Origem é obrigatória';
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

export default leadFormFactory;