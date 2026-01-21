import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CustomerStats {
  totalProducts: number;
  totalServices: number;
  totalDiscount: number;
  totalPurchases: number;
}

export function useCustomerStats() {
  const { business } = useAuth();

  const { data: customerInvoices = [] } = useQuery({
    queryKey: ['customer-invoices-stats', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('business_id', business.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  // Calculate stats per customer
  const customerStatsMap = new Map<string, CustomerStats>();
  customerInvoices.forEach((inv: any) => {
    const customerId = inv.customer_id;
    const existing = customerStatsMap.get(customerId) || {
      totalProducts: 0,
      totalServices: 0,
      totalDiscount: 0,
      totalPurchases: 0,
    };

    if (inv.status === 'paid') {
      existing.totalPurchases += Number(inv.total || 0);
    }
    existing.totalDiscount += Number(inv.discount || 0);

    inv.invoice_items?.forEach((item: any) => {
      if (item.product_id) existing.totalProducts += item.quantity || 1;
      if (item.service_id) existing.totalServices += item.quantity || 1;
    });

    customerStatsMap.set(customerId, existing);
  });

  return customerStatsMap;
}
