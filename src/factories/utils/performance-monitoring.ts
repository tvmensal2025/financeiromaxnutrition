/**
 * Performance monitoring utilities for factory systems
 * Provides hooks and utilities to measure critical operation performance
 * and compare before/after refactoring metrics
 */

import { useCallback, useRef, useState, useEffect } from 'react';

export interface PerformanceMetrics {
  operationName: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceComparison {
  before: PerformanceMetrics[];
  after: PerformanceMetrics[];
  improvement: number; // percentage improvement (positive = better)
  averageBefore: number;
  averageAfter: number;
}

// Global performance store for collecting metrics
class PerformanceStore {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private listeners: Set<(metrics: PerformanceMetrics) => void> = new Set();

  addMetric(metric: PerformanceMetrics) {
    const key = metric.operationName;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const operationMetrics = this.metrics.get(key)!;
    operationMetrics.push(metric);
    
    // Keep only last 100 metrics per operation to prevent memory leaks
    if (operationMetrics.length > 100) {
      operationMetrics.shift();
    }
    
    // Notify listeners
    this.listeners.forEach(listener => listener(metric));
  }

  getMetrics(operationName: string): PerformanceMetrics[] {
    return this.metrics.get(operationName) || [];
  }

  getAllMetrics(): Map<string, PerformanceMetrics[]> {
    return new Map(this.metrics);
  }

  subscribe(listener: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(operationName?: string) {
    if (operationName) {
      this.metrics.delete(operationName);
    } else {
      this.metrics.clear();
    }
  }

  comparePerformance(
    operationName: string,
    beforeTag: string,
    afterTag: string
  ): PerformanceComparison | null {
    const allMetrics = this.getMetrics(operationName);
    
    const before = allMetrics.filter(m => m.metadata?.tag === beforeTag);
    const after = allMetrics.filter(m => m.metadata?.tag === afterTag);
    
    if (before.length === 0 || after.length === 0) {
      return null;
    }
    
    const averageBefore = before.reduce((sum, m) => sum + m.duration, 0) / before.length;
    const averageAfter = after.reduce((sum, m) => sum + m.duration, 0) / after.length;
    
    const improvement = ((averageBefore - averageAfter) / averageBefore) * 100;
    
    return {
      before,
      after,
      improvement,
      averageBefore,
      averageAfter
    };
  }
}

export const performanceStore = new PerformanceStore();

/**
 * Hook for measuring operation performance
 * Usage:
 * const measurePerformance = usePerformanceMonitor('crud-operation');
 * const result = await measurePerformance(() => createEntity(data));
 */
export function usePerformanceMonitor(operationName: string) {
  const measure = useCallback(
    async <T>(
      operation: () => Promise<T> | T,
      metadata?: Record<string, any>
    ): Promise<T> => {
      const startTime = performance.now();
      
      try {
        const result = await operation();
        const endTime = performance.now();
        
        performanceStore.addMetric({
          operationName,
          duration: endTime - startTime,
          timestamp: Date.now(),
          metadata
        });
        
        return result;
      } catch (error) {
        const endTime = performance.now();
        
        performanceStore.addMetric({
          operationName,
          duration: endTime - startTime,
          timestamp: Date.now(),
          metadata: { ...metadata, error: true }
        });
        
        throw error;
      }
    },
    [operationName]
  );

  return measure;
}

/**
 * Hook for tracking component render performance
 * Usage:
 * const renderMetrics = useRenderPerformance('MyComponent');
 */
export function useRenderPerformance(componentName: string) {
  const renderCountRef = useRef(0);
  const renderStartTimeRef = useRef<number>(performance.now());

  // Increment render count on every render
  renderCountRef.current += 1;

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTimeRef.current;
    
    performanceStore.addMetric({
      operationName: `render-${componentName}`,
      duration: renderDuration,
      timestamp: Date.now(),
      metadata: { renderCount: renderCountRef.current }
    });
    
    // Reset start time for next render
    renderStartTimeRef.current = performance.now();
  });

