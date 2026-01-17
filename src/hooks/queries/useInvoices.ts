import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

export interface Invoice {
  id: string;
  business_id: string;
  customer_id: string;
  invoice_number: string;
  subtotal: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  opportunity_id: string | null;
  subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseInvoicesOptions {
  enabled?: boolean;
  customerId?: string;
}

/**
 * Custom hook for fetching invoices for the current business.
 * Uses consistent query key pattern ['invoices', businessId, customerId?].
 * Returns empty array when business ID is missing without making a network request.
 * Supports optional customer ID filtering.
 * 
 * @param options - Optional configuration for the hook
 * @param options.enabled - Whether the query should be enabled (default: true)
 * @param options.customerId - Optional customer ID to filter invoices by
 * @returns React Query result with invoices data
 * 
 * @example
 * ```tsx
 * // Fetch all invoices for the business
 * const { data: invoices, isLoading, error } = useInvoices();
 * 
 * // Fetch invoices for a specific customer
 * const { data: customerInvoices } = useInvoices({ customerId: 'customer-123' });
 * 
 * // With enabled option
 * const { data: invoices } = useInvoices({ enabled: isReady });
 * ```
 * 
 * Validates: Requirements 2.6, 2.8
 */
export function useInvoices(options: UseInvoicesOptions = {}) {
  const { business } = useAuth();
  const { enabled = true, customerId } = options;

  return useQuery({
    queryKey: ['invoices', business?.id, customerId],
    queryFn: async () => {
      if (!business?.id) return [];
      
      let query = supabase
        .from('invoices')
        .select('*')
        .eq('business_id', business.id);
      
      // Apply optional customer ID filter
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!business?.id && enabled,
  });
}
