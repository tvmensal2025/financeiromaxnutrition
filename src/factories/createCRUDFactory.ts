/**
 * Generic CRUD Factory Implementation
 * 
 * Creates type-safe CRUD operations (create, update, delete) for any entity type.
 * Eliminates code duplication across mutation hooks while maintaining consistent patterns.
 * 
 * @fileoverview Generic CRUD factory implementation
 * @version 1.0.0
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  BaseEntity, 
  CreateData, 
  UpdateData, 
  FactoryError 
} from './types/core';
import { 
  CRUDFactory, 
  CRUDFactoryOptions, 
  UpdateVariables,
  CRUDOperation,
  CRUDOperationContext
} from './types/crud';

/**
 * Creates a generic CRUD factory for any entity type.
 * Generates type-safe create, update, and delete operations with consistent patterns.
 * 
 * @template T - The entity type extending BaseEntity
 * @param options - Configuration options for the CRUD factory
 * @returns A CRUD factory with type-safe mutation hooks
 * 
 * @example
 * ```typescript
 * interface Customer extends BaseEntity {
 *   name: string;
 *   email?: string;
 *   phone?: string;
 * }
 * 
 * const customerCRUD = createCRUDFactory<Customer>({
 *   tableName: 'customers',
 *   successMessages: {
 *     create: 'Cliente criado com sucesso!',
 *     update: 'Cliente atualizado!',
 *     delete: 'Cliente removido!'
 *   },
 *   invalidateKeys: [['customers']],
 *   optimisticUpdates: true
 * });
 * 
 * // Usage in component
 * const createCustomer = customerCRUD.useCreate();
 * const updateCustomer = customerCRUD.useUpdate();
 * const deleteCustomer = customerCRUD.useDelete();
 * ```
 * 
 * **Validates: Requirements 1.1, 1.3, 1.4, 1.5**
 */
