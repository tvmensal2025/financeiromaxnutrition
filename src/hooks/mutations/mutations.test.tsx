/**
 * Unit tests for mutation hooks
 * 
 * Tests the following requirements:
 * - 3.4: WHEN a mutation succeeds, THE Custom_Hook SHALL display a success toast with a configurable message
 * - 3.5: WHEN a mutation fails, THE Custom_Hook SHALL display an error toast with the error message
 * - 3.6: WHEN a mutation succeeds, THE Custom_Hook SHALL automatically invalidate related query keys
 * - 3.7: THE Custom_Hook module SHALL accept an `onSuccess` callback for additional success handling
 * - 3.8: THE Custom_Hook module SHALL accept an `onError` callback for additional error handling
 * 
 * @module hooks/mutations/mutations.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    toasts: [],
    dismiss: vi.fn(),
  }),
}));

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    business: { id: 'test-business-id', name: 'Test Business' },
    user: { id: 'test-user-id' },
    session: {},
    profile: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useMutationWithToast } from './useMutationWithToast';
import { useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from './useCustomerMutations';
import { supabase } from '@/integrations/supabase/client';

// Helper to create a wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
  
  return {
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    },
    queryClient,
  };
}

// Helper to create mock Supabase mutation chain for insert
function createMockSupabaseInsert(data: unknown | null, error: Error | null = null) {
  const mockQuery = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  return mockQuery;
}

// Helper to create mock Supabase mutation chain for update/delete
function createMockSupabaseUpdate(error: Error | null = null) {
  const mockQuery = {
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation((field: string, value: any) => {
      // For delete operations, eq is the final call
      if (mockQuery.delete.mock.calls.length > 0) {
        return Promise.resolve({ data: null, error });
      }
      // For update operations, eq returns this to continue the chain
      return mockQuery;
    }),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      if (error) {
        return Promise.resolve({ data: null, error });
      }
      return Promise.resolve({ data: { id: 'test-id', name: 'Test' }, error: null });
    }),
  };
  return mockQuery;
}

describe('useMutationWithToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Requirement 3.4: Success toast display', () => {
    it('should display success toast with string message on mutation success', async () => {
      const { wrapper } = createWrapper();
      const mockMutationFn = vi.fn().mockResolvedValue({ id: '1', name: 'Test' });

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Operation successful!',
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({});
      });

      expect(mockToast).toHaveBeenCalledWith({ title: 'Operation successful!' });
    });

    it('should display success toast with dynamic message from function', async () => {
      const { wrapper } = createWrapper();
      const mockMutationFn = vi.fn().mockResolvedValue({ id: '1', name: 'John' });

      const { result } = renderHook(
        () =>
          useMutationWithToast<{ id: string; name: string }, Error, void>({
            mutationFn: mockMutationFn,
            successMessage: (data) => `Created ${data.name} successfully!`,
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(mockToast).toHaveBeenCalledWith({ title: 'Created John successfully!' });
    });
  });

  describe('Requirement 3.5: Error toast display', () => {
    it('should display error toast with string message on mutation failure', async () => {
      const { wrapper } = createWrapper();
      const mockError = new Error('Database error');
      const mockMutationFn = vi.fn().mockRejectedValue(mockError);

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            errorMessage: 'Failed to complete operation',
          }),
        { wrapper }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({});
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Failed to complete operation',
        variant: 'destructive',
      });
    });

    it('should display error toast with dynamic message from function', async () => {
      const { wrapper } = createWrapper();
      const mockError = new Error('Connection timeout');
      const mockMutationFn = vi.fn().mockRejectedValue(mockError);

      const { result } = renderHook(
        () =>
          useMutationWithToast<unknown, Error, void>({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            errorMessage: (error) => `Error: ${error.message}`,
          }),
        { wrapper }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync();
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error: Connection timeout',
        variant: 'destructive',
      });
    });

    it('should display error message from Error object when no errorMessage provided', async () => {
      const { wrapper } = createWrapper();
      const mockError = new Error('Something went wrong');
      const mockMutationFn = vi.fn().mockRejectedValue(mockError);

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
          }),
        { wrapper }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({});
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Something went wrong',
        variant: 'destructive',
      });
    });

    it('should display generic error message for non-Error objects', async () => {
      const { wrapper } = createWrapper();
      const mockMutationFn = vi.fn().mockRejectedValue('string error');

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
          }),
        { wrapper }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({});
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'An error occurred',
        variant: 'destructive',
      });
    });
  });

  describe('Requirement 3.6: Query invalidation', () => {
    it('should invalidate specified query keys on success', async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            invalidateKeys: [['customers'], ['leads', 'test-business-id']],
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({});
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['leads', 'test-business-id'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
    });

    it('should not invalidate queries on failure', async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const mockMutationFn = vi.fn().mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            invalidateKeys: [['customers']],
          }),
        { wrapper }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({});
        } catch {
          // Expected to throw
        }
      });

      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });

    it('should handle empty invalidateKeys array', async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            invalidateKeys: [],
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({});
      });

      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });

    it('should handle undefined invalidateKeys', async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({});
      });

      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 3.7: onSuccess callback invocation', () => {
    it('should invoke onSuccess callback with data and variables on success', async () => {
      const { wrapper } = createWrapper();
      const mockOnSuccess = vi.fn();
      const mockData = { id: '1', name: 'Test Customer' };
      const mockVariables = { name: 'Test Customer' };
      const mockMutationFn = vi.fn().mockResolvedValue(mockData);

      const { result } = renderHook(
        () =>
          useMutationWithToast<typeof mockData, Error, typeof mockVariables>({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            onSuccess: mockOnSuccess,
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync(mockVariables);
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(mockData, mockVariables);
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });

    it('should not invoke onSuccess callback on failure', async () => {
      const { wrapper } = createWrapper();
      const mockOnSuccess = vi.fn();
      const mockMutationFn = vi.fn().mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            onSuccess: mockOnSuccess,
          }),
        { wrapper }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({});
        } catch {
          // Expected to throw
        }
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should work without onSuccess callback', async () => {
      const { wrapper } = createWrapper();
      const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({});
      });

      // Should complete without error - verify toast was called
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: 'Success' });
      });
    });
  });

  describe('Requirement 3.8: onError callback invocation', () => {
    it('should invoke onError callback with error and variables on failure', async () => {
      const { wrapper } = createWrapper();
      const mockOnError = vi.fn();
      const mockError = new Error('Database connection failed');
      const mockVariables = { name: 'Test' };
      const mockMutationFn = vi.fn().mockRejectedValue(mockError);

      const { result } = renderHook(
        () =>
          useMutationWithToast<unknown, Error, typeof mockVariables>({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            onError: mockOnError,
          }),
        { wrapper }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync(mockVariables);
        } catch {
          // Expected to throw
        }
      });

      expect(mockOnError).toHaveBeenCalledWith(mockError, mockVariables);
      expect(mockOnError).toHaveBeenCalledTimes(1);
    });

    it('should not invoke onError callback on success', async () => {
      const { wrapper } = createWrapper();
      const mockOnError = vi.fn();
      const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
            onError: mockOnError,
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({});
      });

      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('should work without onError callback', async () => {
      const { wrapper } = createWrapper();
      const mockMutationFn = vi.fn().mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(
        () =>
          useMutationWithToast({
            mutationFn: mockMutationFn,
            successMessage: 'Success',
          }),
        { wrapper }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({});
        } catch {
          // Expected to throw
        }
      });

      // Should complete without additional errors - verify error toast was called
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed',
          variant: 'destructive',
        });
      });
    });
  });
});

describe('useCustomerMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useCreateCustomer', () => {
    it('should display success toast when customer is created', async () => {
      const { wrapper } = createWrapper();
      const mockCustomer = {
        id: 'customer-1',
        business_id: 'test-business-id',
        name: 'John Doe',
        email: 'john@example.com',
        created_at: new Date().toISOString(),
      };

      const mockQuery = createMockSupabaseInsert(mockCustomer);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useCreateCustomer(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ name: 'John Doe', email: 'john@example.com' });
      });

      expect(mockToast).toHaveBeenCalledWith({ title: 'Cliente criado com sucesso!' });
    });

    it('should display error toast when customer creation fails', async () => {
      const { wrapper } = createWrapper();
      const mockError = new Error('Insert failed');
      const mockQuery = createMockSupabaseInsert(null, mockError);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useCreateCustomer(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({ name: 'John Doe' });
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erro ao criar cliente',
        variant: 'destructive',
      });
    });

    it('should invalidate customers query on success', async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const mockCustomer = { id: 'customer-1', name: 'John Doe' };
      const mockQuery = createMockSupabaseInsert(mockCustomer);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useCreateCustomer(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ name: 'John Doe' });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
    });
  });

  describe('useUpdateCustomer', () => {
    it('should display success toast when customer is updated', async () => {
      const { wrapper } = createWrapper();
      const mockQuery = createMockSupabaseUpdate();
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useUpdateCustomer(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'customer-1', data: { name: 'Jane Doe' } });
      });

      expect(mockToast).toHaveBeenCalledWith({ title: 'Cliente atualizado!' });
    });

    it('should display error toast when customer update fails', async () => {
      const { wrapper } = createWrapper();
      const mockError = new Error('Update failed');
      const mockQuery = createMockSupabaseUpdate(mockError);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useUpdateCustomer(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({ id: 'customer-1', data: { name: 'Jane Doe' } });
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erro ao atualizar cliente',
        variant: 'destructive',
      });
    });

    it('should invalidate customers query on success', async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const mockQuery = createMockSupabaseUpdate();
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useUpdateCustomer(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'customer-1', data: { name: 'Jane Doe' } });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
    });
  });

  describe('useDeleteCustomer', () => {
    it('should display success toast when customer is deleted', async () => {
      const { wrapper } = createWrapper();
      const mockQuery = createMockSupabaseUpdate();
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useDeleteCustomer(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('customer-1');
      });

      expect(mockToast).toHaveBeenCalledWith({ title: 'Cliente removido!' });
    });

    it('should display error toast when customer deletion fails', async () => {
      const { wrapper } = createWrapper();
      const mockError = new Error('Delete failed');
      const mockQuery = createMockSupabaseUpdate(mockError);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useDeleteCustomer(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync('customer-1');
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erro ao remover cliente',
        variant: 'destructive',
      });
    });

    it('should invalidate customers query on success', async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const mockQuery = createMockSupabaseUpdate();
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useDeleteCustomer(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('customer-1');
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
    });
  });
});
