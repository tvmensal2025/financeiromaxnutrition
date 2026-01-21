/**
 * UI Performance optimization utilities for factory-generated components
 * Implements render optimization for forms and dialogs with memoization
 * and efficient re-render strategies
 */

import { 
  memo, 
  useMemo, 
  useCallback, 
  useRef, 
  useState, 
  useEffect,
  ReactNode,
  ComponentType,
  MemoExoticComponent
} from 'react';
import { useRenderPerformance } from './performance-monitoring';

// Types for performance optimization
export interface OptimizationConfig {
  enableMemoization?: boolean;
  enableCallbackMemoization?: boolean;
  enableValueMemoization?: boolean;
  enableRenderTracking?: boolean;
  memoizationDeps?: any[];
}

export interface RenderOptimizationHookResult {
  renderCount: number;
  memoizedValue: <T>(value: T, deps: any[]) => T;
  memoizedCallback: <T extends (...args: any[]) => any>(callback: T, deps: any[]) => T;
  shouldRender: (newProps: any, prevProps: any) => boolean;
}

/**
 * Hook for optimizing component rendering performance
 * Usage:
 * const { memoizedValue, memoizedCallback } = useRenderOptimization('MyComponent');
 */
export function useRenderOptimization(
  componentName: string,
  config: OptimizationConfig = {}
): RenderOptimizationHookResult {
  const {
    enableMemoization = true,
    enableCallbackMemoization = true,
    enableValueMemoization = true,
    enableRenderTracking = true
  } = config;

  // Track render performance if enabled
  const renderMetrics = enableRenderTracking 
    ? useRenderPerformance(componentName)
    : { renderCount: 0 };

  // Store for memoized values - using refs to avoid re-renders
  const memoizedValuesCache = useRef<Map<string, any>>(new Map());
  const memoizedCallbacksCache = useRef<Map<string, any>>(new Map());

  // Memoized value helper - returns a function that memoizes values
  const memoizedValue = useCallback(<T>(value: T, deps: any[]): T => {
    if (!enableValueMemoization) return value;
    
    // Create a cache key from dependencies
    const cacheKey = JSON.stringify(deps);
    
    // Check if we have a cached value with same deps
    if (memoizedValuesCache.current.has(cacheKey)) {
      return memoizedValuesCache.current.get(cacheKey);
    }
    
    // Cache the new value
    memoizedValuesCache.current.set(cacheKey, value);
    return value;
  }, [enableValueMemoization]);

  // Memoized callback helper - returns a function that memoizes callbacks
  const memoizedCallback = useCallback(<T extends (...args: any[]) => any>(
    callback: T, 
    deps: any[]
  ): T => {
    if (!enableCallbackMemoization) return callback;
    
    // Create a cache key from dependencies
    const cacheKey = JSON.stringify(deps);
    
    // Check if we have a cached callback with same deps
    if (memoizedCallbacksCache.current.has(cacheKey)) {
      return memoizedCallbacksCache.current.get(cacheKey);
    }
    
    // Cache the new callback
    memoizedCallbacksCache.current.set(cacheKey, callback);
    return callback;
  }, [enableCallbackMemoization]);

  // Shallow comparison for props
  const shouldRender = useCallback((newProps: any, prevProps: any): boolean => {
    if (!enableMemoization) return true;
    
    // Shallow comparison of props
    const newKeys = Object.keys(newProps);
    const prevKeys = Object.keys(prevProps);
    
    if (newKeys.length !== prevKeys.length) return true;
    
    for (const key of newKeys) {
      if (newProps[key] !== prevProps[key]) return true;
    }
    
    return false;
  }, [enableMemoization]);

  return {
    renderCount: renderMetrics.renderCount,
    memoizedValue,
    memoizedCallback,
    shouldRender
  };
}

/**
 * Higher-order component for automatic memoization
 * Usage:
 * const OptimizedComponent = withRenderOptimization(MyComponent, 'MyComponent');
 */
