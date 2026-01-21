/**
 * Query Factory Instances
 * 
 * Pre-configured query factory instances for all main entities.
 * These instances provide type-safe, consistent query hooks for components.
 * 
 * @fileoverview Query factory instances for main entities
 * @version 1.0.0
 */

import { createQueryFactory } from '../createQueryFactory';
import { BaseEntity } from '../types/core';

// Entity type definitions
export interface Customer extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  business_id: string;
  status: 'active' | 'inactive';
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Lead extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  business_id: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  temperature: 'cold' | 'warm' | 'hot';
  source?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Product extends BaseEntity {
  name: string;
  description?: string;
  price: number;
  business_id: string;
  category?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Service extends BaseEntity {
  name: string;
  description?: string;
  price: number;
  business_id: string;
  category?: string;
  status: 'active' | 'inactive';
  duration?: number; // in minutes
  created_at: string;
  updated_at: string;
}

export interface Transaction extends BaseEntity {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  category?: string;
  customer_id?: string;
  business_id: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate extends BaseEntity {
  name: string;
  content: string;
  business_id: string;
  category?: string;
  variables?: string[];
  created_at: string;
  updated_at: string;
}

export interface ContactNote extends BaseEntity {
  content: string;
  phone: string;
  business_id: string;
  customer_id?: string;
  lead_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Query factory instances
export const customerQueries = createQueryFactory<Customer>({
  tableName: 'customers',
  defaultFilters: { status: 'active' },
  realTimeSubscription: true,
  cacheTime: 5 * 60 * 1000, // 5 minutes
  staleTime: 2 * 60 * 1000, // 2 minutes
  defaultPageSize: 20
});

export const leadQueries = createQueryFactory<Lead>({
  tableName: 'leads',
  realTimeSubscription: true,
  cacheTime: 5 * 60 * 1000,
  staleTime: 2 * 60 * 1000,
  defaultPageSize: 20
});

export const productQueries = createQueryFactory<Product>({
  tableName: 'products',
  defaultFilters: { status: 'active' },
  realTimeSubscription: false, // Products change less frequently
  cacheTime: 10 * 60 * 1000, // 10 minutes
  staleTime: 5 * 60 * 1000, // 5 minutes
  defaultPageSize: 50
});

export const serviceQueries = createQueryFactory<Service>({
  tableName: 'services',
  defaultFilters: { status: 'active' },
  realTimeSubscription: false, // Services change less frequently
  cacheTime: 10 * 60 * 1000, // 10 minutes
  staleTime: 5 * 60 * 1000, // 5 minutes
  defaultPageSize: 50
});

export const transactionQueries = createQueryFactory<Transaction>({
  tableName: 'transactions',
  realTimeSubscription: true,
  cacheTime: 3 * 60 * 1000, // 3 minutes
  staleTime: 1 * 60 * 1000, // 1 minute
  defaultPageSize: 30
});

export const messageTemplateQueries = createQueryFactory<MessageTemplate>({
  tableName: 'message_templates',
  realTimeSubscription: false,
  cacheTime: 15 * 60 * 1000, // 15 minutes
  staleTime: 10 * 60 * 1000, // 10 minutes
  defaultPageSize: 100
});

export const contactNoteQueries = createQueryFactory<ContactNote>({
  tableName: 'contact_notes',
  realTimeSubscription: true,
  cacheTime: 5 * 60 * 1000,
  staleTime: 2 * 60 * 1000,
  defaultPageSize: 20
});

// Export all query factories for easy access
export const queryFactories = {
  customers: customerQueries,
  leads: leadQueries,
  products: productQueries,
  services: serviceQueries,
  transactions: transactionQueries,
  messageTemplates: messageTemplateQueries,
  contactNotes: contactNoteQueries
};

export default queryFactories;