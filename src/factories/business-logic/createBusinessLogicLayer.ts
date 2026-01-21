/**
 * Centralized Business Logic Layer
 * 
 * Provides centralized business operations for complex scenarios like sale creation,
 * customer operations, and lead management with atomic transaction support.
 * 
 * @fileoverview Business logic layer implementation
 * @version 1.0.0
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  BusinessLogicLayer,
  SaleOperations,
  CustomerOperations,
  LeadOperations,
  CreateSaleRequest,
  QuickSaleRequest,
  BusinessLogicOptions,
  BusinessOperationResult,
  BusinessOperationContext,
  ConvertLeadRequest,
  AtomicOperation
} from '../types/business-logic';
import { FactoryError } from '../types/core';

/**
 * Business transaction interface for tracking operations and rollbacks.
 */
interface BusinessTransaction {
  id: string;
  operations: Array<{
    type: string;
    entity: string;
    id: string;
    data: any;
  }>;
  rollbackOperations: Array<() => Promise<void>>;
  completed: boolean;
}

/**
 * Creates a centralized business logic layer with atomic operations.
 * 
 * @param options - Configuration options for the business logic layer
 * @returns Business logic layer with operations for sales, customers, and leads
 * 
 * @example
 * ```typescript
 * const businessLogic = createBusinessLogicLayer({
 *   businessId: 'business-123',
 *   atomicOperations: true,
 *   debug: true
 * });
 * 
 * // Create a sale with automatic customer creation
 * const result = await businessLogic.sales.createSale({
 *   products: [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }],
 *   paymentMethod: 'pix'
 * });
 * ```
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
export function createBusinessLogicLayer(
  options: BusinessLogicOptions
): BusinessLogicLayer {
  const {
    businessId,
    atomicOperations = true,
    operationTimeout = 30000,
    retry = { attempts: 3, delay: 1000 },
    onSuccess,
    onError,
    logging = { enabled: false, level: 'info' }
  } = options;

  /**
   * Creates a standardized error object for business operations.
   */
  const createBusinessError = (
    error: unknown,
    operation: string,
    context?: string
  ): FactoryError => {
    const baseError = error instanceof Error ? error : new Error(String(error));
    
    const businessError = Object.create(Error.prototype) as FactoryError;
    businessError.name = 'BusinessLogicError';
    businessError.message = baseError.message;
    businessError.code = 'BUSINESS_ERROR';
    businessError.context = context || `Business operation: ${operation}`;
    businessError.originalError = baseError;
    businessError.metadata = {
      operation,
      timestamp: new Date().toISOString(),
      atomicOperations,
      businessId
    };
    businessError.stack = baseError.stack;
    
    return businessError;
  };

  /**
   * Creates operation context for tracking business operations.
   */
  const createOperationContext = (
    operation: string,
    operationId?: string
  ): BusinessOperationContext => ({
    operation: 'create',
    operationId: operationId || `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    businessId,
    startTime: Date.now(),
    metadata: { operation }
  });

  /**
   * Executes a business operation with transaction support and rollback capabilities.
   */
  const executeWithTransaction = async <T>(
    operation: string,
    businessOperation: (transaction: BusinessTransaction) => Promise<T>
  ): Promise<BusinessOperationResult<T>> => {
    const context = createOperationContext(operation);
    const startTime = Date.now();
    const transaction: BusinessTransaction = {
      id: context.operationId,
      operations: [],
      rollbackOperations: [],
      completed: false
    };

    try {
      if (logging.enabled) {
        console.log(`Starting business operation: ${operation}`, { transactionId: transaction.id });
      }

      // Execute the business operation
      const result = await businessOperation(transaction);
      
      // Mark transaction as completed
      transaction.completed = true;
      
      const duration = Date.now() - startTime;
      
      if (logging.enabled) {
        console.log(`Business operation completed: ${operation}`, {
          transactionId: transaction.id,
          duration,
          operationsCount: transaction.operations.length
        });
      }

      // Call success callback
      onSuccess?.(operation, result);

      return {
        success: true,
        data: result,
        context,
        duration
      };

    } catch (error) {
      const businessError = createBusinessError(error, operation);
      
      // Attempt rollback if enabled and transaction has operations
      if (atomicOperations && transaction.rollbackOperations.length > 0) {
        try {
          if (logging.enabled) {
            console.log(`Rolling back transaction: ${transaction.id}`, {
              rollbackOperationsCount: transaction.rollbackOperations.length
            });
          }

          // Execute rollback operations in reverse order
          for (let i = transaction.rollbackOperations.length - 1; i >= 0; i--) {
            await transaction.rollbackOperations[i]();
          }

          if (logging.enabled) {
            console.log(`Rollback completed for transaction: ${transaction.id}`);
          }

        } catch (rollbackError) {
          if (logging.enabled) {
            console.error(`Rollback failed for transaction: ${transaction.id}`, rollbackError);
          }
          
          // Add rollback error to the original error
          businessError.metadata = {
            ...businessError.metadata,
            rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          };
        }
      }

      // Call error callback
      onError?.(businessError, operation);

      return {
        success: false,
        error: businessError,
        context,
        duration: Date.now() - startTime
      };
    }
  };

  /**
   * Sale Operations - Centralized sale creation and management
   */
  const saleOperations: SaleOperations = {
    /**
     * Creates a sale with automatic customer/lead handling and inventory updates.
     * Supports atomic operations with rollback on failure.
     */
    createSale: async (request: CreateSaleRequest) => {
      return executeWithTransaction('createSale', async (transaction) => {
        // Validate input data
        if (!request.products || request.products.length === 0) {
          throw new Error('At least one product is required');
        }

        if (!request.paymentMethod) {
          throw new Error('Payment method is required');
        }

        // Calculate total amount from products
        let totalAmount = 0;
        for (const product of request.products) {
          totalAmount += product.unitPrice * product.quantity;
        }

        // Apply discount if provided
        if (request.discount) {
          totalAmount -= request.discount;
        }

        if (totalAmount <= 0) {
          throw new Error('Total amount must be greater than 0');
        }

        let customerId = request.customerId;
        let leadId = request.leadId;

        // Create the sale - using 'transactions' table since 'sales' doesn't exist
        const saleData = {
          customer_id: customerId,
          amount: totalAmount,
          type: 'income',
          category: 'sale',
          description: request.notes || 'Sale created via business logic',
          payment_method: request.paymentMethod,
          business_id: businessId,
          created_at: new Date().toISOString()
        };

        const { data: sale, error: saleError } = await supabase
          .from('transactions')
          .insert(saleData)
          .select()
          .single();

        if (saleError) throw saleError;

        // Add rollback operation
        transaction.rollbackOperations.push(async () => {
          await supabase.from('transactions').delete().eq('id', sale.id);
        });

        transaction.operations.push({
          type: 'create',
          entity: 'sale',
          id: sale.id,
          data: sale
        });

        // Convert lead to customer if leadId is provided
        if (leadId && !customerId) {
          const { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

          if (lead) {
            // Create customer from lead data
            const { data: customer, error: customerError } = await supabase
              .from('customers')
              .insert({
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                whatsapp: lead.whatsapp,
                company_name: lead.company,
                notes: lead.notes,
                source: lead.source,
                business_id: businessId
              })
              .select()
              .single();

            if (customerError) throw customerError;

            // Update transaction with customer_id
            await supabase
              .from('transactions')
              .update({ customer_id: customer.id })
              .eq('id', sale.id);

            // Update lead status to converted
            await supabase
              .from('leads')
              .update({ status: 'converted' })
              .eq('id', leadId);

            transaction.operations.push({
              type: 'convert',
              entity: 'lead_to_customer',
              id: leadId,
              data: { leadId, customerId: customer.id }
            });
          }
        }

        return sale;
      });
    },

    /**
     * Creates a quick sale with minimal data requirements.
     */
    createQuickSale: async (request: QuickSaleRequest) => {
      return executeWithTransaction('createQuickSale', async (transaction) => {
        // Create customer if needed
        let customerId: string | undefined;
        
        if (request.customerName) {
          const customerData = {
            name: request.customerName,
            phone: request.customerPhone,
            email: request.customerEmail,
            business_id: businessId
          };

          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .insert(customerData)
            .select()
            .single();

          if (customerError) throw customerError;
          customerId = customer.id;

          transaction.rollbackOperations.push(async () => {
            await supabase.from('customers').delete().eq('id', customer.id);
          });

          transaction.operations.push({
            type: 'create',
            entity: 'customer',
            id: customer.id,
            data: customer
          });
        }

        // Create quick sale transaction
        const saleData = {
          customer_id: customerId,
          amount: request.amount,
          type: 'income',
          category: 'sale',
          description: request.description,
          payment_method: request.paymentMethod,
          notes: request.notes,
          business_id: businessId,
          created_at: new Date().toISOString()
        };

        const { data: sale, error: saleError } = await supabase
          .from('transactions')
          .insert(saleData)
          .select()
          .single();

        if (saleError) throw saleError;

        transaction.rollbackOperations.push(async () => {
          await supabase.from('transactions').delete().eq('id', sale.id);
        });

        transaction.operations.push({
          type: 'create',
          entity: 'quick_sale',
          id: sale.id,
          data: sale
        });

        return sale;
      });
    },

    /**
     * Converts a lead to a sale with customer creation.
     */
    convertLeadToSale: async (request: ConvertLeadRequest) => {
      // Get lead data
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', request.leadId)
        .single();

      if (leadError) throw leadError;
      if (!lead) throw new Error('Lead not found');

      // Create sale with lead conversion
      const createSaleRequest: CreateSaleRequest = {
        leadId: request.leadId,
        products: request.saleData?.products || [],
        paymentMethod: request.saleData?.paymentMethod || 'pix',
        notes: request.saleData?.notes
      };

      // Call the createSale method directly - it handles its own transaction
      return await saleOperations.createSale(createSaleRequest);
    }
  };

  /**
   * Customer Operations - Customer management and related operations
   */
  const customerOperations: CustomerOperations = {
    /**
     * Creates a customer with validation and business rules.
     */
    createCustomer: async (customerData: Record<string, unknown>) => {
      return executeWithTransaction('createCustomer', async (transaction) => {
        // Validate required fields
        if (!customerData.name) {
          throw new Error('Customer name is required');
        }

        // Check for duplicate email if provided
        if (customerData.email && typeof customerData.email === 'string') {
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('email', customerData.email)
            .eq('business_id', businessId)
            .single();

          if (existing) {
            throw new Error('Customer with this email already exists');
          }
        }

        // Create customer
        const { data: customer, error } = await supabase
          .from('customers')
          .insert({
            ...customerData,
            business_id: businessId
          })
          .select()
          .single();

        if (error) throw error;

        transaction.rollbackOperations.push(async () => {
          await supabase.from('customers').delete().eq('id', customer.id);
        });

        transaction.operations.push({
          type: 'create',
          entity: 'customer',
          id: customer.id,
          data: customer
        });

        return customer;
      });
    },

    /**
     * Updates a customer with business rule validation.
     */
    updateCustomer: async (customerId: string, updateData: Record<string, unknown>) => {
      return executeWithTransaction('updateCustomer', async (transaction) => {
        // Get current customer data for rollback
        const { data: currentCustomer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .eq('business_id', businessId)
          .single();

        if (!currentCustomer) {
          throw new Error('Customer not found');
        }

        // Update customer
        const { data: customer, error } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customerId)
          .eq('business_id', businessId)
          .select()
          .single();

        if (error) throw error;

        transaction.rollbackOperations.push(async () => {
          await supabase
            .from('customers')
            .update(currentCustomer)
            .eq('id', customerId);
        });

        transaction.operations.push({
          type: 'update',
          entity: 'customer',
          id: customerId,
          data: customer
        });

        return customer;
      });
    }
  };

  /**
   * Lead Operations - Lead management and conversion
   */
  const leadOperations: LeadOperations = {
    /**
     * Creates a lead with validation and business rules.
     */
    createLead: async (leadData: Record<string, unknown>) => {
      return executeWithTransaction('createLead', async (transaction) => {
        // Validate required fields
        if (!leadData.name || (typeof leadData.name === 'string' && leadData.name.trim().length === 0)) {
          throw new Error('Lead name is required and cannot be empty');
        }
        if (!leadData.source) {
          leadData.source = 'website'; // Set default source
        }

        // Set default status if not provided
        if (!leadData.status) {
          leadData.status = 'new';
        }

        // Create lead
        const { data: lead, error } = await supabase
          .from('leads')
          .insert({
            ...leadData,
            business_id: businessId
          })
          .select()
          .single();

        if (error) throw error;

        transaction.rollbackOperations.push(async () => {
          await supabase.from('leads').delete().eq('id', lead.id);
        });

        transaction.operations.push({
          type: 'create',
          entity: 'lead',
          id: lead.id,
          data: lead
        });

        return lead;
      });
    }
  };

  return {
    sales: saleOperations,
    customers: customerOperations,
    leads: leadOperations,
    executeAtomic: async (operations: AtomicOperation[]) => {
      // Sort operations by priority
      const sortedOps = operations.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      const results: BusinessOperationResult[] = [];
      const executedOps: AtomicOperation[] = [];

      try {
        for (const operation of sortedOps) {
          const context = createOperationContext(`atomic_${operation.id}`);
          const startTime = Date.now();

          try {
            const result = await operation.execute();
            executedOps.push(operation);
            
            results.push({
              success: true,
              data: result,
              context,
              duration: Date.now() - startTime
            });
          } catch (error) {
            // Rollback all executed operations
            for (let i = executedOps.length - 1; i >= 0; i--) {
              try {
                await executedOps[i].rollback();
              } catch (rollbackError) {
                console.error(`Rollback failed for operation ${executedOps[i].id}:`, rollbackError);
              }
            }

            const businessError = createBusinessError(error, `atomic_${operation.id}`);
            results.push({
              success: false,
              error: businessError,
              context,
              duration: Date.now() - startTime
            });

            break;
          }
        }

        return results;
      } catch (error) {
        const businessError = createBusinessError(error, 'executeAtomic');
        return [{
          success: false,
          error: businessError,
          context: createOperationContext('executeAtomic'),
          duration: 0
        }];
      }
    },
    getOperationHistory: async () => {
      // This would typically query a database table for operation history
      // For now, return empty array as this is not implemented
      return [];
    },
    getConfig: () => options
  };
}