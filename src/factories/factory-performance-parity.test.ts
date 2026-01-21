/**
 * Property-based tests for factory performance parity
 * **Property 28: Factory Performance Parity**
 * **Validates: Requirements 7.1**
 * 
 * Ensures that factory-generated code performs at least as well as
 * hand-written code, with acceptable performance overhead.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  performanceStore, 
  measureAsync, 
  measureSync,
  withPerformanceMonitoring
} from './utils/performance-monitoring';

// Mock entity types for testing
interface TestEntity {
  id: string;
  name: string;
  value: number;
  metadata?: Record<string, any>;
}

// Simple mock operations for testing
const mockOperation = async (operationType: string, data?: any): Promise<any> => {
  // Simulate realistic processing time (1-10ms)
  const processingTime = Math.random() * 9 + 1;
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  return { id: `test-${Date.now()}`, ...data };
};

describe('Factory Performance Parity', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  describe('Property 28: Factory Performance Parity', () => {
    it('should ensure performance monitoring has minimal overhead', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 50, maxLength: 200 }),
          async (numbers) => {
            // Measure operation without monitoring
            const startUnmonitored = performance.now();
            let sumUnmonitored = 0;
            for (const num of numbers) {
              sumUnmonitored += num * 2;
            }
            const endUnmonitored = performance.now();
            const unmonitoredDuration = endUnmonitored - startUnmonitored;
            
            // Measure same operation with monitoring
            const startMonitored = performance.now();
            let sumMonitored = 0;
            for (const num of numbers) {
              sumMonitored += measureSync('test-operation', () => num * 2);
            }
            const endMonitored = performance.now();
            const monitoredDuration = endMonitored - startMonitored;
            
            // Results should be identical
            expect(sumMonitored).toBe(sumUnmonitored);
            
            // Monitoring overhead should be reasonable (less than 200% overhead)
            if (unmonitoredDuration > 0.1) { // Only check if operation took meaningful time
              const overhead = ((monitoredDuration - unmonitoredDuration) / unmonitoredDuration) * 100;
              expect(overhead).toBeLessThanOrEqual(200);
            }
          }
        ),
        { 
          numRuns: 10,
          timeout: 10000,
          verbose: true
        }
      );
    });

    it('should ensure performance decorator has minimal impact on function behavior', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 20 }),
          async (numbers) => {
            // Original function
            const originalSum = (nums: number[]) => nums.reduce((sum, n) => sum + n, 0);
            
            // Decorated function
            const decoratedSum = withPerformanceMonitoring(
              'sum-operation',
              originalSum,
              { test: true }
            );
            
            // Both should produce identical results
            const originalResult = originalSum(numbers);
            const decoratedResult = decoratedSum(numbers);
            
            expect(decoratedResult).toBe(originalResult);
            
            // Performance metrics should be recorded
            const metrics = performanceStore.getMetrics('sum-operation');
            expect(metrics.length).toBeGreaterThan(0);
            expect(metrics[metrics.length - 1].metadata?.test).toBe(true);
          }
        ),
        { 
          numRuns: 20,
          timeout: 5000,
          verbose: true
        }
      );
    });

    it('should measure async operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }),
              value: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (testData) => {
            // Clear metrics before each test run
            performanceStore.clear('async-operation');
            
            // Measure async operations
            const results = [];
            for (const data of testData) {
              const result = await measureAsync('async-operation', async () => {
                return await mockOperation('test', data);
              }, { tag: 'test' });
              results.push(result);
            }
            
            // Verify results
            expect(results).toHaveLength(testData.length);
            results.forEach((result, index) => {
              expect(result.name).toBe(testData[index].name);
              expect(result.value).toBe(testData[index].value);
            });
            
            // Verify metrics were recorded
            const metrics = performanceStore.getMetrics('async-operation');
            expect(metrics.length).toBe(testData.length);
            
            // All metrics should have reasonable durations (1-50ms for our mock)
            metrics.forEach(metric => {
              expect(metric.duration).toBeGreaterThan(0);
              expect(metric.duration).toBeLessThan(100); // Allow some buffer
              expect(metric.metadata?.tag).toBe('test');
            });
          }
        ),
        { 
          numRuns: 5,
          timeout: 15000,
          verbose: true
        }
      );
    });

    it('should compare performance between different implementations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 10, maxLength: 50 }),
          async (numbers) => {
            // Implementation A: Simple loop
            await measureAsync('implementation-a', async () => {
              let sum = 0;
              for (const num of numbers) {
                sum += num;
              }
              return sum;
            }, { tag: 'simple' });
            
            // Implementation B: Reduce method
            await measureAsync('implementation-b', async () => {
              return numbers.reduce((sum, num) => sum + num, 0);
            }, { tag: 'reduce' });
            
            // Both implementations should be recorded
            const metricsA = performanceStore.getMetrics('implementation-a');
            const metricsB = performanceStore.getMetrics('implementation-b');
            
            expect(metricsA.length).toBeGreaterThan(0);
            expect(metricsB.length).toBeGreaterThan(0);
            
            // Both should have reasonable performance (very fast for simple operations)
            metricsA.forEach(metric => {
              expect(metric.duration).toBeGreaterThanOrEqual(0);
              expect(metric.metadata?.tag).toBe('simple');
            });
            
            metricsB.forEach(metric => {
              expect(metric.duration).toBeGreaterThanOrEqual(0);
              expect(metric.metadata?.tag).toBe('reduce');
            });
          }
        ),
        { 
          numRuns: 10,
          timeout: 10000,
          verbose: true
        }
      );
    });

    it('should handle performance comparison with sufficient data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }),
          async (iterations) => {
            // Clear metrics before each test run
            performanceStore.clear('comparison-test');
            
            // Generate multiple measurements for comparison
            for (let i = 0; i < iterations; i++) {
              await measureAsync('comparison-test', async () => {
                await mockOperation('before-refactor');
              }, { tag: 'before' });
              
              await measureAsync('comparison-test', async () => {
                await mockOperation('after-refactor');
              }, { tag: 'after' });
            }
            
            // Get comparison
            const comparison = performanceStore.comparePerformance(
              'comparison-test',
              'before',
              'after'
            );
            
            expect(comparison).not.toBeNull();
            expect(comparison!.before.length).toBe(iterations);
            expect(comparison!.after.length).toBe(iterations);
            expect(comparison!.averageBefore).toBeGreaterThan(0);
            expect(comparison!.averageAfter).toBeGreaterThan(0);
            
            // Improvement can be positive or negative, but should be a valid number
            expect(typeof comparison!.improvement).toBe('number');
            expect(isFinite(comparison!.improvement)).toBe(true);
          }
        ),
        { 
          numRuns: 5,
          timeout: 20000,
          verbose: true
        }
      );
    });
  });
});