  return { renderCount: renderCountRef.current };
}

/**
 * Hook for comparing performance before and after refactoring
 * Usage:
 * const comparison = usePerformanceComparison('crud-operation', 'before', 'after');
 */
export function usePerformanceComparison(
  operationName: string,
  beforeTag: string,
  afterTag: string
) {
  const [comparison, setComparison] = useState<PerformanceComparison | null>(null);

  useEffect(() => {
    const updateComparison = () => {
      const newComparison = performanceStore.comparePerformance(
        operationName,
        beforeTag,
        afterTag
      );
      setComparison(newComparison);
    };

    // Initial comparison
    updateComparison();

    // Subscribe to updates
    const unsubscribe = performanceStore.subscribe(() => {
      updateComparison();
    });

    return unsubscribe;
  }, [operationName, beforeTag, afterTag]);

  return comparison;
}

/**
 * Hook for getting real-time performance metrics
 * Usage:
 * const metrics = usePerformanceMetrics('crud-operation');
 */
export function usePerformanceMetrics(operationName?: string) {
  const [metrics, setMetrics] = useState<Map<string, PerformanceMetrics[]>>(
    new Map()
  );

  useEffect(() => {
    const updateMetrics = () => {
      if (operationName) {
        const operationMetrics = performanceStore.getMetrics(operationName);
        setMetrics(new Map([[operationName, operationMetrics]]));
      } else {
        setMetrics(performanceStore.getAllMetrics());
      }
    };

    // Initial load
    updateMetrics();

    // Subscribe to updates
    const unsubscribe = performanceStore.subscribe(() => {
      updateMetrics();
    });

    return unsubscribe;
  }, [operationName]);

  return metrics;
}

/**
 * Utility for measuring synchronous operations
 */
export function measureSync<T>(
  operationName: string,
  operation: () => T,
  metadata?: Record<string, any>
): T {
  const startTime = performance.now();
  
  try {
    const result = operation();
    const endTime = performance.now();
    
    performanceStore.addMetric({
      operationName,
      duration: endTime - startTime,
      timestamp: Date.now(),
      metadata
    });
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    
    performanceStore.addMetric({
      operationName,
      duration: endTime - startTime,
      timestamp: Date.now(),
      metadata: { ...metadata, error: true }
    });
    
    throw error;
  }
}

/**
 * Utility for measuring async operations
 */
export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const endTime = performance.now();
    
    performanceStore.addMetric({
      operationName,
      duration: endTime - startTime,
      timestamp: Date.now(),
      metadata
    });
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    
    performanceStore.addMetric({
      operationName,
      duration: endTime - startTime,
      timestamp: Date.now(),
      metadata: { ...metadata, error: true }
    });
    
    throw error;
  }
}

/**
 * Performance monitoring decorator for factory functions
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  operationName: string,
  fn: T,
  metadata?: Record<string, any>
): T {
  return ((...args: Parameters<T>) => {
    const startTime = performance.now();
    
    try {
      const result = fn(...args);
      
      // Handle both sync and async results
      if (result && typeof result.then === 'function') {
        return result
          .then((value: any) => {
            const endTime = performance.now();
            performanceStore.addMetric({
              operationName,
              duration: endTime - startTime,
              timestamp: Date.now(),
              metadata
            });
            return value;
          })
          .catch((error: any) => {
            const endTime = performance.now();
            performanceStore.addMetric({
              operationName,
              duration: endTime - startTime,
              timestamp: Date.now(),
              metadata: { ...metadata, error: true }
            });
            throw error;
          });
      } else {
        const endTime = performance.now();
        performanceStore.addMetric({
          operationName,
          duration: endTime - startTime,
          timestamp: Date.now(),
          metadata
        });
        return result;
      }
    } catch (error) {
      const endTime = performance.now();
      performanceStore.addMetric({
        operationName,
        duration: endTime - startTime,
        timestamp: Date.now(),
        metadata: { ...metadata, error: true }
      });
      throw error;
    }
  }) as T;
}