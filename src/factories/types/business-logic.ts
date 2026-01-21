/**
 * Business Logic Types
 * 
 * Type definitions for the centralized business logic layer that consolidates
 * complex operations like sale creation, customer management, and lead conversion.
 * 
 * @fileoverview Business logic type definitions
 * @version 1.0.0
 */

import { 
  BaseEntity, 
  BaseFactoryOptions, 
  FactoryError,
  SuccessCallback,
  ErrorCallback
} from './core';

/**
 * Business operation types that can be performed.
 */
export type BusinessOperation = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'query'
  | 'sale_creation' 
  | 'lead_conversion' 
  | 'customer_update' 
  | 'inventory_update'
  | 'notification_send'
  | 'payment_process'
  | 'custom';

/**
 * Business operation context interface.
 * Provides context information during business operations.
 */
export interface BusinessOperationContext {
  /** The operation being performed */
  operation: BusinessOperation;
  
  /** Operation identifier for tracking */
  operationId: string;
  
  /** User performing the operation */
  userId?: string;
  
  /** Business context */
  businessId: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  
  /** Timestamp when operation started */
  startTime: number;
  
  /** Parent operation ID for nested operations */
  parentOperationId?: string;
}

/**
 * Business operation result interface.
 * Standardizes the response format for business operations.
 */
export interface BusinessOperationResult<T = unknown> {
  /** Operation succeeded */
  success: boolean;
  
  /** Result data */
  data?: T;
  
  /** Operation error */
  error?: FactoryError;
  
  /** Operation context */
  context: BusinessOperationContext;
  
  /** Sub-operation results */
  subResults?: BusinessOperationResult[];
  
  /** Operation duration in milliseconds */
  duration: number;
}

/**
 * Atomic operation interface for transaction-like behavior.
 * Ensures all operations succeed or all fail together.
 */
export interface AtomicOperation {
  /** Operation identifier */
  id: string;
  
  /** Operation function */
  execute: () => Promise<unknown>;
  
  /** Rollback function */
  rollback: () => Promise<void>;
  
  /** Operation dependencies */
  dependencies?: string[];
  
  /** Operation priority */
  priority?: number;
}

/**
 * Business logic configuration options.
 */
export interface BusinessLogicOptions extends BaseFactoryOptions {
  /** Business ID for context */
  businessId: string;
  
  /** Enable atomic operations */
  atomicOperations?: boolean;
  
  /** Operation timeout in milliseconds */
  operationTimeout?: number;
  
  /** Retry configuration */
  retry?: {
    attempts: number;
    delay: number;
    backoff?: 'linear' | 'exponential';
  };
  
  /** Success callback for operations */
  onSuccess?: SuccessCallback;
  
  /** Error callback for operations */
  onError?: ErrorCallback;
  
  /** Operation logging */
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    destination?: 'console' | 'file' | 'remote';
  };
}

/**
 * Sale creation request interface.
 * Defines the data needed to create a sale.
 */
export interface CreateSaleRequest {
  /** Customer ID (optional for lead sales) */
  customerId?: string;
  
  /** Lead ID (optional for customer sales) */
  leadId?: string;
  
  /** Products in the sale */
  products: SaleProduct[];
  
  /** Services in the sale */
  services?: SaleService[];
  
  /** Payment method */
  paymentMethod: PaymentMethod;
  
  /** Sale notes */
  notes?: string;
  
  /** Discount amount */
  discount?: number;
  
  /** Sale metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Sale product interface.
 */
export interface SaleProduct {
  /** Product ID */
  productId: string;
  
  /** Quantity */
  quantity: number;
  
  /** Unit price */
  unitPrice: number;
  
  /** Product discount */
  discount?: number;
  
  /** Product notes */
  notes?: string;
}

/**
 * Sale service interface.
 */
export interface SaleService {
  /** Service ID */
  serviceId: string;
  
  /** Quantity */
  quantity: number;
  
  /** Unit price */
  unitPrice: number;
  
  /** Service discount */
  discount?: number;
  
  /** Service notes */
  notes?: string;
}

/**
 * Payment method types.
 */
export type PaymentMethod = 
  | 'cash' 
  | 'credit_card' 
  | 'debit_card' 
  | 'pix' 
  | 'bank_transfer' 
  | 'check' 
  | 'other';

/**
 * Quick sale request interface for simplified sales.
 */
export interface QuickSaleRequest {
  /** Customer name */
  customerName: string;
  
  /** Customer phone */
  customerPhone?: string;
  
  /** Customer email */
  customerEmail?: string;
  
  /** Sale amount */
  amount: number;
  
  /** Payment method */
  paymentMethod: PaymentMethod;
  
  /** Sale description */
  description: string;
  
