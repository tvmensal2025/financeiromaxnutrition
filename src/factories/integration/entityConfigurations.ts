/**
 * Entity Configurations
 * 
 * Pre-configured entity setups for all main entities in the application.
 * These configurations wire together form fields, validation, CRUD operations,
 * and business logic for each entity type.
 * 
 * @fileoverview Entity configurations for system integration
 * @version 1.0.0
 */

import { EntityConfig } from './systemIntegration';
import { BaseEntity } from '../types/core';
import { FormFieldConfig } from '../types/form';

// Entity type definitions
export interface Customer extends BaseEntity {
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  notes?: string;
  company_name?: string;
  interest_type?: string;
  interested_product_id?: string;
  interested_service_id?: string;
  interest_is_recurring?: boolean;
  recurring_due_date?: string;
  recurring_message_time?: string;
  recurring_reminder_days?: number;
  recurring_message_type?: string;
  recurring_reminder_template?: string;
  recurring_overdue_template?: string;
}

export interface Lead extends BaseEntity {
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  source?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  temperature?: 'cold' | 'warm' | 'hot';
  notes?: string;
  interest_type?: string;
  interested_product_id?: string;
  interested_service_id?: string;
  interest_is_recurring?: boolean;
  recurring_due_date?: string;
  recurring_message_time?: string;
  recurring_reminder_days?: number;
  recurring_message_type?: string;
  recurring_reminder_template?: string;
  recurring_overdue_template?: string;
}

export interface Product extends BaseEntity {
  business_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  is_active: boolean;
}

export interface Service extends BaseEntity {
  business_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  is_active: boolean;
  duration?: number;
}

export interface Transaction extends BaseEntity {
  business_id: string;
  customer_id?: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  description: string;
  payment_method?: string;
  status: 'pending' | 'completed' | 'cancelled';
  date: string;
}

// Form field configurations
const customerFormFields: FormFieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Nome',
    required: true,
    placeholder: 'Digite o nome do cliente',
    validation: [
      {
        type: 'required',
        message: 'Nome é obrigatório',
        validate: (value: unknown) => {
          return !value || String(value).trim() === '' ? 'Nome é obrigatório' : null;
        }
      },
      {
        type: 'minLength',
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
    type: 'email',
    label: 'Email',
    required: false,
    placeholder: 'Digite o email do cliente',
    validation: [
      {
        type: 'email',
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
    type: 'text',
    label: 'Telefone',
    required: false,
    placeholder: '(11) 99999-9999',
    validation: [
      {
        type: 'phone',
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
    type: 'text',
    label: 'WhatsApp',
    required: false,
    placeholder: '(11) 99999-9999',
    validation: [
      {
        type: 'phone',
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
    type: 'text',
    label: 'Empresa',
    required: false,
    placeholder: 'Digite o nome da empresa'
  },
  {
    name: 'notes',
    type: 'textarea',
    label: 'Observações',
    required: false,
    placeholder: 'Digite observações sobre o cliente',
    width: 2
  }
];

const leadFormFields: FormFieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Nome',
    required: true,
    placeholder: 'Digite o nome do lead',
    validation: [
      {
        type: 'required',
        message: 'Nome é obrigatório',
        validate: (value: unknown) => {
          return !value || String(value).trim() === '' ? 'Nome é obrigatório' : null;
        }
      }
    ]
  },
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    required: false,
    placeholder: 'Digite o email do lead'
  },
  {
    name: 'phone',
    type: 'text',
    label: 'Telefone',
    required: false,
    placeholder: '(11) 99999-9999'
  },
  {
    name: 'whatsapp',
    type: 'text',
    label: 'WhatsApp',
    required: false,
    placeholder: '(11) 99999-9999'
  },
  {
    name: 'company',
    type: 'text',
    label: 'Empresa',
    required: false,
    placeholder: 'Digite o nome da empresa'
  },
  {
    name: 'source',
    type: 'select',
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
        type: 'required',
        message: 'Origem é obrigatória',
        validate: (value: unknown) => {
          return !value || String(value).trim() === '' ? 'Origem é obrigatória' : null;
        }
      }
    ]
  },
  {
    name: 'status',
    type: 'select',
    label: 'Status',
    required: true,
    placeholder: 'Selecione o status do lead',
    defaultValue: 'new',
    options: [
      { label: 'Novo', value: 'new' },
      { label: 'Contatado', value: 'contacted' },
      { label: 'Qualificado', value: 'qualified' },
      { label: 'Convertido', value: 'converted' },
      { label: 'Perdido', value: 'lost' }
    ]
  },
  {
    name: 'temperature',
    type: 'select',
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
    type: 'textarea',
    label: 'Observações',
    required: false,
    placeholder: 'Digite observações sobre o lead',
    width: 2
  }
];

const productFormFields: FormFieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Nome',
    required: true,
    placeholder: 'Digite o nome do produto',
    validation: [
      {
        type: 'required',
        message: 'Nome é obrigatório',
        validate: (value: unknown) => {
          return !value || String(value).trim() === '' ? 'Nome é obrigatório' : null;
        }
      }
    ]
  },
  {
    name: 'description',
    type: 'textarea',
    label: 'Descrição',
    required: false,
    placeholder: 'Digite a descrição do produto'
  },
  {
    name: 'price',
    type: 'number',
    label: 'Preço',
    required: true,
    placeholder: '0.00',
    validation: [
      {
        type: 'required',
        message: 'Preço é obrigatório',
        validate: (value: unknown) => {
          return !value || Number(value) <= 0 ? 'Preço deve ser maior que zero' : null;
        }
      }
    ]
  },
  {
    name: 'category',
    type: 'text',
    label: 'Categoria',
    required: false,
    placeholder: 'Digite a categoria do produto'
  },
  {
    name: 'is_active',
    type: 'boolean',
    label: 'Ativo',
    required: false,
    defaultValue: true
  }
];

