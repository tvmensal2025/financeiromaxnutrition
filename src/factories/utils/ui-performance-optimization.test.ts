/**
 * Tests for UI performance optimization
 * **Property 29: UI Performance Optimization**
 * **Validates: Requirements 7.2**
 * 
 * Tests the performance optimization utilities to ensure they improve
 * rendering performance without breaking functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { 
  useRenderOptimization,
  useFormFieldOptimization,
  useModalOptimization,
  useDebounce,
  useThrottle,
  useListOptimization
} from './ui-performance-optimization.tsx';
import { performanceStore } from './performance-monitoring';
import { defaultTestConfig } from '../../test/fast-check.config';

describe('UI Performance Optimization', () => {
  beforeEach(() => {
    performanceStore.clear();
  });

  afterEach(() => {
    performanceStore.clear();
  });

  describe('Property 29: UI Performance Optimization', () => {
    it('should provide consistent optimization interface', () => {
      const { result, unmount } = renderHook(() => 
        useRenderOptimization('TestComponent', { enableMemoization: true })
      );

      // Should always provide the required interface
      expect(typeof result.current.memoizedValue).toBe('function');
      expect(typeof result.current.memoizedCallback).toBe('function');
      expect(typeof result.current.shouldRender).toBe('function');
      expect(typeof result.current.renderCount).toBe('number');
      expect(result.current.renderCount).toBeGreaterThanOrEqual(0);
      
      unmount();
    });

    it('should optimize form field rendering', () => {
      const { result, unmount } = renderHook(() => 
        useFormFieldOptimization('testField')
      );

      // Test field change
      act(() => {
        result.current.fieldProps.onChange('test value');
      });

      expect(result.current.fieldProps.value).toBe('test value');
      expect(result.current.fieldProps.name).toBe('testField');
      expect(result.current.renderCount).toBeGreaterThan(0);
      
      unmount();
    });

    it('should handle modal optimization lifecycle', () => {
      const { result, rerender, unmount } = renderHook(
        ({ isOpen }) => useModalOptimization(isOpen),
        { initialProps: { isOpen: false } }
      );

      // Initially closed
      expect(result.current.modalProps['data-state']).toBe('closed');

      // Open modal
      rerender({ isOpen: true });
      expect(result.current.shouldRender).toBe(true);
      expect(result.current.modalProps['data-state']).toBe('open');

      // Close modal
      rerender({ isOpen: false });
      expect(result.current.modalProps['data-state']).toBe('closed');
      
      unmount();
    });

    it('should debounce values correctly', async () => {
      const { result, rerender, unmount } = renderHook(
        ({ value }) => useDebounce(value, 100),
        { initialProps: { value: 'initial' } }
      );

      // Initial value should be set immediately
      expect(result.current).toBe('initial');

      // Change value rapidly
      rerender({ value: 'changed1' });
      rerender({ value: 'changed2' });
      rerender({ value: 'final' });

      // Should still have the initial value (debounced)
      expect(result.current).toBe('initial');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should now have the final value
      expect(result.current).toBe('final');
      
      unmount();
    });

    it('should optimize list rendering with virtualization', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        value: i
      }));

      const { result, unmount } = renderHook(() => 
        useListOptimization(items, 50, 300)
      );

      // Should calculate visible range correctly
      expect(result.current.visibleRange.startIndex).toBeGreaterThanOrEqual(0);
      expect(result.current.visibleRange.endIndex).toBeLessThanOrEqual(items.length);
      expect(result.current.visibleRange.startIndex).toBeLessThanOrEqual(result.current.visibleRange.endIndex);

      // Should provide visible items
      expect(result.current.visibleItems.length).toBeGreaterThan(0);
      expect(result.current.visibleItems.length).toBeLessThanOrEqual(items.length);

      // Should calculate total height correctly
      expect(result.current.totalHeight).toBe(items.length * 50);

      // Should provide scroll handler
      expect(typeof result.current.handleScroll).toBe('function');
      
      unmount();
    });

    it('should maintain performance under operations', () => {
      const { result, rerender, unmount } = renderHook(() => 
        useRenderOptimization('TestComponent', { enableMemoization: true })
      );

      const startTime = performance.now();

      // Simulate operations
      for (let i = 0; i < 10; i++) {
        rerender();
        
        // Use memoization features
        result.current.memoizedValue(i, [i]);
        result.current.memoizedCallback(() => i, [i]);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(100); // 100ms for 10 operations
      expect(result.current.renderCount).toBeGreaterThan(0);
      
      unmount();
    });

    /**
     * Property Test: Form field rendering should maintain responsive performance
     * regardless of field value changes
     * 
     * Validates Requirement 7.2: "WHEN rendering forms and dialogs, 
     * THE system SHALL optimize re-renders and maintain responsive user interactions"
     */
    it('property: form field rendering maintains responsive performance with arbitrary inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ maxLength: 50 }), { minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          async (fieldValues, fieldName) => {
            const startTime = performance.now();
            
            const { result, rerender, unmount } = renderHook(() => 
              useFormFieldOptimization(fieldName)
            );

            // Simulate rapid field changes
            for (const value of fieldValues) {
              act(() => {
                result.current.fieldProps.onChange(value);
              });
              rerender();
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Performance requirement: should handle all changes within reasonable time
            // Max 5ms per field change on average
            const maxDuration = fieldValues.length * 5;
            expect(duration).toBeLessThan(maxDuration);

            // Should maintain correct final value
            expect(result.current.fieldProps.value).toBe(fieldValues[fieldValues.length - 1]);
            
            // Should track field name correctly
            expect(result.current.fieldProps.name).toBe(fieldName);
            
            // Should have reasonable render count (not excessive re-renders)
            expect(result.current.renderCount).toBeLessThanOrEqual(fieldValues.length + 2);

            unmount();
            return true;
          }
        ),
        { numRuns: 30, timeout: 5000 }
      );
    });

    /**
     * Property Test: List virtualization should efficiently handle arbitrary dataset sizes
     * 
     * Validates Requirement 7.2: "WHEN rendering forms and dialogs, 
     * THE system SHALL optimize re-renders and maintain responsive user interactions"
     */
    it('property: list virtualization maintains performance with arbitrary dataset sizes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 1000 }),
          fc.integer({ min: 20, max: 100 }),
          fc.integer({ min: 200, max: 600 }),
          async (itemCount, itemHeight, containerHeight) => {
            // Generate test items
            const items = Array.from({ length: itemCount }, (_, i) => ({
              id: `item-${i}`,
              name: `Item ${i}`,
              value: i
            }));

            const startTime = performance.now();

            const { result, unmount } = renderHook(() => 
              useListOptimization(items, itemHeight, containerHeight)
            );

            const endTime = performance.now();
            const initDuration = endTime - startTime;

            // Initialization should be fast regardless of dataset size
            expect(initDuration).toBeLessThan(50); // 50ms max

            // Visible range should be calculated correctly
            expect(result.current.visibleRange.startIndex).toBeGreaterThanOrEqual(0);
            expect(result.current.visibleRange.endIndex).toBeLessThanOrEqual(itemCount);
            expect(result.current.visibleRange.startIndex).toBeLessThanOrEqual(result.current.visibleRange.endIndex);

            // Should only render visible items (optimization check)
            const maxVisibleItems = Math.ceil(containerHeight / itemHeight) + 2;
            expect(result.current.visibleItems.length).toBeLessThanOrEqual(maxVisibleItems);

            // Total height should be accurate
            expect(result.current.totalHeight).toBe(itemCount * itemHeight);

            // Offset should be correct
            expect(result.current.offsetY).toBe(result.current.visibleRange.startIndex * itemHeight);

            unmount();
            return true;
          }
        ),
        { numRuns: 30, timeout: 5000 }
      );
    });

    /**
     * Property Test: Debounce should consistently delay updates regardless of input frequency
     * 
     * Validates Requirement 7.2: "WHEN rendering forms and dialogs, 
     * THE system SHALL optimize re-renders and maintain responsive user interactions"
     */
    it('property: debounce consistently delays updates with arbitrary input patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ maxLength: 30 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 50, max: 150 }),
          async (values, delay) => {
            const { result, rerender, unmount } = renderHook(
              ({ value }) => useDebounce(value, delay),
              { initialProps: { value: values[0] } }
            );

            // Initial value should be set
            expect(result.current).toBe(values[0]);

            // Rapidly change values
            const changeStartTime = performance.now();
            for (let i = 1; i < values.length; i++) {
              rerender({ value: values[i] });
            }
            const changeEndTime = performance.now();

            // Changes should be fast (not blocked by debounce)
            expect(changeEndTime - changeStartTime).toBeLessThan(50);

            // Should still have initial or intermediate value (debounced)
            const immediateValue = result.current;
            expect([values[0], ...values.slice(0, -1)]).toContain(immediateValue);

            // Wait for debounce to complete
            await new Promise(resolve => setTimeout(resolve, delay + 50));

            // Should now have the final value
            expect(result.current).toBe(values[values.length - 1]);

            unmount();
            return true;
          }
        ),
        { numRuns: 10, timeout: 8000 } // Reduced runs due to async delays
      );
    });

    /**
     * Property Test: Modal optimization should handle arbitrary open/close sequences efficiently
     * 
     * Validates Requirement 7.2: "WHEN rendering forms and dialogs, 
     * THE system SHALL optimize re-renders and maintain responsive user interactions"
     */
    it('property: modal optimization handles arbitrary open/close sequences efficiently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 15 }),
          async (openStates) => {
            const startTime = performance.now();

            const { result, rerender, unmount } = renderHook(
              ({ isOpen }) => useModalOptimization(isOpen),
              { initialProps: { isOpen: openStates[0] } }
            );

            // Process all state changes
            for (let i = 1; i < openStates.length; i++) {
              rerender({ isOpen: openStates[i] });
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should handle all state changes efficiently
            expect(duration).toBeLessThan(openStates.length * 2); // 2ms per state change max

            // Final state should match last input
            const finalState = openStates[openStates.length - 1];
            expect(result.current.modalProps['data-state']).toBe(finalState ? 'open' : 'closed');

            // Should render logic should be consistent
            if (finalState) {
              expect(result.current.shouldRender).toBe(true);
            }

            unmount();
            return true;
          }
        ),
        { numRuns: 30, timeout: 5000 }
      );
    });

    /**
     * Property Test: Render optimization should not introduce overhead compared to unoptimized rendering
     * 
     * Validates Requirement 7.1: "WHEN using generic factories, 
     * THE system SHALL not introduce performance overhead compared to current implementations"
     */
    it('property: render optimization does not introduce significant overhead', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: 5, max: 25 }),
          fc.record({
            enableMemoization: fc.boolean(),
            enableCallbackMemoization: fc.boolean(),
            enableValueMemoization: fc.boolean(),
            enableRenderTracking: fc.boolean()
          }),
          async (componentName, rerenderCount, config) => {
            const startTime = performance.now();

            const { result, rerender, unmount } = renderHook(() => 
              useRenderOptimization(componentName, config)
            );

            // Simulate multiple re-renders
            for (let i = 0; i < rerenderCount; i++) {
              rerender();
              
              // Use optimization features
              result.current.memoizedValue(i, [i]);
              result.current.memoizedCallback(() => i, [i]);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete efficiently (max 3ms per render cycle)
            expect(duration).toBeLessThan(rerenderCount * 3);

            // Should provide valid interface
            expect(typeof result.current.memoizedValue).toBe('function');
            expect(typeof result.current.memoizedCallback).toBe('function');
            expect(typeof result.current.shouldRender).toBe('function');
            expect(result.current.renderCount).toBeGreaterThanOrEqual(0);

            unmount();
            return true;
          }
        ),
        { numRuns: 30, timeout: 5000 }
      );
    });

    /**
     * Property Test: Throttle should limit update frequency regardless of input rate
     * 
     * Validates Requirement 7.2: "WHEN rendering forms and dialogs, 
     * THE system SHALL optimize re-renders and maintain responsive user interactions"
     */
    it('property: throttle limits update frequency with arbitrary input rates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 5, maxLength: 10 }),
          fc.integer({ min: 50, max: 150 }),
          async (values, throttleLimit) => {
            const { result, rerender, unmount } = renderHook(
              ({ value }) => useThrottle(value, throttleLimit),
              { initialProps: { value: values[0] } }
            );

            const updateTimes: number[] = [performance.now()];
            const throttledValues: number[] = [result.current];

            // Rapidly update values
            for (let i = 1; i < values.length; i++) {
              rerender({ value: values[i] });
              await new Promise(resolve => setTimeout(resolve, 10)); // Small delay between updates
              
              if (result.current !== throttledValues[throttledValues.length - 1]) {
                updateTimes.push(performance.now());
                throttledValues.push(result.current);
              }
            }

            // Check that updates are throttled (not every value triggers update)
            expect(throttledValues.length).toBeLessThanOrEqual(values.length);

            // Check that time between updates respects throttle limit (with tolerance)
            for (let i = 1; i < updateTimes.length; i++) {
              const timeDiff = updateTimes[i] - updateTimes[i - 1];
              // Allow some tolerance for timing variations
              expect(timeDiff).toBeGreaterThanOrEqual(throttleLimit * 0.7);
            }

            unmount();
            return true;
          }
        ),
        { numRuns: 10, timeout: 8000 } // Reduced runs due to async delays
      );
    });

    /**
     * Property Test: shouldRender comparison should be consistent and efficient
     * 
     * Validates Requirement 7.2: "WHEN rendering forms and dialogs, 
     * THE system SHALL optimize re-renders and maintain responsive user interactions"
     */
    it('property: shouldRender comparison is consistent and efficient', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            prop1: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            prop2: fc.oneof(fc.string(), fc.integer(), fc.boolean())
          }),
          fc.record({
            prop1: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            prop2: fc.oneof(fc.string(), fc.integer(), fc.boolean())
          }),
          async (prevProps, nextProps) => {
            const { result, unmount } = renderHook(() => 
              useRenderOptimization('TestComponent', { enableMemoization: true })
            );

            const startTime = performance.now();
            const shouldUpdate = result.current.shouldRender(nextProps, prevProps);
            const endTime = performance.now();

            // Comparison should be very fast
            expect(endTime - startTime).toBeLessThan(1);

            // Should return boolean
            expect(typeof shouldUpdate).toBe('boolean');

            // Should be consistent: same inputs should give same result
            const secondResult = result.current.shouldRender(nextProps, prevProps);
            expect(secondResult).toBe(shouldUpdate);

            // If props are identical, should return false (no re-render needed)
            const identicalResult = result.current.shouldRender(prevProps, prevProps);
            expect(identicalResult).toBe(false);

            unmount();
            return true;
          }
        ),
        { numRuns: 50, timeout: 5000 }
      );
    });
  });
});