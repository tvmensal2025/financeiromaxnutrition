import { createCRUDFactory } from '@/factories/createCRUDFactory';
import { BaseEntity } from '@/factories/types/core';
import type { LeadStatus, LeadTemperature } from '../queries/useLeads';

/**
 * Lead entity type extending BaseEntity.
 * This interface defines the shape of lead data returned from queries.
 */
export interface Lead extends BaseEntity {
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  temperature: LeadTemperature | null;
  notes: string | null;
  interest_type: string | null;
  interested_product_id: string | null;
  interested_service_id: string | null;
  interest_is_recurring: boolean | null;
  recurring_due_date: string | null;
  recurring_message_time: string | null;
  recurring_reminder_days: number | null;
  recurring_message_type: string | null;
  recurring_reminder_template: string | null;
  recurring_overdue_template: string | null;
  converted_customer_id: string | null;
}

/**
 * Data required to create a new lead.
 * Only name is required; all other fields are optional.
 */
export interface CreateLeadData {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  source?: string;
  status?: LeadStatus;
  temperature?: LeadTemperature;
  notes?: string;
  interest_type?: string;
  interested_product_id?: string;
  interested_service_id?: string;
  interest_is_recurring?: boolean;
  recurring_due_date?: string;
  recurring_message_time?: string;
  recurring_reminder_days?: number;
  recurring_message_type?: string;
  recurring_reminder_template?: string;
  recurring_overdue_template?: string;
}

/**
 * Variables for updating a lead.
 * Requires the lead ID and partial data to update.
 */
export interface UpdateLeadVariables {
  id: string;
  data: Partial<CreateLeadData>;
}

/**
 * Lead CRUD factory instance.
 * Provides standardized create, update, and delete operations for leads.
 * 
 * **Validates: Requirements 1.6 - Backward Compatibility Preservation**
 */
const leadCRUD = createCRUDFactory<Lead>({
  tableName: 'leads',
  successMessages: {
    create: 'Lead criado com sucesso!',
    update: 'Lead atualizado!',
    delete: 'Lead removido!'
  },
  errorMessages: {
    create: 'Erro ao criar lead',
    update: 'Erro ao atualizar lead',
    delete: 'Erro ao remover lead'
  },
  invalidateKeys: [['leads']],
  optimisticUpdates: false
});

/**
 * Hook for creating a new lead.
 * Uses the CRUD factory for standardized operations.
 * Maintains backward compatibility with the existing API.
 * 
 * @returns A React Query mutation object for creating leads
 * 
 * @example
 * ```tsx
 * const createLead = useCreateLead();
 * 
 * const handleCreate = async () => {
 *   await createLead.mutateAsync({
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     phone: '11999999999',
 *     status: 'new',
 *   });
 * };
 * ```
 * 
 * Validates: Requirements 3.1, 1.6
 */
export function useCreateLead() {
  return leadCRUD.useCreate();
}

/**
 * Hook for updating an existing lead.
 * Uses the CRUD factory for standardized operations.
 * Maintains backward compatibility with the existing API.
 * 
 * @returns A React Query mutation object for updating leads
 * 
 * @example
 * ```tsx
 * const updateLead = useUpdateLead();
 * 
 * const handleUpdate = async () => {
 *   await updateLead.mutateAsync({
 *     id: 'lead-uuid',
 *     data: { name: 'Jane Doe', status: 'contacted' },
 *   });
 * };
 * ```
 * 
 * Validates: Requirements 3.2, 1.6
 */
export function useUpdateLead() {
  return leadCRUD.useUpdate();
}

/**
 * Hook for deleting a lead.
 * Uses the CRUD factory for standardized operations.
 * Maintains backward compatibility with the existing API.
 * 
 * @returns A React Query mutation object for deleting leads
 * 
 * @example
 * ```tsx
 * const deleteLead = useDeleteLead();
 * 
 * const handleDelete = async () => {
 *   await deleteLead.mutateAsync('lead-uuid');
 * };
 * ```
 * 
 * Validates: Requirements 3.3, 1.6
 */
export function useDeleteLead() {
  return leadCRUD.useDelete();
}