export function withRenderOptimization<P extends object>(
  Component: ComponentType<P>,
  componentName: string,
  config: OptimizationConfig = {}
): MemoExoticComponent<ComponentType<P>> {
  const OptimizedComponent = memo(Component, (prevProps, nextProps) => {
    // Custom comparison logic
    const newKeys = Object.keys(nextProps);
    const prevKeys = Object.keys(prevProps);
    
    if (newKeys.length !== prevKeys.length) return false;
    
    for (const key of newKeys) {
      const prevValue = (prevProps as any)[key];
      const nextValue = (nextProps as any)[key];
      
      // Deep comparison for objects and arrays
      if (typeof prevValue === 'object' && typeof nextValue === 'object') {
        if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
          return false;
        }
      } else if (prevValue !== nextValue) {
        return false;
      }
    }
    
    return true; // Props are equal, skip re-render
  });

  OptimizedComponent.displayName = `Optimized(${componentName})`;
  return OptimizedComponent;
}

/**
 * Hook for optimizing form field rendering
 * Specifically designed for dynamic form generation
 */
export function useFormFieldOptimization(fieldName: string) {
  const [fieldValue, setFieldValue] = useState<any>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const previousValue = useRef<any>(null);
  const renderCount = useRef(0);

  // Track renders
  useEffect(() => {
    renderCount.current += 1;
  });

  // Memoized field change handler
  const handleFieldChange = useCallback((value: any) => {
    if (previousValue.current !== value) {
      previousValue.current = value;
      setFieldValue(value);
    }
  }, []);

  // Memoized error setter
  const handleFieldError = useCallback((error: string | null) => {
    setFieldError(error);
  }, []);

  // Memoized field props
  const fieldProps = useMemo(() => ({
    value: fieldValue,
    error: fieldError,
    onChange: handleFieldChange,
    onError: handleFieldError,
    name: fieldName
  }), [fieldValue, fieldError, handleFieldChange, handleFieldError, fieldName]);

  return {
    fieldProps,
    renderCount: renderCount.current,
    hasChanged: previousValue.current !== fieldValue
  };
}

/**
 * Hook for optimizing list rendering with virtualization support
 */
export function useListOptimization<T>(
  items: T[],
  itemHeight: number = 50,
  containerHeight: number = 400
) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [items, visibleRange.startIndex, visibleRange.endIndex]);

  // Scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  // Calculate total height and offset
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  return {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    visibleRange
  };
}

/**
 * Hook for optimizing modal rendering
 * Prevents unnecessary re-renders when modal is closed
 */
export function useModalOptimization(isOpen: boolean) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      // Delay unmounting to allow exit animations
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimating(false);
      }, 300); // Animation duration

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return {
    shouldRender,
    isAnimating,
    modalProps: {
      'data-state': isOpen ? 'open' : 'closed',
      'data-animating': isAnimating
    }
  };
}

/**
 * Hook for debouncing expensive operations
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttling frequent operations
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

/**
 * Component wrapper for lazy loading
 */
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback: ReactNode = null
) {
  return memo((props: P) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      if (elementRef.current) {
        observer.observe(elementRef.current);
      }

      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (isInView && !isLoaded) {
        // Simulate component loading
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
      }
    }, [isInView, isLoaded]);

    return (
      <div ref={elementRef}>
        {isLoaded ? <Component {...props} /> : fallback}
      </div>
    );
  });
}

/**
 * Performance monitoring wrapper for components
 */
export function withPerformanceMonitoring<P extends object>(
  Component: ComponentType<P>,
  componentName: string
) {
  return memo((props: P) => {
    const { renderCount } = useRenderPerformance(componentName);
    
    // Log excessive re-renders in development
    useEffect(() => {
      if (process.env.NODE_ENV === 'development' && renderCount > 10) {
        console.warn(
          `Component ${componentName} has rendered ${renderCount} times. Consider optimization.`
        );
      }
    }, [renderCount]);

    return <Component {...props} />;
  });
}