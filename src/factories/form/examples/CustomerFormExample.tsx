/**
 * Customer Form Example
 * 
 * Example implementation showing how to migrate from the old CustomerFormDialog
 * to the new unified form system with CRUD integration.
 * 
 * @fileoverview Customer form migration example
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { createEntityManagementSystem } from '../formCRUDIntegration';
import { customerFormFields, customerFormSections, customerFormTitles } from '../configs/customerFormConfig';

// Customer entity interface
interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
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
  created_at: string;
  updated_at: string;
}

// Create the unified customer management system
const customerSystem = createEntityManagementSystem<Customer>({
  entityType: 'Customer',
  tableName: 'customers',
  titles: customerFormTitles,
  fields: customerFormFields,
  sections: customerFormSections,
  successMessages: {
    create: 'Cliente criado com sucesso!',
    update: 'Cliente atualizado com sucesso!',
    delete: 'Cliente removido com sucesso!'
  },
  errorMessages: {
    create: 'Erro ao criar cliente',
    update: 'Erro ao atualizar cliente',
    delete: 'Erro ao remover cliente'
  },
  transformData: {
    beforeCreate: (data) => ({
      ...data,
      // Add any default values for new customers
      status: 'active'
    }),
    beforeUpdate: (data) => ({
      ...data,
      // Add any update-specific transformations
      updated_at: new Date().toISOString()
    })
  },
  onOperationSuccess: {
    onCreate: (customer) => {
      console.log('Customer created:', customer);
      // Add any post-creation logic here
    },
    onUpdate: (customer) => {
      console.log('Customer updated:', customer);
      // Add any post-update logic here
    },
    onDelete: () => {
      console.log('Customer deleted');
      // Add any post-deletion logic here
    }
  }
});

// Extract the components and hooks
const { FormDialogWithCRUD, crud } = customerSystem;

/**
 * Example component showing how to use the unified customer form system.
 * This replaces the old CustomerFormDialog usage pattern.
 */
export function CustomerFormExample() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // CRUD hooks (optional - the FormDialogWithCRUD handles this internally)
  const createCustomer = crud.useCreate();
  const updateCustomer = crud.useUpdate();
  const deleteCustomer = crud.useDelete();

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditOpen(true);
  };

  const handleCreateSuccess = (customer: Customer) => {
    console.log('New customer created:', customer);
    // Handle success (e.g., refresh list, show notification)
  };

  const handleUpdateSuccess = (customer: Customer) => {
    console.log('Customer updated:', customer);
    setEditingCustomer(null);
    // Handle success (e.g., refresh list, show notification)
  };

  const handleError = (error: Error, mode: 'create' | 'edit') => {
    console.error(`Error ${mode}ing customer:`, error);
    // Handle error (e.g., show error message)
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Customer Management Example</h2>
      
      <div className="flex gap-4">
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Create New Customer
        </button>
        
        <button
          onClick={() => handleEditCustomer({
            id: 'example-id',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Edit Example Customer
        </button>
      </div>

      {/* Create Customer Dialog */}
      <FormDialogWithCRUD
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        mode="create"
        onSuccess={handleCreateSuccess}
        onError={handleError}
      />

      {/* Edit Customer Dialog */}
      <FormDialogWithCRUD
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingCustomer(null);
        }}
        mode="edit"
        initialData={editingCustomer || undefined}
        entityId={editingCustomer?.id}
        onSuccess={handleUpdateSuccess}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Migration Guide:
 * 
 * OLD WAY (CustomerFormDialog):
 * ```tsx
 * <CustomerFormDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   editingCustomer={customer}
 *   formData={formData}
 *   onFormDataChange={setFormData}
 *   products={products}
 *   services={services}
 *   saleItems={saleItems}
 *   onSaleItemsChange={setSaleItems}
 *   saleDiscount={discount}
 *   onSaleDiscountChange={setDiscount}
 *   showSaleSection={showSale}
 *   onShowSaleSectionChange={setShowSale}
 *   onSubmit={handleSubmit}
 *   isLoading={isLoading}
 * />
 * ```
 * 
 * NEW WAY (Unified System):
 * ```tsx
 * <FormDialogWithCRUD
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   mode={customer ? 'edit' : 'create'}
 *   initialData={customer}
 *   entityId={customer?.id}
 *   onSuccess={handleSuccess}
 *   onError={handleError}
 * />
 * ```
 * 
 * Benefits of the new approach:
 * 1. Much simpler API - no need to manage form state manually
 * 2. Automatic CRUD integration - no need to write mutation logic
 * 3. Consistent validation and error handling
 * 4. Type-safe throughout
 * 5. Reusable across different entities
 * 6. Built-in loading states and optimistic updates
 * 7. Configurable transformations and callbacks
 */

export default CustomerFormExample;