const serviceFormFields: FormFieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Nome',
    required: true,
    placeholder: 'Digite o nome do serviço',
    validation: [
      {
        type: 'required',
        message: 'Nome é obrigatório',
        validate: (value: unknown) => {
          return !value || String(value).trim() === '' ? 'Nome é obrigatório' : null;
        }
      }
    ]
  },
  {
    name: 'description',
    type: 'textarea',
    label: 'Descrição',
    required: false,
    placeholder: 'Digite a descrição do serviço'
  },
  {
    name: 'price',
    type: 'number',
    label: 'Preço',
    required: true,
    placeholder: '0.00',
    validation: [
      {
        type: 'required',
        message: 'Preço é obrigatório',
        validate: (value: unknown) => {
          return !value || Number(value) <= 0 ? 'Preço deve ser maior que zero' : null;
        }
      }
    ]
  },
  {
    name: 'category',
    type: 'text',
    label: 'Categoria',
    required: false,
    placeholder: 'Digite a categoria do serviço'
  },
  {
    name: 'duration',
    type: 'number',
    label: 'Duração (minutos)',
    required: false,
    placeholder: '60'
  },
  {
    name: 'is_active',
    type: 'boolean',
    label: 'Ativo',
    required: false,
    defaultValue: true
  }
];

const transactionFormFields: FormFieldConfig[] = [
  {
    name: 'description',
    type: 'text',
    label: 'Descrição',
    required: true,
    placeholder: 'Digite a descrição da transação',
    validation: [
      {
        type: 'required',
        message: 'Descrição é obrigatória',
        validate: (value: unknown) => {
          return !value || String(value).trim() === '' ? 'Descrição é obrigatória' : null;
        }
      }
    ]
  },
  {
    name: 'amount',
    type: 'number',
    label: 'Valor',
    required: true,
    placeholder: '0.00',
    validation: [
      {
        type: 'required',
        message: 'Valor é obrigatório',
        validate: (value: unknown) => {
          return !value || Number(value) <= 0 ? 'Valor deve ser maior que zero' : null;
        }
      }
    ]
  },
  {
    name: 'type',
    type: 'select',
    label: 'Tipo',
    required: true,
    options: [
      { label: 'Receita', value: 'income' },
      { label: 'Despesa', value: 'expense' }
    ],
    validation: [
      {
        type: 'required',
        message: 'Tipo é obrigatório',
        validate: (value: unknown) => {
          return !value ? 'Tipo é obrigatório' : null;
        }
      }
    ]
  },
  {
    name: 'category',
    type: 'text',
    label: 'Categoria',
    required: false,
    placeholder: 'Digite a categoria'
  },
  {
    name: 'payment_method',
    type: 'select',
    label: 'Método de Pagamento',
    required: false,
    options: [
      { label: 'PIX', value: 'pix' },
      { label: 'Cartão de Crédito', value: 'credit_card' },
      { label: 'Cartão de Débito', value: 'debit_card' },
      { label: 'Dinheiro', value: 'cash' },
      { label: 'Transferência', value: 'transfer' },
      { label: 'Boleto', value: 'boleto' }
    ]
  },
  {
    name: 'date',
    type: 'date',
    label: 'Data',
    required: true,
    defaultValue: new Date().toISOString().split('T')[0],
    validation: [
      {
        type: 'required',
        message: 'Data é obrigatória',
        validate: (value: unknown) => {
          return !value ? 'Data é obrigatória' : null;
        }
      }
    ]
  },
  {
    name: 'status',
    type: 'select',
    label: 'Status',
    required: true,
    defaultValue: 'pending',
    options: [
      { label: 'Pendente', value: 'pending' },
      { label: 'Concluída', value: 'completed' },
      { label: 'Cancelada', value: 'cancelled' }
    ]
  }
];

