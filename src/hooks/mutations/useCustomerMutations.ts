import { createCRUDFactory } from '@/factories/createCRUDFactory';
import { BaseEntity } from '@/factories/types/core';

/**
 * Customer entity type representing a row from the customers table.
 * This interface defines the shape of customer data returned from queries.
 */
export interface Customer extends BaseEntity {
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  cpf: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  neighborhood: string | null;
  country: string | null;
  company_name: string | null;
  occupation: string | null;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  source: string | null;
  avatar_url: string | null;
  points: number | null;
  last_activity: string | null;
  activity_level: string | null;
  fitness_level: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
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
  lead_data: Record<string, unknown> | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/**
 * Data required to create a new customer.
 * Only name is required; all other fields are optional.
 */
export interface CreateCustomerData {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  notes?: string;
  cpf?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  neighborhood?: string;
  country?: string;
  company_name?: string;
  occupation?: string;
  birth_date?: string;
  age?: number;
  gender?: string;
  source?: string;
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
 * Variables for updating a customer.
 * Requires the customer ID and partial data to update.
 */
export interface UpdateCustomerVariables {
  id: string;
  data: Partial<CreateCustomerData>;
}

/**
 * Customer CRUD factory instance.
 * Provides standardized create, update, and delete operations for customers.
 * 
 * **Validates: Requirements 1.6 - Backward Compatibility Preservation**
 */
const customerCRUD = createCRUDFactory<Customer>({
  tableName: 'customers',
  successMessages: {
    create: 'Cliente criado com sucesso!',
    update: 'Cliente atualizado!',
    delete: 'Cliente removido!'
  },
  errorMessages: {
    create: 'Erro ao criar cliente',
    update: 'Erro ao atualizar cliente',
    delete: 'Erro ao remover cliente'
  },
  invalidateKeys: [['customers']],
  optimisticUpdates: false
});

/**
 * Hook for creating a new customer.
 * Uses the CRUD factory for standardized operations.
 * Maintains backward compatibility with the existing API.
 * 
 * @returns A React Query mutation object for creating customers
 * 
 * @example
 * ```tsx
 * const createCustomer = useCreateCustomer();
 * 
 * const handleCreate = async () => {
 *   await createCustomer.mutateAsync({
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     phone: '11999999999',
 *   });
 * };
 * ```
 * 
 * Validates: Requirements 3.1, 1.6
 */
export function useCreateCustomer() {
  return customerCRUD.useCreate();
}

/**
 * Hook for updating an existing customer.
 * Uses the CRUD factory for standardized operations.
 * Maintains backward compatibility with the existing API.
 * 
 * @returns A React Query mutation object for updating customers
 * 
 * @example
 * ```tsx
 * const updateCustomer = useUpdateCustomer();
 * 
 * const handleUpdate = async () => {
 *   await updateCustomer.mutateAsync({
 *     id: 'customer-uuid',
 *     data: { name: 'Jane Doe', email: 'jane@example.com' },
 *   });
 * };
 * ```
 * 
 * Validates: Requirements 3.2, 1.6
 */
export function useUpdateCustomer() {
  return customerCRUD.useUpdate();
}

/**
 * Hook for deleting a customer.
 * Uses the CRUD factory for standardized operations.
 * Maintains backward compatibility with the existing API.
 * 
 * @returns A React Query mutation object for deleting customers
 * 
 * @example
 * ```tsx
 * const deleteCustomer = useDeleteCustomer();
 * 
 * const handleDelete = async () => {
 *   await deleteCustomer.mutateAsync('customer-uuid');
 * };
 * ```
 * 
 * Validates: Requirements 3.3, 1.6
 */
export function useDeleteCustomer() {
  return customerCRUD.useDelete();
}
