/**
 * Property Test: API Pattern Standardization
 * 
 * Tests that the useApiCall hook provides consistent request/response handling,
 * loading states, error handling, and optimistic updates across all API calls.
 * 
 * @fileoverview Property test for API pattern standardization
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { vi } from 'vitest';
import { useApiCall, ApiCallConfig, ApiUtils } from './useApiCall';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}));

// Mock the error handler
vi.mock('./useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: vi.fn((error) => ({
      id: 'test-error',
      message: error.message || 'Test error',
      category: 'unknown',
      severity: 'medium'
    }))
  })
}));

/**
 * **Property 24: API Pattern Standardization**
 * **Validates: Requirements 5.3**
 * 
 * Verifies that the useApiCall hook provides consistent request/response handling
 * across all API call scenarios with proper loading states, error handling,
 * caching, retries, and optimistic updates.
 */
describe('Property 24: API Pattern Standardization', () => {
  beforeEach(() => {
    // Clear cache before each test
    ApiUtils.clearCache();
    vi.clearAllMocks();
  });

  /**
   * Property: API call state management is consistent
   * All API calls should follow the same state transition patterns
   */
  test('API call state management follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          value: fc.integer({ min: 1, max: 1000 })
        }),
        fc.boolean(), // success or failure
        (responseData, shouldSucceed) => {
          const mockApiFunction = vi.fn().mockImplementation(async () => {
            if (shouldSucceed) {
              return responseData;
            } else {
              throw new Error('API call failed');
            }
          });

          const { result } = renderHook(() => useApiCall(mockApiFunction));

          // Initial state should be consistent
          expect(result.current.isLoading).toBe(false);
          expect(result.current.isCalled).toBe(false);
          expect(result.current.isSuccess).toBe(false);
          expect(result.current.isError).toBe(false);
          expect(result.current.data).toBeUndefined();
          expect(result.current.error).toBeUndefined();

          // Execute the API call
          let callPromise: Promise<any>;
          act(() => {
            callPromise = result.current.execute();
          });

          // Should be loading
          expect(result.current.isLoading).toBe(true);
          expect(result.current.isCalled).toBe(true);

          return callPromise.then(
            (data) => {
              // Success case
              expect(result.current.isLoading).toBe(false);
              expect(result.current.isSuccess).toBe(true);
              expect(result.current.isError).toBe(false);
              expect(result.current.data).toEqual(responseData);
              expect(result.current.error).toBeNull();
            },
            (error) => {
              // Error case
              expect(result.current.isLoading).toBe(false);
              expect(result.current.isSuccess).toBe(false);
              expect(result.current.isError).toBe(true);
              expect(result.current.error).toBeDefined();
            }
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Optimistic updates work consistently
   * All API calls with optimistic updates should show optimistic data immediately
   */
  test('optimistic updates follow consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          count: fc.integer({ min: 0, max: 100 })
        }),
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          count: fc.integer({ min: 0, max: 100 })
        }),
        (optimisticData, actualData) => {
          const mockApiFunction = vi.fn().mockResolvedValue(actualData);

          const config: ApiCallConfig = {
            optimistic: true,
            optimisticData
          };

          const { result } = renderHook(() => useApiCall(mockApiFunction, config));

          // Execute the API call
          act(() => {
            result.current.execute();
          });

          // Should show optimistic data immediately
          expect(result.current.data).toEqual(optimisticData);
          expect(result.current.isLoading).toBe(true);

          // Wait for the actual response
          return new Promise(resolve => {
            setTimeout(() => {
              expect(result.current.data).toEqual(actualData);
              expect(result.current.isLoading).toBe(false);
              expect(result.current.isSuccess).toBe(true);
              resolve(true);
            }, 10);
          });
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Caching works consistently
   * Cached API calls should return cached data on subsequent calls
   */
  test('caching follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 10 }),
          data: fc.string({ minLength: 1, maxLength: 50 })
        }),
        fc.string({ minLength: 1, maxLength: 20 }), // cache key
        (responseData, cacheKey) => {
          const mockApiFunction = vi.fn().mockResolvedValue(responseData);

          const config: ApiCallConfig = {
            cache: {
              key: cacheKey,
              ttl: 60000 // 1 minute
            }
          };

          const { result } = renderHook(() => useApiCall(mockApiFunction, config));

          // First call
          return act(async () => {
            await result.current.execute({ userId: responseData.userId });
            expect(mockApiFunction).toHaveBeenCalledTimes(1);
            expect(result.current.data).toEqual(responseData);

            // Second call with same parameters should use cache
            await result.current.execute({ userId: responseData.userId });
            expect(mockApiFunction).toHaveBeenCalledTimes(1); // Still 1, not 2
            expect(result.current.data).toEqual(responseData);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Error handling is consistent
   * All API call errors should be handled uniformly
   */
  test('error handling follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }), // error message
        fc.string({ minLength: 1, maxLength: 20 }), // component name
        (errorMessage, component) => {
          const mockApiFunction = vi.fn().mockRejectedValue(new Error(errorMessage));

          const config: ApiCallConfig = {
            component
          };

          const { result } = renderHook(() => useApiCall(mockApiFunction, config));

          // Execute the API call
          return act(async () => {
            try {
              await result.current.execute();
              // Should not reach here
              expect(true).toBe(false);
            } catch (error) {
              // Should be a standardized error
              expect(error).toHaveProperty('id');
              expect(error).toHaveProperty('message');
              expect(error).toHaveProperty('category');
              expect(error).toHaveProperty('severity');
            }

            // State should reflect error
            expect(result.current.isError).toBe(true);
            expect(result.current.isSuccess).toBe(false);
            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeDefined();
          });
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Reset functionality is consistent
   * Reset should always return API call to initial state
   */
  test('reset functionality follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          value: fc.integer({ min: 1, max: 1000 })
        }),
        fc.boolean(), // whether to succeed or fail
        (responseData, shouldSucceed) => {
          const mockApiFunction = vi.fn().mockImplementation(async () => {
            if (shouldSucceed) {
              return responseData;
            } else {
              throw new Error('Test error');
            }
          });

          const { result } = renderHook(() => useApiCall(mockApiFunction));

          // Execute the API call
          return act(async () => {
            try {
              await result.current.execute();
            } catch (error) {
              // Ignore errors for this test
            }

            // State should be set (either success or error)
            expect(result.current.isCalled).toBe(true);

            // Reset the state
            result.current.reset();

            // Should be back to initial state
            expect(result.current.isLoading).toBe(false);
            expect(result.current.isCalled).toBe(false);
            expect(result.current.isSuccess).toBe(false);
            expect(result.current.isError).toBe(false);
            expect(result.current.data).toBeUndefined();
            expect(result.current.error).toBeUndefined();
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Timeout handling is consistent
   * API calls should timeout consistently when configured
   */
  test('timeout handling follows consistent patterns', () => {
    const mockApiFunction = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
    );

    const config: ApiCallConfig = {
      timeout: 100 // 100ms timeout
    };

    const { result } = renderHook(() => useApiCall(mockApiFunction, config));

    return act(async () => {
      try {
        await result.current.execute();
        // Should not reach here due to timeout
        expect(true).toBe(false);
      } catch (error) {
        // Should timeout
        expect(result.current.isError).toBe(true);
        expect(result.current.isLoading).toBe(false);
      }
    });
  });

  /**
   * Property: Callback execution is consistent
   * Success and error callbacks should be called appropriately
   */
  test('callback execution follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 10 }),
          value: fc.integer({ min: 1, max: 100 })
        }),
        fc.boolean(), // success or failure
        (responseData, shouldSucceed) => {
          const onSuccess = vi.fn();
          const onError = vi.fn();
          const onFinally = vi.fn();

          const mockApiFunction = vi.fn().mockImplementation(async () => {
            if (shouldSucceed) {
              return responseData;
            } else {
              throw new Error('Test error');
            }
          });

          const config: ApiCallConfig = {
            onSuccess,
            onError,
            onFinally
          };

          const { result } = renderHook(() => useApiCall(mockApiFunction, config));

          return act(async () => {
            try {
              await result.current.execute();
              
              if (shouldSucceed) {
                expect(onSuccess).toHaveBeenCalledWith(responseData);
                expect(onError).not.toHaveBeenCalled();
              }
            } catch (error) {
              if (!shouldSucceed) {
                expect(onError).toHaveBeenCalled();
                expect(onSuccess).not.toHaveBeenCalled();
              }
            }

            // onFinally should always be called
            expect(onFinally).toHaveBeenCalledTimes(1);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Data transformation is consistent
   * Transform function should be applied consistently to all responses
   */
  test('data transformation follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          rawValue: fc.integer({ min: 1, max: 100 })
        }),
        (rawData) => {
          const transform = (data: any) => ({
            ...data,
            transformedValue: data.rawValue * 2
          });

          const mockApiFunction = vi.fn().mockResolvedValue(rawData);

          const config: ApiCallConfig = {
            transform
          };

          const { result } = renderHook(() => useApiCall(mockApiFunction, config));

          return act(async () => {
            await result.current.execute();

            // Data should be transformed
            expect(result.current.data).toEqual({
              rawValue: rawData.rawValue,
              transformedValue: rawData.rawValue * 2
            });
          });
        }
      ),
      { numRuns: 15 }
    );
  });
});

/**
 * Integration tests for API pattern standardization
 */
describe('API Pattern Integration Tests', () => {
  beforeEach(() => {
    ApiUtils.clearCache();
    vi.clearAllMocks();
  });

  /**
   * Test higher-order functions work correctly
   */
  test('higher-order functions work consistently', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue({ data: 'test' });
    
    // Test withLoading
    const { result: loadingResult } = renderHook(() => 
      useApiCall(mockApiFunction, { optimistic: false })
    );

    await act(async () => {
      await loadingResult.current.execute();
    });

    expect(loadingResult.current.isSuccess).toBe(true);
    expect(loadingResult.current.data).toEqual({ data: 'test' });

    // Test withErrorHandling
    const { result: errorResult } = renderHook(() => 
      useApiCall(mockApiFunction, { component: 'TestComponent' })
    );

    await act(async () => {
      await errorResult.current.execute();
    });

    expect(errorResult.current.isSuccess).toBe(true);
  });

  /**
   * Test cache invalidation works correctly
   */
  test('cache invalidation works consistently', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue({ data: 'cached' });

    const config: ApiCallConfig = {
      cache: {
        key: 'test-cache',
        ttl: 60000
      }
    };

    const { result } = renderHook(() => useApiCall(mockApiFunction, config));

    // First call
    await act(async () => {
      await result.current.execute();
    });

    expect(mockApiFunction).toHaveBeenCalledTimes(1);

    // Second call should use cache
    await act(async () => {
      await result.current.execute();
    });

    expect(mockApiFunction).toHaveBeenCalledTimes(1);

    // Invalidate cache
    act(() => {
      result.current.invalidateCache();
    });

    // Third call should not use cache
    await act(async () => {
      await result.current.execute();
    });

    expect(mockApiFunction).toHaveBeenCalledTimes(2);
  });

  /**
   * Test cancel functionality works correctly
   */
  test('cancel functionality works consistently', async () => {
    const mockApiFunction = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 100))
    );

    const { result } = renderHook(() => useApiCall(mockApiFunction));

    // Start the API call
    act(() => {
      result.current.execute();
    });

    expect(result.current.isLoading).toBe(true);

    // Cancel the call
    act(() => {
      result.current.cancel();
    });

    expect(result.current.isLoading).toBe(false);
  });

  /**
   * Test optimistic updates can be manually triggered
   */
  test('manual optimistic updates work consistently', () => {
    const mockApiFunction = vi.fn().mockResolvedValue({ data: 'actual' });
    const optimisticData = { data: 'optimistic' };

    const { result } = renderHook(() => useApiCall(mockApiFunction));

    // Update optimistically
    act(() => {
      result.current.updateOptimistic(optimisticData);
    });

    expect(result.current.data).toEqual(optimisticData);
  });
});