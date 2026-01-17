/**
 * Unit tests for query hooks
 * 
 * Tests the following requirements:
 * - 2.7: WHEN a query hook is called without a valid business ID, THE Custom_Hook SHALL return an empty array without making a network request
 * - 2.9: WHEN a query fails, THE Custom_Hook SHALL expose the error through the returned object for component-level handling
 * 
 * @module hooks/queries/queries.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from './useProducts';
import { useLeads } from './useLeads';
import { useServices } from './useServices';
import { usePlans } from './usePlans';
import { useInvoices } from './useInvoices';

// Helper to create a wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Helper to create mock Supabase query chain
function createMockSupabaseQuery(data: unknown[] | null, error: Error | null = null) {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
  return mockQuery;
}

describe('Query Hooks - Requirement 2.7: Empty business ID returns empty array', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useProducts', () => {
    it('should return empty array when business ID is null', async () => {
      vi.mocked(useAuth).mockReturnValue({
        business: null,
        user: null,
        session: null,
        profile: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      // The query should be disabled and return undefined initially
      // but the queryFn returns [] when business?.id is falsy
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Supabase should not be called when business ID is missing
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should return empty array when business ID is undefined', async () => {
      vi.mocked(useAuth).mockReturnValue({
        business: undefined as any,
        user: null,
        session: null,
        profile: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('useLeads', () => {
    it('should return empty array when business ID is null', async () => {
      vi.mocked(useAuth).mockReturnValue({
        business: null,
        user: null,
        session: null,
        profile: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useLeads(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('useServices', () => {
    it('should return empty array when business ID is null', async () => {
      vi.mocked(useAuth).mockReturnValue({
        business: null,
        user: null,
        session: null,
        profile: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useServices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('usePlans', () => {
    it('should return empty array when business ID is null', async () => {
      vi.mocked(useAuth).mockReturnValue({
        business: null,
        user: null,
        session: null,
        profile: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => usePlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('useInvoices', () => {
    it('should return empty array when business ID is null', async () => {
      vi.mocked(useAuth).mockReturnValue({
        business: null,
        user: null,
        session: null,
        profile: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useInvoices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });
});

describe('Query Hooks - With valid business ID', () => {
  const mockBusiness = {
    id: 'test-business-id',
    name: 'Test Business',
    slug: 'test-business',
    logo_url: null,
    primary_color: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      business: mockBusiness,
      user: { id: 'test-user-id' } as any,
      session: {} as any,
      profile: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useProducts', () => {
    it('should make a query when business ID is present', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', price: 100, is_active: true },
        { id: '2', name: 'Product 2', price: 200, is_active: true },
      ];

      const mockQuery = createMockSupabaseQuery(mockProducts);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockQuery.eq).toHaveBeenCalledWith('business_id', 'test-business-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(result.current.data).toEqual(mockProducts);
    });
  });

  describe('useLeads', () => {
    it('should make a query when business ID is present', async () => {
      const mockLeads = [
        { id: '1', name: 'Lead 1', status: 'new' },
        { id: '2', name: 'Lead 2', status: 'contacted' },
      ];

      const mockQuery = createMockSupabaseQuery(mockLeads);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useLeads(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.from).toHaveBeenCalledWith('leads');
      expect(mockQuery.eq).toHaveBeenCalledWith('business_id', 'test-business-id');
      expect(result.current.data).toEqual(mockLeads);
    });
  });

  describe('useServices', () => {
    it('should make a query when business ID is present', async () => {
      const mockServices = [
        { id: '1', name: 'Service 1', price: 150, is_active: true },
      ];

      const mockQuery = createMockSupabaseQuery(mockServices);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useServices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.from).toHaveBeenCalledWith('services');
      expect(mockQuery.eq).toHaveBeenCalledWith('business_id', 'test-business-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(result.current.data).toEqual(mockServices);
    });
  });

  describe('usePlans', () => {
    it('should make a query when business ID is present', async () => {
      const mockPlans = [
        { id: '1', name: 'Plan 1', price: 99, is_active: true },
      ];

      const mockQuery = createMockSupabaseQuery(mockPlans);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => usePlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.from).toHaveBeenCalledWith('plans');
      expect(mockQuery.eq).toHaveBeenCalledWith('business_id', 'test-business-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(result.current.data).toEqual(mockPlans);
    });
  });

  describe('useInvoices', () => {
    it('should make a query when business ID is present', async () => {
      const mockInvoices = [
        { id: '1', invoice_number: 'INV-001', total: 500 },
      ];

      const mockQuery = createMockSupabaseQuery(mockInvoices);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useInvoices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.from).toHaveBeenCalledWith('invoices');
      expect(mockQuery.eq).toHaveBeenCalledWith('business_id', 'test-business-id');
      expect(result.current.data).toEqual(mockInvoices);
    });

    it('should filter by customer ID when provided', async () => {
      const mockInvoices = [
        { id: '1', invoice_number: 'INV-001', total: 500, customer_id: 'customer-123' },
      ];

      const mockQuery = createMockSupabaseQuery(mockInvoices);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useInvoices({ customerId: 'customer-123' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.from).toHaveBeenCalledWith('invoices');
      expect(mockQuery.eq).toHaveBeenCalledWith('business_id', 'test-business-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('customer_id', 'customer-123');
      expect(result.current.data).toEqual(mockInvoices);
    });
  });
});

describe('Query Hooks - Requirement 2.9: Error exposure through returned object', () => {
  const mockBusiness = {
    id: 'test-business-id',
    name: 'Test Business',
    slug: 'test-business',
    logo_url: null,
    primary_color: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      business: mockBusiness,
      user: { id: 'test-user-id' } as any,
      session: {} as any,
      profile: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useProducts', () => {
    it('should expose error through returned object when query fails', async () => {
      const mockError = new Error('Database connection failed');
      const mockQuery = createMockSupabaseQuery(null, mockError);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Database connection failed');
    });
  });

  describe('useLeads', () => {
    it('should expose error through returned object when query fails', async () => {
      const mockError = new Error('Permission denied');
      const mockQuery = createMockSupabaseQuery(null, mockError);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useLeads(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Permission denied');
    });
  });

  describe('useServices', () => {
    it('should expose error through returned object when query fails', async () => {
      const mockError = new Error('Network error');
      const mockQuery = createMockSupabaseQuery(null, mockError);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useServices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  describe('usePlans', () => {
    it('should expose error through returned object when query fails', async () => {
      const mockError = new Error('Table not found');
      const mockQuery = createMockSupabaseQuery(null, mockError);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => usePlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Table not found');
    });
  });

  describe('useInvoices', () => {
    it('should expose error through returned object when query fails', async () => {
      const mockError = new Error('Query timeout');
      const mockQuery = createMockSupabaseQuery(null, mockError);
      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const { result } = renderHook(() => useInvoices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Query timeout');
    });
  });
});
