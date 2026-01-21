/**
 * Unified Sale Creation Service
 * 
 * Consolidates scattered sale creation logic from useCustomerSale.ts, QuickSaleModal.tsx,
 * and CustomerFormDialog.tsx into a single, consistent interface using the business logic layer.
 * 
 * @fileoverview Unified sale creation service
 * @version 1.0.0
 */

import { createBusinessLogicLayer } from './createBusinessLogicLayer';
import { 
  CreateSaleRequest, 
  QuickSaleRequest, 
  BusinessLogicOptions,
  BusinessOperationResult 
} from '../types/business-logic';

/**
 * Legacy sale item interface for backward compatibility
 */
export interface LegacySaleItem {
  type: 'product' | 'service';
  item_id: string;
  quantity: number;
}

/**
 * Legacy product/service interface for backward compatibility
 */
export interface LegacyItem {
  id: string;
  name: string;
  price: number;
}

/**
 * Quick sale modal data interface
 */
export interface QuickSaleData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  leadId?: string;
  customerId?: string;
  interest_type?: 'product' | 'service';
  interested_product_id?: string;
  interested_service_id?: string;
  value: number;
  notes?: string;
  createInvoice?: boolean;
}

/**
 * Customer form sale data interface
 */
export interface CustomerFormSaleData {
  saleItems: LegacySaleItem[];
  saleDiscount: number;
  products: LegacyItem[];
  services: LegacyItem[];
}

/**
 * Unified Sale Creation Service
 * 
 * Provides a consistent interface for all sale creation scenarios in the application.
 */
export class SaleCreationService {
  private businessLogic: ReturnType<typeof createBusinessLogicLayer>;

  constructor(businessId: string, options?: Partial<BusinessLogicOptions>) {
    this.businessLogic = createBusinessLogicLayer({
      businessId,
      atomicOperations: true,
      operationTimeout: 30000,
      logging: { enabled: true, level: 'info' },
      ...options
    });
  }

  /**
   * Creates a sale from legacy useCustomerSale format
   * Migrates from the old invoice-based approach to the new business logic layer
   */
  async createSaleFromInvoice(
    customerId: string,
    saleItems: LegacySaleItem[],
    saleDiscount: number,
    products: LegacyItem[],
    services: LegacyItem[]
  ): Promise<BusinessOperationResult> {
    // Convert legacy format to new business logic format
    const saleProducts = saleItems
      .filter(item => item.type === 'product')
      .map(item => {
        const product = products.find(p => p.id === item.item_id);
        if (!product) throw new Error(`Product not found: ${item.item_id}`);
        
        return {
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price
        };
      });

    const saleServices = saleItems
      .filter(item => item.type === 'service')
      .map(item => {
        const service = services.find(s => s.id === item.item_id);
        if (!service) throw new Error(`Service not found: ${item.item_id}`);
        
        return {
          serviceId: service.id,
          quantity: item.quantity,
          unitPrice: service.price
        };
      });

    const request: CreateSaleRequest = {
      customerId,
      products: saleProducts,
      services: saleServices,
      paymentMethod: 'pix', // Default payment method
      discount: saleDiscount,
      notes: 'Sale created via customer form'
    };

    return await this.businessLogic.sales.createSale(request);
  }

  /**
   * Creates a quick sale from QuickSaleModal format
   * Consolidates the complex logic from QuickSaleModal into the business logic layer
   */
  async createQuickSale(data: QuickSaleData): Promise<BusinessOperationResult> {
    const request: QuickSaleRequest = {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      amount: data.value,
      paymentMethod: 'pix', // Default payment method
      description: data.interest_type === 'product' 
        ? `Quick sale - Product ${data.interested_product_id}`
        : data.interest_type === 'service'
        ? `Quick sale - Service ${data.interested_service_id}`
        : 'Quick sale',
      notes: data.notes
    };

    return await this.businessLogic.sales.createQuickSale(request);
  }

  /**
   * Creates a sale with customer creation from CustomerFormDialog format
   * Handles the complex scenario of creating both customer and sale atomically
   */
  async createSaleWithCustomer(
    customerData: Record<string, unknown>,
    saleData?: CustomerFormSaleData
  ): Promise<BusinessOperationResult> {
    // First create the customer
    const customerResult = await this.businessLogic.customers.createCustomer(customerData);
    
    if (!customerResult.success || !customerResult.data) {
      return customerResult;
    }

    // If no sale data provided, just return customer creation result
    if (!saleData || saleData.saleItems.length === 0) {
      return customerResult;
    }

    // Create the sale using the newly created customer
    return await this.createSaleFromInvoice(
      customerResult.data.id,
      saleData.saleItems,
      saleData.saleDiscount,
      saleData.products,
      saleData.services
    );
  }

  /**
   * Converts a lead to a sale
   * Consolidates lead conversion logic into the business logic layer
   */
  async convertLeadToSale(
    leadId: string,
    saleData?: Partial<CreateSaleRequest>
  ): Promise<BusinessOperationResult> {
    return await this.businessLogic.sales.convertLeadToSale({
      leadId,
      saleData
    });
  }

  /**
   * Gets the business logic configuration
   */
  getConfig() {
    return this.businessLogic.getConfig();
  }

  /**
   * Gets operation history
   */
  async getOperationHistory() {
    return await this.businessLogic.getOperationHistory();
  }
}

/**
 * Factory function to create a sale creation service
 */
export function createSaleCreationService(
  businessId: string, 
  options?: Partial<BusinessLogicOptions>
): SaleCreationService {
  return new SaleCreationService(businessId, options);
}

/**
 * Hook-like interface for React components (maintains backward compatibility)
 */
export function useSaleCreationService(businessId: string) {
  const service = createSaleCreationService(businessId);

  return {
    // Legacy useCustomerSale interface
    createSaleInvoice: async (
      customerId: string,
      saleItems: LegacySaleItem[],
      saleDiscount: number,
      products: LegacyItem[],
      services: LegacyItem[]
    ) => {
      const result = await service.createSaleFromInvoice(
        customerId, 
        saleItems, 
        saleDiscount, 
        products, 
        services
      );
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Sale creation failed');
      }
      
      return result.data;
    },

    // Quick sale interface
    createQuickSale: async (data: QuickSaleData) => {
      const result = await service.createQuickSale(data);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Quick sale creation failed');
      }
      
      return result.data;
    },

    // Customer form interface
    createSaleWithCustomer: async (
      customerData: Record<string, unknown>,
      saleData?: CustomerFormSaleData
    ) => {
      const result = await service.createSaleWithCustomer(customerData, saleData);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Customer and sale creation failed');
      }
      
      return result.data;
    },

    // Lead conversion interface
    convertLeadToSale: async (
      leadId: string,
      saleData?: Partial<CreateSaleRequest>
    ) => {
      const result = await service.convertLeadToSale(leadId, saleData);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Lead conversion failed');
      }
      
      return result.data;
    }
  };
}