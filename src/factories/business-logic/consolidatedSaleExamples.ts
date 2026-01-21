/**
 * Consolidated Sale Creation Examples
 * 
 * This file demonstrates how the scattered sale creation logic from useCustomerSale.ts,
 * QuickSaleModal.tsx, and CustomerFormDialog.tsx has been consolidated into the
 * unified business logic layer.
 * 
 * @fileoverview Examples of consolidated sale creation patterns
 * @version 1.0.0
 */

import { useSaleCreationService, QuickSaleData, CustomerFormSaleData } from './saleCreationService';

/**
 * Example: Migrating useCustomerSale logic
 * 
 * BEFORE: Complex invoice creation logic scattered in useCustomerSale.ts
 * AFTER: Simple delegation to unified service
 */
export function useCustomerSaleExample(businessId: string) {
  const saleService = useSaleCreationService(businessId);

  const createSaleInvoice = async (
    customerId: string,
    saleItems: Array<{ type: 'product' | 'service'; item_id: string; quantity: number }>,
    saleDiscount: number,
    products: Array<{ id: string; name: string; price: number }>,
    services: Array<{ id: string; name: string; price: number }>
  ) => {
    // BEFORE: 50+ lines of complex invoice creation logic
    // AFTER: Single call to unified service
    return await saleService.createSaleInvoice(
      customerId,
      saleItems,
      saleDiscount,
      products,
      services
    );
  };

  return { createSaleInvoice };
}

/**
 * Example: Migrating QuickSaleModal logic
 * 
 * BEFORE: Complex multi-step process with customer creation, opportunity creation, and invoice creation
 * AFTER: Simple data transformation and delegation to unified service
 */
export function quickSaleModalExample(businessId: string) {
  const saleService = useSaleCreationService(businessId);

  const handleQuickSale = async (formData: {
    customerName: string;
    customerEmail?: string;
    phone: string;
    leadId?: string;
    customerId?: string;
    interest_type?: 'product' | 'service';
    interested_product_id?: string;
    interested_service_id?: string;
    value: number;
    notes?: string;
    createInvoice?: boolean;
  }) => {
    // BEFORE: 100+ lines of complex logic with multiple database operations
    // AFTER: Simple data transformation and single service call
    const quickSaleData: QuickSaleData = {
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.phone,
      leadId: formData.leadId,
      customerId: formData.customerId,
      interest_type: formData.interest_type,
      interested_product_id: formData.interested_product_id,
      interested_service_id: formData.interested_service_id,
      value: formData.value,
      notes: formData.notes,
      createInvoice: formData.createInvoice
    };

    return await saleService.createQuickSale(quickSaleData);
  };

  return { handleQuickSale };
}

/**
 * Example: Migrating CustomerFormDialog logic
 * 
 * BEFORE: Complex form handling with conditional sale creation
 * AFTER: Clean separation of customer creation and sale creation
 */
export function customerFormDialogExample(businessId: string) {
  const saleService = useSaleCreationService(businessId);

  const handleCustomerWithSale = async (
    customerData: Record<string, unknown>,
    saleData?: {
      saleItems: Array<{ type: 'product' | 'service'; item_id: string; quantity: number }>;
      saleDiscount: number;
      products: Array<{ id: string; name: string; price: number }>;
      services: Array<{ id: string; name: string; price: number }>;
    }
  ) => {
    // BEFORE: Complex conditional logic mixing customer and sale creation
    // AFTER: Clean delegation to unified service
    return await saleService.createSaleWithCustomer(customerData, saleData);
  };

  return { handleCustomerWithSale };
}

/**
 * Example: Lead conversion consolidation
 * 
 * BEFORE: Lead conversion logic scattered across multiple components
 * AFTER: Centralized lead conversion through business logic layer
 */
export function leadConversionExample(businessId: string) {
  const saleService = useSaleCreationService(businessId);

  const convertLeadToSale = async (
    leadId: string,
    saleAmount?: number,
    paymentMethod?: string
  ) => {
    // BEFORE: Manual lead data fetching, customer creation, and sale creation
    // AFTER: Single service call handles the entire conversion process
    return await saleService.convertLeadToSale(leadId, {
      products: saleAmount ? [{ 
        productId: 'default-product', 
        quantity: 1, 
        unitPrice: saleAmount 
      }] : [],
      paymentMethod: (paymentMethod as any) || 'pix'
    });
  };

  return { convertLeadToSale };
}

/**
 * Benefits of Consolidation:
 * 
 * 1. **Code Reduction**: 300+ lines of scattered logic reduced to ~50 lines of service calls
 * 2. **Consistency**: All sale creation follows the same patterns and validation rules
 * 3. **Atomicity**: All operations are atomic with proper rollback support
 * 4. **Testability**: Business logic is isolated and easily testable
 * 5. **Maintainability**: Changes to sale creation logic only need to be made in one place
 * 6. **Error Handling**: Consistent error handling and reporting across all sale scenarios
 * 7. **Transaction Support**: Automatic rollback on failures ensures data consistency
 * 8. **Backward Compatibility**: Existing components can be migrated incrementally
 * 
 * Migration Strategy:
 * 
 * 1. **Phase 1**: Create unified service (✅ Complete)
 * 2. **Phase 2**: Update useCustomerSale hook (✅ Complete)
 * 3. **Phase 3**: Update QuickSaleModal component (✅ Complete)
 * 4. **Phase 4**: Update CustomerFormDialog component (🔄 In Progress)
 * 5. **Phase 5**: Remove old scattered logic and update tests
 * 6. **Phase 6**: Add comprehensive integration tests for unified service
 */