/**
 * Hook for deriving contact info from conversation data
 * 
 * Feature: project-refactoring
 * Requirements: 6.3
 * 
 * Extracts contact info derivation logic from Messages.tsx:
 * - Looks up customer or lead by ID
 * - Returns unified contact info object
 * - Determines contact type (lead, customer, new)
 */

import { useMemo } from 'react';
import { Conversation } from '@/components/chat/ConversationsList';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  source: string | null;
  temperature: 'cold' | 'warm' | 'hot' | null;
  status: string;
  created_at: string;
}

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

interface ContactInfo {
  name: string | null;
  phone: string;
  email?: string | null;
  company?: string | null;
  source?: string | null;
  temperature?: 'cold' | 'warm' | 'hot' | null;
  status?: string;
  createdAt: string;
}

export type ContactType = 'lead' | 'customer' | 'new';

/**
 * Hook to derive contact info from conversation and related data
 * 
 * @param selectedConversation - The selected conversation
 * @param selectedPhone - Phone number of selected conversation
 * @param customers - Array of customers
 * @param leads - Array of leads
 * @returns Object containing contact info and contact type
 */
export function useContactInfo(
  selectedConversation: Conversation | undefined,
  selectedPhone: string | null,
  customers: Customer[],
  leads: Lead[]
): { contactInfo: ContactInfo | null; contactType: ContactType } {
  return useMemo(() => {
    if (!selectedConversation || !selectedPhone) {
      return { contactInfo: null, contactType: 'new' };
    }

    // Check if it's a customer
    if (selectedConversation.customer_id) {
      const customer = customers.find((c) => c.id === selectedConversation.customer_id);
      if (customer) {
        return {
          contactInfo: {
            name: customer.name,
            phone: selectedPhone,
            email: customer.email,
            createdAt: customer.created_at,
          },
          contactType: 'customer',
        };
      }
    }

    // Check if it's a lead
    if (selectedConversation.lead_id) {
      const lead = leads.find((l) => l.id === selectedConversation.lead_id);
      if (lead) {
        return {
          contactInfo: {
            name: lead.name,
            phone: selectedPhone,
            email: lead.email,
            company: lead.company,
            source: lead.source,
            temperature: lead.temperature,
            status: lead.status,
            createdAt: lead.created_at,
          },
          contactType: 'lead',
        };
      }
    }

    // Default to new contact
    return {
      contactInfo: {
        name: selectedConversation.sender_name || null,
        phone: selectedPhone,
        createdAt: selectedConversation.last_message_at,
      },
      contactType: 'new',
    };
  }, [selectedConversation, selectedPhone, customers, leads]);
}