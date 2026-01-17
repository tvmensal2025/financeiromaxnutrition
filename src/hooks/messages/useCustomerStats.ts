/**
 * Hook for calculating customer statistics
 * 
 * Feature: project-refactoring
 * Requirements: 6.4
 * 
 * Extracts customer stats calculation logic from Messages.tsx:
 * - Calculates totals from invoices and opportunities
 * - Returns CustomerStats object
 */

import { useMemo } from 'react';
import { Conversation } from '@/components/chat/ConversationsList';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  created_at: string;
  recurring_due_date?: string | null;
  recurring_reminder_days?: number | null;
  recurring_message_time?: string | null;
  recurring_message_type?: string | null;
}

interface Invoice {
  id: string;
  status: string;
  total: number;
  discount?: number;
  due_date?: string;
  invoice_items?: InvoiceItem[];
}

interface InvoiceItem {
  id: string;
  product_id?: string | null;
  service_id?: string | null;
  quantity: number;
}

interface Opportunity {
  id: string;
  value: number;
  stage: string;
}

export interface CustomerStats {
  totalPurchases: number;
  totalProducts: number;
  totalServices: number;
  totalDiscount: number;
  pendingInvoices: number;
  pendingAmount: number;
  nextDueDate?: string | null;
  reminderDays?: number | null;
  messageTime?: string | null;
  messageType?: string | null;
}

/**
 * Hook to calculate customer statistics
 * 
 * @param selectedConversation - The selected conversation
 * @param customers - Array of customers
 * @param customerInvoices - Array of customer invoices
 * @param customerOpportunities - Array of customer opportunities
 * @returns CustomerStats object or undefined if not a customer conversation
 */
export function useCustomerStats(
  selectedConversation: Conversation | undefined,
  customers: Customer[],
  customerInvoices: Invoice[],
  customerOpportunities: Opportunity[]
): CustomerStats | undefined {
  return useMemo(() => {
    if (!selectedConversation?.customer_id) return undefined;

    const customer = customers.find((c) => c.id === selectedConversation.customer_id);
    
    // Calculate totals from invoices
    const paidInvoices = customerInvoices.filter((inv) => inv.status === 'paid');
    const pendingInvoicesData = customerInvoices.filter((inv) => 
      inv.status === 'pending' || inv.status === 'overdue'
    );

    const totalFromInvoices = paidInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalDiscount = customerInvoices.reduce((sum, inv) => sum + Number(inv.discount || 0), 0);
    const pendingAmount = pendingInvoicesData.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

    // Count products and services from invoice items
    let totalProducts = 0;
    let totalServices = 0;
    customerInvoices.forEach((inv) => {
      inv.invoice_items?.forEach((item) => {
        if (item.product_id) totalProducts += item.quantity || 1;
        if (item.service_id) totalServices += item.quantity || 1;
      });
    });

    // Add value from won opportunities
    const totalFromOpportunities = customerOpportunities.reduce((sum, opp) => sum + Number(opp.value || 0), 0);

    // Find next due date from pending invoices
    const nextDueDate = pendingInvoicesData
      .map((inv) => inv.due_date)
      .filter(Boolean)
      .sort()[0] || customer?.recurring_due_date;

    return {
      totalPurchases: totalFromInvoices + totalFromOpportunities,
      totalProducts,
      totalServices,
      totalDiscount,
      pendingInvoices: pendingInvoicesData.length,
      pendingAmount,
      nextDueDate,
      reminderDays: customer?.recurring_reminder_days,
      messageTime: customer?.recurring_message_time,
      messageType: customer?.recurring_message_type,
    };
  }, [selectedConversation?.customer_id, customers, customerInvoices, customerOpportunities]);
}