// Entity configurations
export const customerConfig: EntityConfig<Customer> = {
  entityName: 'customer',
  tableName: 'customers',
  formFields: customerFormFields,
  successMessages: {
    create: 'Cliente criado com sucesso!',
    update: 'Cliente atualizado!',
    delete: 'Cliente removido!'
  },
  errorMessages: {
    create: 'Erro ao criar cliente',
    update: 'Erro ao atualizar cliente',
    delete: 'Erro ao remover cliente'
  },
  queryOptions: {
    realTimeSubscription: true,
    cacheTime: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    defaultPageSize: 20
  },
  crudOptions: {
    optimisticUpdates: false,
    invalidateKeys: [['customers']]
  }
};

export const leadConfig: EntityConfig<Lead> = {
  entityName: 'lead',
  tableName: 'leads',
  formFields: leadFormFields,
  successMessages: {
    create: 'Lead criado com sucesso!',
    update: 'Lead atualizado!',
    delete: 'Lead removido!'
  },
  errorMessages: {
    create: 'Erro ao criar lead',
    update: 'Erro ao atualizar lead',
    delete: 'Erro ao remover lead'
  },
  queryOptions: {
    realTimeSubscription: true,
    cacheTime: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    defaultPageSize: 20
  },
  crudOptions: {
    optimisticUpdates: false,
    invalidateKeys: [['leads']]
  }
};

export const productConfig: EntityConfig<Product> = {
  entityName: 'product',
  tableName: 'products',
  formFields: productFormFields,
  successMessages: {
    create: 'Produto criado com sucesso!',
    update: 'Produto atualizado!',
    delete: 'Produto removido!'
  },
  errorMessages: {
    create: 'Erro ao criar produto',
    update: 'Erro ao atualizar produto',
    delete: 'Erro ao remover produto'
  },
  queryOptions: {
    defaultFilters: { is_active: true },
    realTimeSubscription: false,
    cacheTime: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    defaultPageSize: 50
  },
  crudOptions: {
    optimisticUpdates: false,
    invalidateKeys: [['products']]
  }
};

export const serviceConfig: EntityConfig<Service> = {
  entityName: 'service',
  tableName: 'services',
  formFields: serviceFormFields,
  successMessages: {
    create: 'Serviço criado com sucesso!',
    update: 'Serviço atualizado!',
    delete: 'Serviço removido!'
  },
  errorMessages: {
    create: 'Erro ao criar serviço',
    update: 'Erro ao atualizar serviço',
    delete: 'Erro ao remover serviço'
  },
  queryOptions: {
    defaultFilters: { is_active: true },
    realTimeSubscription: false,
    cacheTime: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    defaultPageSize: 50
  },
  crudOptions: {
    optimisticUpdates: false,
    invalidateKeys: [['services']]
  }
};

export const transactionConfig: EntityConfig<Transaction> = {
  entityName: 'transaction',
  tableName: 'transactions',
  formFields: transactionFormFields,
  successMessages: {
    create: 'Transação criada com sucesso!',
    update: 'Transação atualizada!',
    delete: 'Transação removida!'
  },
  errorMessages: {
    create: 'Erro ao criar transação',
    update: 'Erro ao atualizar transação',
    delete: 'Erro ao remover transação'
  },
  queryOptions: {
    realTimeSubscription: true,
    cacheTime: 3 * 60 * 1000,
    staleTime: 1 * 60 * 1000,
    defaultPageSize: 30
  },
  crudOptions: {
    optimisticUpdates: false,
    invalidateKeys: [['transactions']]
  }
};

// Export all configurations
export const entityConfigurations = {
  customer: customerConfig,
  lead: leadConfig,
  product: productConfig,
  service: serviceConfig,
  transaction: transactionConfig
};

export default entityConfigurations;