/**
 * Standardized API Call Hook
 * 
 * Provides consistent request/response handling, loading states, error handling,
 * and optimistic updates across all API calls in the application.
 * 
 * @fileoverview Standardized API call patterns
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useErrorHandler } from './useErrorHandler';

/**
 * API call state interface
 */
export interface ApiCallState<T = unknown> {
  /** Current data */
  data?: T;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error state */
  error?: string | null;
  
  /** Whether the call has been made */
  isCalled: boolean;
  
  /** Whether the call was successful */
  isSuccess: boolean;
  
  /** Whether the call failed */
  isError: boolean;
  
  /** Call metadata */
  metadata?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
    retryCount?: number;
  };
}

/**
 * API call configuration interface
 */
export interface ApiCallConfig<TData = unknown, TError = unknown> {
  /** Whether to enable optimistic updates */
  optimistic?: boolean;
  
  /** Optimistic data to show while loading */
  optimisticData?: TData;
  
  /** Whether to enable automatic retries */
  retry?: boolean | {
    attempts: number;
    delay: number;
    backoff?: 'linear' | 'exponential';
    condition?: (error: TError) => boolean;
  };
  
  /** Cache configuration */
  cache?: boolean | {
    key: string;
    ttl: number; // Time to live in milliseconds
    invalidateOn?: string[];
  };
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Whether to debounce the request */
  debounce?: number;
  
  /** Whether to throttle the request */
  throttle?: number;
  
  /** Request deduplication */
  dedupe?: boolean;
  
  /** Success callback */
  onSuccess?: (data: TData) => void;
  
  /** Error callback */
  onError?: (error: TError) => void;
  
  /** Finally callback */
  onFinally?: () => void;
  
  /** Transform response data */
  transform?: (data: unknown) => TData;
  
  /** Validate response data */
  validate?: (data: unknown) => boolean;
  
  /** Component context for error reporting */
  component?: string;
}

/**
 * API call actions interface
 */
export interface ApiCallActions<TParams = unknown, TData = unknown> {
  /** Execute the API call */
  execute: (params?: TParams) => Promise<TData>;
  
  /** Reset the call state */
  reset: () => void;
  
  /** Cancel the ongoing request */
  cancel: () => void;
  
  /** Retry the last failed request */
  retry: () => Promise<TData>;
  
  /** Invalidate cache */
  invalidateCache: () => void;
  
  /** Update data optimistically */
  updateOptimistic: (data: TData) => void;
}

/**
 * API call function type
 */
export type ApiCallFunction<TParams = unknown, TData = unknown> = (
  params?: TParams
) => Promise<TData>;

/**
 * Request cache interface
 */
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Global request cache
 */