export function createCRUDFactory<T extends BaseEntity>(
  options: CRUDFactoryOptions
): CRUDFactory<T> {
  const {
    tableName,
    successMessages = {},
    errorMessages = {},
    invalidateKeys = [[tableName]],
    optimisticUpdates = false,
    onSuccess,
    onError
  } = options;

  /**
   * Creates a standardized error object from various error types.
   */
  const createFactoryError = (
    error: unknown, 
    operation: CRUDOperation, 
    context?: string
  ): FactoryError => {
    const baseError = error instanceof Error ? error : new Error(String(error));
    
    return {
      message: baseError.message,
      code: 'CRUD_ERROR',
      context: context || `${operation} operation on ${tableName}`,
      originalError: baseError,
      metadata: {
        operation,
        tableName,
        timestamp: new Date().toISOString()
      }
    };
  };

  /**
   * Handles success operations with consistent patterns.
   */
  const handleSuccess = <TData>(
    operation: CRUDOperation,
    data: TData,
    context: CRUDOperationContext<T>
  ) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Display success message (Requirement 1.3)
    const message = successMessages[operation] || `${operation} completed successfully`;
    toast({ title: message });

    // Invalidate relevant queries (Requirement 1.3)
    invalidateKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });

    // Call custom success callback if provided
    onSuccess?.(operation, data);

    // Log operation for debugging
    if (options.debug) {
      console.log(`CRUD Success [${tableName}]:`, {
        operation,
        data,
        duration: Date.now() - context.startTime
      });
    }
  };

  /**
   * Handles error operations with consistent patterns.
   */
  const handleError = (
    error: FactoryError,
    operation: CRUDOperation,
    context: CRUDOperationContext<T>
  ) => {
    const { toast } = useToast();

    // Display error message (Requirement 1.4)
    const message = errorMessages[operation] || error.message || `Error during ${operation}`;
    toast({ 
      title: message, 
      variant: 'destructive',
      description: options.debug ? error.context : undefined
    });

    // Call custom error callback if provided
    onError?.(error, `${operation} operation`);

    // Log error for debugging
    if (options.debug) {
      console.error(`CRUD Error [${tableName}]:`, {
        operation,
        error,
        duration: Date.now() - context.startTime
      });
    }
  };

  /**
   * Create operation hook.
   * Generates a mutation hook for creating new entities.
   */
  const useCreate = () => {
    const { business } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation<T, FactoryError, CreateData<T>>({
      mutationFn: async (data: CreateData<T>) => {
        const context: CRUDOperationContext<T> = {
          operation: 'create',
          data,
          startTime: Date.now()
        };

        try {
          if (!business?.id) {
            throw new Error('Business not found');
          }

          // Add business_id if entity is a BusinessEntity
          const insertData = {
            ...data,
            ...(tableName !== 'businesses' && { business_id: business.id })
          };

          const { data: result, error } = await supabase
            .from(tableName as any)
            .insert(insertData)
            .select()
            .single();

          if (error) throw error;
          return result as unknown as T;
        } catch (error) {
          throw createFactoryError(error, 'create', `Creating ${tableName}`);
        }
      },
      onSuccess: (data, variables) => {
        const context: CRUDOperationContext<T> = {
          operation: 'create',
          data: variables,
          startTime: Date.now()
        };

        // Display success message
        const message = successMessages.create || `${tableName} created successfully`;
        toast({ title: message });

        // Invalidate queries
        invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });

        // Call custom callback
        onSuccess?.('create', data);
      },
      onError: (error, variables) => {
        const context: CRUDOperationContext<T> = {
          operation: 'create',
          data: variables,
          startTime: Date.now()
        };

        // Display error message
        const message = errorMessages.create || error.message || 'Error creating entity';
        toast({ 
          title: message, 
          variant: 'destructive',
          description: options.debug ? error.context : undefined
        });

        // Call custom callback
        onError?.(error, 'create operation');
      }
    });
  };

  /**
   * Update operation hook.
   * Generates a mutation hook for updating existing entities.
   */
  const useUpdate = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation<T, FactoryError, UpdateVariables<T>>({
      mutationFn: async ({ id, data }: UpdateVariables<T>) => {
        const context: CRUDOperationContext<T> = {
          operation: 'update',
          data,
          metadata: { id },
          startTime: Date.now()
        };

        try {
          // Handle optimistic updates (Requirement 1.5)
          if (optimisticUpdates) {
            // Apply optimistic update to cache
            queryClient.setQueryData([tableName], (oldData: T[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map(item => 
                item.id === id ? { ...item, ...data } : item
              );
            });
          }

          const { data: result, error } = await supabase
            .from(tableName as any)
            .update(data)
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;
          return result as unknown as T;
        } catch (error) {
          // Revert optimistic update on error
          if (optimisticUpdates) {
            queryClient.invalidateQueries({ queryKey: [tableName] });
          }
          throw createFactoryError(error, 'update', `Updating ${tableName} with id ${id}`);
        }
      },
      onSuccess: (data, variables) => {
        const context: CRUDOperationContext<T> = {
          operation: 'update',
          data: variables.data,
          metadata: { id: variables.id },
          startTime: Date.now()
        };

        // Display success message
        const message = successMessages.update || `${tableName} updated successfully`;
        toast({ title: message });

        // Invalidate queries (this will override optimistic updates with real data)
        invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });

        // Call custom callback
        onSuccess?.('update', data);
      },
      onError: (error, variables) => {
        const context: CRUDOperationContext<T> = {
          operation: 'update',
          data: variables.data,
          metadata: { id: variables.id },
          startTime: Date.now()
        };

        // Display error message
        const message = errorMessages.update || error.message || 'Error updating entity';
        toast({ 
          title: message, 
          variant: 'destructive',
          description: options.debug ? error.context : undefined
        });

        // Call custom callback
        onError?.(error, 'update operation');
      }
    });
  };

  /**
   * Delete operation hook.
   * Generates a mutation hook for deleting entities.
   */
  const useDelete = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation<void, FactoryError, string>({
      mutationFn: async (id: string) => {
        const context: CRUDOperationContext<T> = {
          operation: 'delete',
          metadata: { id },
          startTime: Date.now()
        };

        try {
          // Handle optimistic updates (Requirement 1.5)
          if (optimisticUpdates) {
            // Apply optimistic delete to cache
            queryClient.setQueryData([tableName], (oldData: T[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.filter(item => item.id !== id);
            });
          }

          const { error } = await supabase
            .from(tableName as any)
            .delete()
            .eq('id', id);

          if (error) throw error;
        } catch (error) {
          // Revert optimistic update on error
          if (optimisticUpdates) {
            queryClient.invalidateQueries({ queryKey: [tableName] });
          }
          throw createFactoryError(error, 'delete', `Deleting ${tableName} with id ${id}`);
        }
      },
      onSuccess: (data, variables) => {
        const context: CRUDOperationContext<T> = {
          operation: 'delete',
          metadata: { id: variables },
          startTime: Date.now()
        };

        // Display success message
        const message = successMessages.delete || `${tableName} deleted successfully`;
        toast({ title: message });

        // Invalidate queries (this will override optimistic updates with real data)
        invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });

        // Call custom callback
        onSuccess?.('delete', undefined);
      },
      onError: (error, variables) => {
        const context: CRUDOperationContext<T> = {
          operation: 'delete',
          metadata: { id: variables },
          startTime: Date.now()
        };

        // Display error message
        const message = errorMessages.delete || error.message || 'Error deleting entity';
        toast({ 
          title: message, 
          variant: 'destructive',
          description: options.debug ? error.context : undefined
        });

        // Call custom callback
        onError?.(error, 'delete operation');
      }
    });
  };

  /**
   * Get table name for debugging and introspection.
   */
  const getTableName = () => tableName;

  /**
   * Get factory configuration for debugging and introspection.
   */
  const getConfig = () => options;

  return {
    useCreate,
    useUpdate,
    useDelete,
    getTableName,
    getConfig
  };
}