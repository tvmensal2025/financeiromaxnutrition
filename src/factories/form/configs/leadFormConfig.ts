/**
 * Lead Form Configuration
 * 
 * Configuration for lead form fields, validation rules, and layout.
 * Used by the unified form dialog to generate lead forms dynamically.
 * 
 * @fileoverview Lead form configuration
 * @version 1.0.0
 */

import { FormFieldConfig } from '../../types/form';

/**
 * Lead form field configurations
 */
export const leadFormConfig = {
  fields: [
    {
      name: 'name',
      type: 'text' as const,
      label: 'Nome',
      required: true,
      placeholder: 'Digite o nome do lead',
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
      placeholder: 'Digite o email do lead',
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
      name: 'company',
      type: 'text' as const,
      label: 'Empresa',
      required: false,
      placeholder: 'Digite o nome da empresa'
    },
    {
      name: 'source',
      type: 'select' as const,
      label: 'Origem',
      required: true,
      placeholder: 'Selecione a origem do lead',
      options: [
        { label: 'Website', value: 'website' },
        { label: 'Indicação', value: 'referral' },
        { label: 'Redes Sociais', value: 'social' },
        { label: 'Publicidade', value: 'advertising' },
        { label: 'Evento', value: 'event' },
        { label: 'Outros', value: 'other' }
      ],
      validation: [
        {
          type: 'required' as const,
          message: 'Origem é obrigatória',
          validate: (value: unknown) => {
            return !value || String(value).trim() === '' ? 'Origem é obrigatória' : null;
          }
        }
      ]
    },
    {
      name: 'status',
      type: 'select' as const,
      label: 'Status',
      required: true,
      placeholder: 'Selecione o status do lead',
      defaultValue: 'new',
      options: [
        { label: 'Novo', value: 'new' },
        { label: 'Contatado', value: 'contacted' },
        { label: 'Qualificado', value: 'qualified' },
        { label: 'Proposta', value: 'proposal' },
        { label: 'Negociação', value: 'negotiation' },
        { label: 'Fechado - Ganho', value: 'closed_won' },
        { label: 'Fechado - Perdido', value: 'closed_lost' }
      ],
      validation: [
        {
          type: 'required' as const,
          message: 'Status é obrigatório',
          validate: (value: unknown) => {
            return !value || String(value).trim() === '' ? 'Status é obrigatório' : null;
          }
        }
      ]
    },
    {
      name: 'temperature',
      type: 'select' as const,
      label: 'Temperatura',
      required: false,
      placeholder: 'Selecione a temperatura do lead',
      options: [
        { label: 'Frio', value: 'cold' },
        { label: 'Morno', value: 'warm' },
        { label: 'Quente', value: 'hot' }
      ]
    },
    {
      name: 'notes',
      type: 'textarea' as const,
      label: 'Observações',
      required: false,
      placeholder: 'Digite observações sobre o lead',
      width: 2
    }
  ] as FormFieldConfig[]
};