  /** Sale notes */
  notes?: string;
}

/**
 * Lead conversion request interface.
 */
export interface ConvertLeadRequest {
  /** Lead ID to convert */
  leadId: string;
  
  /** Additional customer data */
  customerData?: Record<string, unknown>;
  
  /** Create sale immediately */
  createSale?: boolean;
  
  /** Sale data if creating sale */
  saleData?: Partial<CreateSaleRequest>;
}

/**
 * Sale operations interface.
 * Defines all sale-related business operations.
 */
export interface SaleOperations {
  /** Create a regular sale */
  createSale: (request: CreateSaleRequest) => Promise<BusinessOperationResult>;
  
  /** Create a quick sale */
  createQuickSale: (request: QuickSaleRequest) => Promise<BusinessOperationResult>;
  
  /** Convert lead to sale */
  convertLeadToSale: (request: ConvertLeadRequest) => Promise<BusinessOperationResult>;
  
  /** Update sale */
  updateSale?: (saleId: string, updates: Partial<CreateSaleRequest>) => Promise<BusinessOperationResult>;
  
  /** Cancel sale */
  cancelSale?: (saleId: string, reason: string) => Promise<BusinessOperationResult>;
  
  /** Process refund */
  processRefund?: (saleId: string, amount: number, reason: string) => Promise<BusinessOperationResult>;
}

/**
 * Customer operations interface.
 * Defines all customer-related business operations.
 */
export interface CustomerOperations {
  /** Create customer */
  createCustomer: (customerData: Record<string, unknown>) => Promise<BusinessOperationResult>;
  
  /** Update customer */
  updateCustomer: (customerId: string, updates: Record<string, unknown>) => Promise<BusinessOperationResult>;
  
  /** Merge customers */
  mergeCustomers?: (primaryId: string, secondaryId: string) => Promise<BusinessOperationResult>;
  
  /** Archive customer */
  archiveCustomer?: (customerId: string, reason: string) => Promise<BusinessOperationResult>;
  
  /** Update customer activity */
  updateActivity?: (customerId: string, activity: Record<string, unknown>) => Promise<BusinessOperationResult>;
}

/**
 * Lead operations interface.
 * Defines all lead-related business operations.
 */
export interface LeadOperations {
  /** Create lead */
  createLead: (leadData: Record<string, unknown>) => Promise<BusinessOperationResult>;
  
  /** Update lead */
  updateLead?: (leadId: string, updates: Record<string, unknown>) => Promise<BusinessOperationResult>;
  
  /** Convert lead to customer */
  convertLead?: (request: ConvertLeadRequest) => Promise<BusinessOperationResult>;
  
  /** Qualify lead */
  qualifyLead?: (leadId: string, qualification: Record<string, unknown>) => Promise<BusinessOperationResult>;
  
  /** Archive lead */
  archiveLead?: (leadId: string, reason: string) => Promise<BusinessOperationResult>;
}

/**
 * Business logic layer interface.
 * Main interface for accessing all business operations.
 */
export interface BusinessLogicLayer {
  /** Sale operations */
  sales: SaleOperations;
  
  /** Customer operations */
  customers: CustomerOperations;
  
  /** Lead operations */
  leads: LeadOperations;
  
  /** Execute atomic operation */
  executeAtomic: (operations: AtomicOperation[]) => Promise<BusinessOperationResult[]>;
  
  /** Get operation history */
  getOperationHistory: (filters?: Record<string, unknown>) => Promise<BusinessOperationResult[]>;
  
  /** Get business logic configuration */
  getConfig: () => BusinessLogicOptions;
}

/**
 * Business logic factory function type.
 * Defines the signature for creating business logic layers.
 */
export type CreateBusinessLogicLayer = (
  options: BusinessLogicOptions
) => BusinessLogicLayer;

/**
 * Business rule interface for defining business constraints.
 */
export interface BusinessRule {
  /** Rule identifier */
  id: string;
  
  /** Rule name */
  name: string;
  
  /** Rule description */
  description: string;
  
  /** Rule condition */
  condition: (context: BusinessOperationContext, data: unknown) => boolean;
  
  /** Rule action */
  action: (context: BusinessOperationContext, data: unknown) => Promise<void>;
  
  /** Rule priority */
  priority: number;
  
  /** Rule is active */
  active: boolean;
}

/**
 * Business rule engine interface.
 * Manages and executes business rules.
 */
export interface BusinessRuleEngine {
  /** Add business rule */
  addRule: (rule: BusinessRule) => void;
  
  /** Remove business rule */
  removeRule: (ruleId: string) => void;
  
  /** Execute rules for operation */
  executeRules: (context: BusinessOperationContext, data: unknown) => Promise<void>;
  
  /** Get all rules */
  getRules: () => BusinessRule[];
  
  /** Enable/disable rule */
  toggleRule: (ruleId: string, active: boolean) => void;
}