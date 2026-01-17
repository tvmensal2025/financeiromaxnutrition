import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutationWithToast } from './useMutationWithToast';
import type { Lead, LeadStatus, LeadTemperature } from '../queries/useLeads';

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
 * Hook for creating a new lead.
 * Uses useMutationWithToast for standardized toast notifications.
 * Automatically invalidates the leads query on success.
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
 * Validates: Requirements 3.1
 */
export function useCreateLead() {
  const { business } = useAuth();

  return useMutationWithToast<Lead, Error, CreateLeadData>({
    mutationFn: async (data: CreateLeadData) => {
      if (!business?.id) throw new Error('Business not found');
      
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({ ...data, business_id: business.id })
        .select()
        .single();
      
      if (error) throw error;
      return lead as Lead;
    },
    successMessage: 'Lead criado com sucesso!',
    errorMessage: 'Erro ao criar lead',
    invalidateKeys: [['leads']],
  });
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
 * Hook for updating an existing lead.
 * Uses useMutationWithToast for standardized toast notifications.
 * Automatically invalidates the leads query on success.
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
 * Validates: Requirements 3.2
 */
export function useUpdateLead() {
  return useMutationWithToast<void, Error, UpdateLeadVariables>({
    mutationFn: async ({ id, data }: UpdateLeadVariables) => {
      const { error } = await supabase
        .from('leads')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    successMessage: 'Lead atualizado!',
    errorMessage: 'Erro ao atualizar lead',
    invalidateKeys: [['leads']],
  });
}

/**
 * Hook for deleting a lead.
 * Uses useMutationWithToast for standardized toast notifications.
 * Automatically invalidates the leads query on success.
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
 * Validates: Requirements 3.3
 */
export function useDeleteLead() {
  return useMutationWithToast<void, Error, string>({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    successMessage: 'Lead removido!',
    errorMessage: 'Erro ao remover lead',
    invalidateKeys: [['leads']],
  });
}
