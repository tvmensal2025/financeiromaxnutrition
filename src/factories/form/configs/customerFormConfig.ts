/**
 * Customer Form Configuration
 * 
 * Configuration for customer form fields, validation rules, and layout.
 * Used by the unified form dialog to generate customer forms dynamically.
 * 
 * @fileoverview Customer form configuration
 * @version 1.0.0
 */

import { FormFieldConfig } from '../../types/form';

/**
 * Customer form field configurations
 */
export const customerFormConfig = {
  fields: [
    {
      name: 'name',
      type: 'text' as const,
      label: 'Nome',
      required: true,
      placeholder: 'Digite o nome do cliente',
      validation: [
        {
          type: 'required' as const,
          message: 'Nome é obrigatório',
          validate: (value: unknown) => {
            return !value || String(value).trim() === '' ? 'Nome é obrigatório' : null;
          }
        },
        {
          type: 'minLength' as const,
          value: 2,
          message: 'Nome deve ter pelo menos 2 caracteres',
          validate: (value: unknown) => {
            return String(value).length < 2 ? 'Nome deve ter pelo menos 2 caracteres' : null;
          }
        }
      ]
    },
    {
      name: 'email',
      type: 'email' as const,
      label: 'Email',
      required: false,
      placeholder: 'Digite o email do cliente',
      validation: [
        {
          type: 'email' as const,
          message: 'Email deve ter um formato válido',
          validate: (value: unknown) => {
            if (!value) return null;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return !emailRegex.test(String(value)) ? 'Email deve ter um formato válido' : null;
          }
        }
      ]
    },
    {
      name: 'phone',
      type: 'phone' as const,
      label: 'Telefone',
      required: false,
      placeholder: '(11) 99999-9999',
      validation: [
        {
          type: 'phone' as const,
          message: 'Telefone deve ter um formato válido',
          validate: (value: unknown) => {
            if (!value) return null;
            const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
            return !phoneRegex.test(String(value)) ? 'Telefone deve ter um formato válido' : null;
          }
        }
      ]
    },
    {
      name: 'whatsapp',
      type: 'phone' as const,
      label: 'WhatsApp',
      required: false,
      placeholder: '(11) 99999-9999',
      validation: [
        {
          type: 'phone' as const,
          message: 'WhatsApp deve ter um formato válido',
          validate: (value: unknown) => {
            if (!value) return null;
            const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
            return !phoneRegex.test(String(value)) ? 'WhatsApp deve ter um formato válido' : null;
          }
        }
      ]
    },
    {
      name: 'company_name',
      type: 'text' as const,
      label: 'Empresa',
      required: false,
      placeholder: 'Digite o nome da empresa'
    },
    {
      name: 'notes',
      type: 'textarea' as const,
      label: 'Observações',
      required: false,
      placeholder: 'Digite observações sobre o cliente',
      width: 2
    }
  ] as FormFieldConfig[]
};