class RequestCache {
  private cache = new Map<string, CacheEntry>();

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const globalCache = new RequestCache();

/**
 * Request deduplication map
 */
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Standardized API Call Hook
 * 
 * @param apiFunction - The API function to call
 * @param config - Configuration options for the API call
 * @returns API call state and actions
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const userApi = useApiCall(fetchUser, {
 *   component: 'UserProfile'
 * });
 * 
 * // With optimistic updates
 * const updateUserApi = useApiCall(updateUser, {
 *   optimistic: true,
 *   optimisticData: { name: 'Updated Name' },
 *   onSuccess: (user) => console.log('User updated:', user)
 * });
 * 
 * // With retry and cache
 * const postsApi = useApiCall(fetchPosts, {
 *   retry: { attempts: 3, delay: 1000 },
 *   cache: { key: 'posts', ttl: 300000 }, // 5 minutes
 *   debounce: 500
 * });
 * 
 * // Execute the call
 * await userApi.execute({ userId: '123' });
 * ```
 * 
 * **Validates: Requirements 5.3**
 */
export function useApiCall<TParams = unknown, TData = unknown, TError = unknown>(
  apiFunction: ApiCallFunction<TParams, TData>,
  config: ApiCallConfig<TData, TError> = {}
): ApiCallState<TData> & ApiCallActions<TParams, TData> {
  const {
    optimistic = false,
    optimisticData,
    retry = false,
    cache = false,
    timeout = 30000,
    debounce = 0,
    throttle = 0,
    dedupe = true,
    onSuccess,
    onError,
    onFinally,
    transform,
    validate,
    component = 'ApiCall'
  } = config;

  const errorHandler = useErrorHandler({ component, showToast: false });

  const [state, setState] = useState<ApiCallState<TData>>({
    isLoading: false,
    isCalled: false,
    isSuccess: false,
    isError: false
  });

  // Refs for managing timers and requests
  const abortControllerRef = useRef<AbortController>();
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const throttleTimerRef = useRef<NodeJS.Timeout>();
  const lastCallTimeRef = useRef<number>(0);
  const lastParamsRef = useRef<TParams>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  /**
   * Generate cache key for the request
   */
  const generateCacheKey = useCallback((params?: TParams): string => {
    if (typeof cache === 'object' && cache.key) {
      return `${cache.key}_${JSON.stringify(params || {})}`;
    }
    return `${apiFunction.name}_${JSON.stringify(params || {})}`;
  }, [cache, apiFunction]);

  /**
   * Generate deduplication key for the request
   */
  const generateDedupeKey = useCallback((params?: TParams): string => {
    return `${apiFunction.name}_${JSON.stringify(params || {})}`;
  }, [apiFunction]);

  /**
   * Execute the API call with all configured patterns
   */
  const execute = useCallback(async (params?: TParams): Promise<TData> => {
    // Store params for retry
    lastParamsRef.current = params;

    // Handle debouncing
    if (debounce > 0) {
      return new Promise((resolve, reject) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        debounceTimerRef.current = setTimeout(async () => {
          try {
            const result = await executeImmediate(params);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, debounce);
      });
    }

    // Handle throttling
    if (throttle > 0) {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTimeRef.current;
      
      if (timeSinceLastCall < throttle) {
        return new Promise((resolve, reject) => {
          const delay = throttle - timeSinceLastCall;
          throttleTimerRef.current = setTimeout(async () => {
            try {
              const result = await executeImmediate(params);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          }, delay);
        });
      }
    }

    return executeImmediate(params);
  }, [debounce, throttle]);

  /**
   * Execute the API call immediately
   */
  const executeImmediate = useCallback(async (params?: TParams): Promise<TData> => {
    const startTime = Date.now();
    lastCallTimeRef.current = startTime;

    // Check cache first
    if (cache) {
      const cacheKey = generateCacheKey(params);
      const cachedData = globalCache.get<TData>(cacheKey);
      if (cachedData) {
        setState(prev => ({
          ...prev,
          data: cachedData,
          isLoading: false,
          isCalled: true,
          isSuccess: true,
          isError: false,
          error: null
        }));
        return cachedData;
      }
    }

    // Check for pending request (deduplication)
    if (dedupe) {
      const dedupeKey = generateDedupeKey(params);
      const pendingRequest = pendingRequests.get(dedupeKey);
      if (pendingRequest) {
        return pendingRequest as Promise<TData>;
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Set loading state
    setState(prev => ({
      ...prev,
      isLoading: true,
      isCalled: true,
      isError: false,
      error: null,
      metadata: {
        ...prev.metadata,
        startTime,
        retryCount: prev.metadata?.retryCount || 0
      }
    }));

    // Set optimistic data
    if (optimistic && optimisticData) {
      setState(prev => ({
        ...prev,
        data: optimisticData
      }));
    }

    const dedupeKey = dedupe ? generateDedupeKey(params) : '';
    
    try {
      // Create the API call promise
      const apiPromise = Promise.race([
        apiFunction(params),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), timeout);
        })
      ]);

      // Store for deduplication
      if (dedupe) {
        pendingRequests.set(dedupeKey, apiPromise);
      }

      // Execute the API call
      let result = await apiPromise;

      // Transform the result if needed
      if (transform) {
        result = transform(result);
      }

      // Validate the result if needed
      if (validate && !validate(result)) {
        throw new Error('Response validation failed');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Update state with success
      setState(prev => ({
        ...prev,
        data: result,
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        metadata: {
          ...prev.metadata,
          endTime,
          duration
        }
      }));

      // Cache the result
      if (cache) {
        const cacheKey = generateCacheKey(params);
        const ttl = typeof cache === 'object' ? cache.ttl : 300000; // 5 minutes default
        globalCache.set(cacheKey, result, ttl);
      }

      // Call success callback
      onSuccess?.(result);

      return result;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Handle retry logic
      if (retry && !abortControllerRef.current?.signal.aborted) {
        const retryConfig = typeof retry === 'object' ? retry : { attempts: 3, delay: 1000 };
        const currentRetryCount = state.metadata?.retryCount || 0;

        if (currentRetryCount < retryConfig.attempts) {
          // Check retry condition if provided
          if (!retryConfig.condition || retryConfig.condition(error as TError)) {
            const delay = retryConfig.backoff === 'exponential' 
              ? retryConfig.delay * Math.pow(2, currentRetryCount)
              : retryConfig.delay;

            setState(prev => ({
              ...prev,
              metadata: {
                ...prev.metadata,
                retryCount: currentRetryCount + 1
              }
            }));

            // Wait for delay then retry
            await new Promise(resolve => setTimeout(resolve, delay));
            return executeImmediate(params);
          }
        }
      }

      // Handle the error
      const standardizedError = errorHandler.handleError(error, {
        action: 'api_call',
        metadata: { apiFunction: apiFunction.name, params }
      });

      setState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: standardizedError.message,
        metadata: {
          ...prev.metadata,
          endTime,
          duration
        }
      }));

      // Call error callback
      onError?.(error as TError);

      throw standardizedError;

    } finally {
      // Remove from pending requests
      if (dedupe && dedupeKey) {
        pendingRequests.delete(dedupeKey);
      }

      // Call finally callback
      onFinally?.();
    }
  }, [
    cache, generateCacheKey, dedupe, generateDedupeKey, optimistic, optimisticData,
    timeout, transform, validate, retry, state.metadata?.retryCount,
    errorHandler, apiFunction, onSuccess, onError, onFinally
  ]);

  /**
   * Reset the call state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isCalled: false,
      isSuccess: false,
      isError: false
    });
  }, []);

  /**
   * Cancel the ongoing request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
    }

    setState(prev => ({
      ...prev,
      isLoading: false
    }));
  }, []);

  /**
   * Retry the last failed request
   */
  const retryRequest = useCallback(async (): Promise<TData> => {
    if (!lastParamsRef.current && !state.isCalled) {
      throw new Error('No previous request to retry');
    }
    
    return execute(lastParamsRef.current);
  }, [execute, state.isCalled]);

  /**
   * Invalidate cache for this request
   */
  const invalidateCache = useCallback(() => {
    if (cache) {
      const cacheKey = generateCacheKey(lastParamsRef.current);
      globalCache.invalidate(cacheKey);
    }
  }, [cache, generateCacheKey]);

  /**
   * Update data optimistically
   */
  const updateOptimistic = useCallback((data: TData) => {
    setState(prev => ({
      ...prev,
      data
    }));
  }, []);

  return {
    // State
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isCalled: state.isCalled,
    isSuccess: state.isSuccess,
    isError: state.isError,
    metadata: state.metadata,
    
    // Actions
    execute,
    reset,
    cancel,
    retry: retryRequest,
    invalidateCache,
    updateOptimistic
  };
}

/**
 * Higher-order function for creating API call utilities
 */
export function withLoading<TParams, TData>(
  apiFunction: ApiCallFunction<TParams, TData>
) {
  return (params?: TParams, config?: ApiCallConfig<TData>) => {
    return useApiCall(apiFunction, { ...config, optimistic: false });
  };
}

/**
 * Higher-order function for creating API calls with error handling
 */
export function withErrorHandling<TParams, TData>(
  apiFunction: ApiCallFunction<TParams, TData>,
  component: string
) {
  return (params?: TParams, config?: ApiCallConfig<TData>) => {
    return useApiCall(apiFunction, { ...config, component });
  };
}

/**
 * Higher-order function for creating API calls with optimistic updates
 */
export function withOptimisticUpdate<TParams, TData>(
  apiFunction: ApiCallFunction<TParams, TData>,
  optimisticData: TData
) {
  return (params?: TParams, config?: ApiCallConfig<TData>) => {
    return useApiCall(apiFunction, { 
      ...config, 
      optimistic: true, 
      optimisticData 
    });
  };
}

/**
 * Utility functions for API call management
 */
export const ApiUtils = {
  /**
   * Clear all cached requests
   */
  clearCache: () => {
    globalCache.clear();
  },

  /**
   * Invalidate cache by pattern
   */
  invalidateCachePattern: (pattern: string) => {
    globalCache.invalidatePattern(pattern);
  },

  /**
   * Get cache statistics
   */
  getCacheStats: () => {
    // This would return cache statistics in a real implementation
    return {
      size: 0,
      hitRate: 0,
      missRate: 0
    };
  },

  /**
   * Create a batch API call
   */
  batch: async <T>(calls: Array<() => Promise<T>>): Promise<T[]> => {
    return Promise.all(calls.map(call => call()));
  },

  /**
   * Create a sequential API call chain
   */
  sequence: async <T>(calls: Array<() => Promise<T>>): Promise<T[]> => {
    const results: T[] = [];
    for (const call of calls) {
      const result = await call();
      results.push(result);
    }
    return results;
  }
};