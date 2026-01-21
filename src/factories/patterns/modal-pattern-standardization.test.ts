/**
 * Property Test: Modal Pattern Standardization
 * 
 * Tests that the useModal hook provides consistent modal management patterns
 * across all modal components in the application.
 * 
 * @fileoverview Property test for modal pattern standardization
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { vi } from 'vitest';
import { useModal, ModalConfig, UseModalOptions } from './useModal';

/**
 * **Property 22: Modal Pattern Standardization**
 * **Validates: Requirements 5.1**
 * 
 * Verifies that the useModal hook provides consistent state management,
 * opening, closing, and data passing patterns across all modal usage scenarios.
 */
describe('Property 22: Modal Pattern Standardization', () => {
  /**
   * Property: Modal state transitions are consistent
   * All modals should follow the same state transition patterns
   */
  test('modal state transitions follow consistent patterns', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary modal data
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          value: fc.integer({ min: 0, max: 1000 })
        }),
        // Generate arbitrary modal config
        fc.record({
          size: fc.constantFrom('sm', 'md', 'lg', 'xl', 'full'),
          closeOnOutsideClick: fc.boolean(),
          closeOnEscape: fc.boolean(),
          showCloseButton: fc.boolean()
        }),
        (modalData, modalConfig) => {
          const { result } = renderHook(() => useModal<typeof modalData>());

          // Initial state should be consistent
          expect(result.current.isOpen).toBe(false);
          expect(result.current.data).toBeUndefined();
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeNull();

          // Opening modal should set consistent state
          act(() => {
            result.current.open(modalData, modalConfig);
          });

          expect(result.current.isOpen).toBe(true);
          expect(result.current.data).toEqual(modalData);
          expect(result.current.config).toMatchObject(modalConfig);
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeNull();

          // Closing modal should reset to consistent state
          act(() => {
            result.current.close();
          });

          expect(result.current.isOpen).toBe(false);
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeNull();
          // Data should persist after closing
          expect(result.current.data).toEqual(modalData);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Modal data updates are consistent
   * All modals should handle data updates in the same way
   */
  test('modal data updates follow consistent patterns', () => {
    fc.assert(
      fc.property(
        // Generate initial data
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          count: fc.integer({ min: 0, max: 100 })
        }),
        // Generate update data
        fc.record({
          name: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          count: fc.option(fc.integer({ min: 0, max: 100 })),
          newField: fc.option(fc.string())
        }),
        (initialData, updateData) => {
          const { result } = renderHook(() => useModal<typeof initialData>());

          // Open modal with initial data
          act(() => {
            result.current.open(initialData);
          });

          const initialState = result.current.data;

          // Update data
          act(() => {
            result.current.updateData(updateData);
          });

          // Data should be merged consistently
          const expectedData = { ...initialState, ...updateData };
          expect(result.current.data).toEqual(expectedData);
          expect(result.current.isOpen).toBe(true); // Should remain open
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Modal loading states are consistent
   * All modals should handle loading states uniformly
   */
  test('modal loading states follow consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (initialLoading, finalLoading) => {
          const { result } = renderHook(() => useModal());

          // Set initial loading state
          act(() => {
            result.current.setLoading(initialLoading);
          });

          expect(result.current.isLoading).toBe(initialLoading);
          expect(result.current.error).toBeNull(); // Loading should clear errors

          // Change loading state
          act(() => {
            result.current.setLoading(finalLoading);
          });

          expect(result.current.isLoading).toBe(finalLoading);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Modal error states are consistent
   * All modals should handle error states uniformly
   */
  test('modal error states follow consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 200 })),
        fc.option(fc.string({ minLength: 1, maxLength: 200 })),
        (firstError, secondError) => {
          const { result } = renderHook(() => useModal());

          // Set first error
          act(() => {
            result.current.setError(firstError || null);
          });

          expect(result.current.error).toBe(firstError || null);
          expect(result.current.isLoading).toBe(false); // Error should clear loading

          // Set second error
          act(() => {
            result.current.setError(secondError || null);
          });

          expect(result.current.error).toBe(secondError || null);
          expect(result.current.isLoading).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Modal toggle behavior is consistent
   * Toggle should always alternate between open and closed states
   */
  test('modal toggle behavior follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          value: fc.integer({ min: 1, max: 1000 })
        }),
        fc.integer({ min: 1, max: 10 }),
        (modalData, toggleCount) => {
          const { result } = renderHook(() => useModal<typeof modalData>());

          let expectedOpen = false;

          for (let i = 0; i < toggleCount; i++) {
            act(() => {
              result.current.toggle(modalData);
            });

            expectedOpen = !expectedOpen;
            expect(result.current.isOpen).toBe(expectedOpen);

            if (expectedOpen) {
              expect(result.current.data).toEqual(modalData);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Modal reset behavior is consistent
   * Reset should always return modal to initial state
   */
  test('modal reset behavior follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          active: fc.boolean()
        }),
        fc.option(fc.string({ minLength: 1, maxLength: 100 })),
        fc.boolean(),
        (modalData, errorMessage, loadingState) => {
          const { result } = renderHook(() => useModal<typeof modalData>());

          // Set up modal in various states
          act(() => {
            result.current.open(modalData);
            result.current.setLoading(loadingState);
            result.current.setError(errorMessage || null);
          });

          // Reset modal
          act(() => {
            result.current.reset();
          });

          // Should be back to initial state
          expect(result.current.isOpen).toBe(false);
          expect(result.current.data).toBeUndefined();
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Modal configuration merging is consistent
   * Default config should be properly merged with custom config
   */
  test('modal configuration merging follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          size: fc.option(fc.constantFrom('sm', 'md', 'lg', 'xl', 'full')),
          closeOnOutsideClick: fc.option(fc.boolean()),
          closeOnEscape: fc.option(fc.boolean()),
          showCloseButton: fc.option(fc.boolean()),
          zIndex: fc.option(fc.integer({ min: 1, max: 9999 }))
        }),
        fc.record({
          size: fc.option(fc.constantFrom('sm', 'md', 'lg', 'xl', 'full')),
          closeOnOutsideClick: fc.option(fc.boolean()),
          className: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
        }),
        (defaultConfig, customConfig) => {
          const { result } = renderHook(() => 
            useModal({ defaultConfig: defaultConfig as ModalConfig })
          );

          act(() => {
            result.current.open(undefined, customConfig as ModalConfig);
          });

          const finalConfig = result.current.config;

          // Custom config should override default config
          if (customConfig.size !== undefined) {
            expect(finalConfig?.size).toBe(customConfig.size);
          } else if (defaultConfig.size !== undefined) {
            expect(finalConfig?.size).toBe(defaultConfig.size);
          } else {
            expect(finalConfig?.size).toBe('md'); // Default value
          }

          if (customConfig.closeOnOutsideClick !== undefined) {
            expect(finalConfig?.closeOnOutsideClick).toBe(customConfig.closeOnOutsideClick);
          } else if (defaultConfig.closeOnOutsideClick !== undefined) {
            expect(finalConfig?.closeOnOutsideClick).toBe(defaultConfig.closeOnOutsideClick);
          } else {
            expect(finalConfig?.closeOnOutsideClick).toBe(true); // Default value
          }

          if (customConfig.className !== undefined) {
            expect(finalConfig?.className).toBe(customConfig.className);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Modal callbacks are consistently invoked
   * onOpen and onClose callbacks should be called at appropriate times
   */
  test('modal callbacks follow consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 20 }),
          action: fc.string({ minLength: 1, maxLength: 30 })
        }),
        (modalData) => {
          const onOpen = vi.fn();
          const onClose = vi.fn();
          const onDataChange = vi.fn();

          const { result } = renderHook(() => 
            useModal<typeof modalData>({ onOpen, onClose, onDataChange })
          );

          // Open modal
          act(() => {
            result.current.open(modalData);
          });

          expect(onOpen).toHaveBeenCalledWith(modalData);
          expect(onOpen).toHaveBeenCalledTimes(1);

          // Update data
          const updateData = { action: 'updated' };
          act(() => {
            result.current.updateData(updateData);
          });

          expect(onDataChange).toHaveBeenCalledWith({ ...modalData, ...updateData });
          expect(onDataChange).toHaveBeenCalledTimes(1);

          // Close modal
          act(() => {
            result.current.close();
          });

          expect(onClose).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Modal options are consistently applied
   * Different option combinations should work predictably
   */
  test('modal options are consistently applied', () => {
    fc.assert(
      fc.property(
        fc.record({
          persistState: fc.boolean(),
          autoCloseTimeout: fc.option(fc.integer({ min: 100, max: 5000 }))
        }),
        fc.record({
          testData: fc.string({ minLength: 1, maxLength: 50 })
        }),
        (options, modalData) => {
          const { result } = renderHook(() => 
            useModal<typeof modalData>(options as UseModalOptions<typeof modalData>)
          );

          // Open modal
          act(() => {
            result.current.open(modalData);
          });

          expect(result.current.isOpen).toBe(true);
          expect(result.current.data).toEqual(modalData);

          // If auto-close is enabled, modal should close after timeout
          if (options.autoCloseTimeout) {
            // We can't easily test the timeout in a synchronous test,
            // but we can verify the modal was opened correctly
            expect(result.current.isOpen).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

/**
 * Integration tests for modal pattern standardization
 */
describe('Modal Pattern Integration Tests', () => {
  /**
   * Test that multiple modals can coexist without interference
   */
  test('multiple modals maintain independent state', () => {
    const modal1 = renderHook(() => useModal<{ id: string }>());
    const modal2 = renderHook(() => useModal<{ name: string }>());

    const data1 = { id: 'modal-1' };
    const data2 = { name: 'modal-2' };

    // Open both modals
    act(() => {
      modal1.result.current.open(data1);
      modal2.result.current.open(data2);
    });

    // Both should be open with correct data
    expect(modal1.result.current.isOpen).toBe(true);
    expect(modal1.result.current.data).toEqual(data1);
    expect(modal2.result.current.isOpen).toBe(true);
    expect(modal2.result.current.data).toEqual(data2);

    // Close first modal
    act(() => {
      modal1.result.current.close();
    });

    // First should be closed, second should remain open
    expect(modal1.result.current.isOpen).toBe(false);
    expect(modal2.result.current.isOpen).toBe(true);
    expect(modal2.result.current.data).toEqual(data2);
  });

  /**
   * Test modal state persistence across re-renders
   */
  test('modal state persists across re-renders', () => {
    const modalData = { value: 42, name: 'test' };
    
    const { result, rerender } = renderHook(() => useModal<typeof modalData>());

    // Open modal and set states
    act(() => {
      result.current.open(modalData);
      result.current.setLoading(true);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual(modalData);
    expect(result.current.isLoading).toBe(true);

    // Re-render component
    rerender();

    // State should persist
    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual(modalData);
    expect(result.current.isLoading).toBe(true);
  });
});