/**
 * CRUD Factory Instances
 * 
 * Pre-configured CRUD factory instances for all main entities.
 * These instances provide type-safe, consistent mutation hooks for components.
 * 
 * @fileoverview CRUD factory instances for main entities
 * @version 1.0.0
 */

import { createCRUDFactory } from '../createCRUDFactory';
import { 
  Customer, 
  Lead, 
  Product, 
  Service, 
  Transaction, 
  MessageTemplate, 
  ContactNote 
} from './queryFactories';

// CRUD factory instances
export const customerCRUD = createCRUDFactory<Customer>({
  tableName: 'customers',
  optimisticUpdates: true,
  invalidateQueries: ['customers'],
  successMessages: {
    create: 'Cliente criado com sucesso',
    update: 'Cliente atualizado com sucesso',
    delete: 'Cliente removido com sucesso'
  },
  errorMessages: {
    create: 'Erro ao criar cliente',
    update: 'Erro ao atualizar cliente',
    delete: 'Erro ao remover cliente'
  }
});

export const leadCRUD = createCRUDFactory<Lead>({
  tableName: 'leads',
  optimisticUpdates: true,
  invalidateQueries: ['leads'],
  successMessages: {
    create: 'Lead criado com sucesso',
    update: 'Lead atualizado com sucesso',
    delete: 'Lead removido com sucesso'
  },
  errorMessages: {
    create: 'Erro ao criar lead',
    update: 'Erro ao atualizar lead',
    delete: 'Erro ao remover lead'
  }
});

export const productCRUD = createCRUDFactory<Product>({
  tableName: 'products',
  optimisticUpdates: true,
  invalidateQueries: ['products'],
  successMessages: {
    create: 'Produto criado com sucesso',
    update: 'Produto atualizado com sucesso',
    delete: 'Produto removido com sucesso'
  },
  errorMessages: {
    create: 'Erro ao criar produto',
    update: 'Erro ao atualizar produto',
    delete: 'Erro ao remover produto'
  }
});

export const serviceCRUD = createCRUDFactory<Service>({
  tableName: 'services',
  optimisticUpdates: true,
  invalidateQueries: ['services'],
  successMessages: {
    create: 'Serviço criado com sucesso',
    update: 'Serviço atualizado com sucesso',
    delete: 'Serviço removido com sucesso'
  },
  errorMessages: {
    create: 'Erro ao criar serviço',
    update: 'Erro ao atualizar serviço',
    delete: 'Erro ao remover serviço'
  }
});

export const transactionCRUD = createCRUDFactory<Transaction>({
  tableName: 'transactions',
  optimisticUpdates: true,
  invalidateQueries: ['transactions', 'dashboard-transactions'],
  successMessages: {
    create: 'Transação criada com sucesso',
    update: 'Transação atualizada com sucesso',
    delete: 'Transação removida com sucesso'
  },
  errorMessages: {
    create: 'Erro ao criar transação',
    update: 'Erro ao atualizar transação',
    delete: 'Erro ao remover transação'
  }
});

export const messageTemplateCRUD = createCRUDFactory<MessageTemplate>({
  tableName: 'message_templates',
  optimisticUpdates: true,
  invalidateQueries: ['message-templates'],
  successMessages: {
    create: 'Template criado com sucesso',
    update: 'Template atualizado com sucesso',
    delete: 'Template removido com sucesso'
  },
  errorMessages: {
    create: 'Erro ao criar template',
    update: 'Erro ao atualizar template',
    delete: 'Erro ao remover template'
  }
});

export const contactNoteCRUD = createCRUDFactory<ContactNote>({
  tableName: 'contact_notes',
  optimisticUpdates: true,
  invalidateQueries: ['contact-notes'],
  successMessages: {
    create: 'Nota adicionada com sucesso',
    update: 'Nota atualizada com sucesso',
    delete: 'Nota removida com sucesso'
  },
  errorMessages: {
    create: 'Erro ao adicionar nota',
    update: 'Erro ao atualizar nota',
    delete: 'Erro ao remover nota'
  }
});

// Export all CRUD factories for easy access
export const crudFactories = {
  customers: customerCRUD,
  leads: leadCRUD,
  products: productCRUD,
  services: serviceCRUD,
  transactions: transactionCRUD,
  messageTemplates: messageTemplateCRUD,
  contactNotes: contactNoteCRUD
};

export default crudFactories;