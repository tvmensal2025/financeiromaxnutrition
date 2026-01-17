import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

/**
 * Configuration options for useMutationWithToast hook
 * @template TData - The type of data returned by the mutation
 * @template TError - The type of error that can be thrown
 * @template TVariables - The type of variables passed to the mutation
 */
export interface MutationWithToastOptions<TData, TError, TVariables> {
  /** The mutation function that performs the async operation */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Message to display on success - can be a string or a function that receives the data */
  successMessage: string | ((data: TData) => string);
  /** Optional message to display on error - can be a string or a function that receives the error */
  errorMessage?: string | ((error: TError) => string);
  /** Optional array of query keys to invalidate on success */
  invalidateKeys?: string[][];
  /** Optional callback to run on success */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Optional callback to run on error */
  onError?: (error: TError, variables: TVariables) => void;
}

/**
 * A factory hook that wraps useMutation with standardized toast notifications
 * and automatic query invalidation.
 * 
 * @template TData - The type of data returned by the mutation (default: unknown)
 * @template TError - The type of error that can be thrown (default: Error)
 * @template TVariables - The type of variables passed to the mutation (default: void)
 * 
 * @param options - Configuration options for the mutation
 * @returns A React Query mutation object with toast notifications
 * 
 * @example
 * ```typescript
 * const createCustomer = useMutationWithToast({
 *   mutationFn: async (data: CreateCustomerData) => {
 *     const { data: customer, error } = await supabase
 *       .from('customers')
 *       .insert(data)
 *       .select()
 *       .single();
 *     if (error) throw error;
 *     return customer;
 *   },
 *   successMessage: 'Cliente criado com sucesso!',
 *   errorMessage: 'Erro ao criar cliente',
 *   invalidateKeys: [['customers']],
 * });
 * ```
 * 
 * Requirements: 3.1, 3.4, 3.5, 3.6, 3.7, 3.8
 */
export function useMutationWithToast<TData = unknown, TError = Error, TVariables = void>(
  options: MutationWithToastOptions<TData, TError, TVariables>
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (data, variables) => {
      // Display success toast with configurable message (Requirement 3.4)
      const message = typeof options.successMessage === 'function'
        ? options.successMessage(data)
        : options.successMessage;
      
      toast({ title: message });
      
      // Automatically invalidate specified query keys (Requirement 3.6)
      options.invalidateKeys?.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      
      // Call optional onSuccess callback (Requirement 3.7)
      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      // Display error toast with configurable message (Requirement 3.5)
      const message = options.errorMessage
        ? (typeof options.errorMessage === 'function'
            ? options.errorMessage(error)
            : options.errorMessage)
        : error instanceof Error
          ? error.message
          : 'An error occurred';
      
      toast({ title: message, variant: 'destructive' });
      
      // Call optional onError callback (Requirement 3.8)
      options.onError?.(error, variables);
    },
  });
}
