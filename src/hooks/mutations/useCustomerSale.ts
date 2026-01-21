import { useAuth } from '@/contexts/AuthContext';
import { useSaleCreationService } from '@/factories/business-logic/saleCreationService';

interface SaleItem {
  type: 'product' | 'service';
  item_id: string;
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

export function useCustomerSale() {
  const { business } = useAuth();
  
  // Use the unified sale creation service
  const saleService = business?.id ? useSaleCreationService(business.id) : null;

  const createSaleInvoice = async (
    customerId: string,
    saleItems: SaleItem[],
    saleDiscount: number,
    products: Product[],
    services: Service[]
  ) => {
    if (!saleService || !business?.id || saleItems.length === 0) return;

    // Delegate to the unified sale creation service
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
