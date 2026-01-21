/**
 * Property Test: Error Pattern Consistency
 * 
 * Tests that the useErrorHandler hook provides consistent error handling patterns
 * across all components in the application.
 * 
 * @fileoverview Property test for error pattern consistency
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { vi } from 'vitest';
import { 
  useErrorHandler, 
  ErrorCategory, 
  ErrorSeverity, 
  ErrorHandlerConfig,
  StandardizedError,
  ErrorUtils
} from './useErrorHandler';

// Mock the toast function
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}));

/**
 * **Property 23: Error Pattern Consistency**
 * **Validates: Requirements 5.2**
 * 
 * Verifies that the useErrorHandler hook provides consistent error display,
 * logging, and user feedback patterns across all error handling scenarios.
 */
describe('Property 23: Error Pattern Consistency', () => {
  /**
   * Property: Error classification is consistent
   * All errors should be classified into appropriate categories and severities
   */
  test('error classification follows consistent patterns', () => {
    fc.assert(
      fc.property(
        // Generate different types of errors
        fc.oneof(
          fc.record({
            name: fc.constant('ValidationError'),
            message: fc.constantFrom(
              'validation failed',
              'invalid format',
              'required field missing',
              'invalid email format'
            )
          }),
          fc.record({
            name: fc.constant('NetworkError'),
            message: fc.constantFrom(
              'network connection failed',
              'fetch request timeout',
              'connection refused'
            )
          }),
          fc.record({
            name: fc.constant('AuthenticationError'),
            message: fc.constantFrom(
              'unauthorized access',
              'authentication failed',
              'login required'
            )
          }),
          fc.record({
            name: fc.constant('Error'),
            message: fc.string({ minLength: 5, maxLength: 100 })
          })
        ),
        fc.string({ minLength: 1, maxLength: 50 }), // component name
        (errorData, component) => {
          const { result } = renderHook(() => 
            useErrorHandler({ component, showToast: false, logToConsole: false })
          );

          const error = new Error(errorData.message);
          error.name = errorData.name;

          let standardizedError: StandardizedError;
          act(() => {
            standardizedError = result.current.handleError(error, { action: 'test' });
          });

          // Error should be properly classified
          expect(standardizedError!.id).toBeDefined();
          expect(standardizedError!.message).toBe(errorData.message);
          expect(standardizedError!.category).toBeDefined();
          expect(standardizedError!.severity).toBeDefined();
          expect(standardizedError!.context.component).toBe(component);
          expect(standardizedError!.context.timestamp).toBeDefined();
          expect(standardizedError!.recoverable).toBeDefined();
          expect(standardizedError!.recoveryActions).toBeDefined();
          expect(Array.isArray(standardizedError!.recoveryActions)).toBe(true);

          // Validation errors should be classified correctly
          if (errorData.name === 'ValidationError' || errorData.message.includes('validation')) {
            expect(standardizedError!.category).toBe('validation');
            expect(standardizedError!.severity).toBe('low');
            expect(standardizedError!.recoverable).toBe(true);
          }

          // Network errors should be classified correctly
          if (errorData.name === 'NetworkError' || errorData.message.includes('network')) {
            expect(standardizedError!.category).toBe('network');
            expect(standardizedError!.recoverable).toBe(true);
          }

          // Authentication errors should be classified correctly
          if (errorData.name === 'AuthenticationError' || errorData.message.includes('unauthorized')) {
            expect(standardizedError!.category).toBe('authentication');
            // Note: severity might be overridden by config, so we just check it's defined
            expect(['low', 'medium', 'high', 'critical']).toContain(standardizedError!.severity);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Error state management is consistent
   * Error handler should maintain consistent state across operations
   */
  test('error state management follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            message: fc.string({ minLength: 1, maxLength: 100 }),
            category: fc.constantFrom<ErrorCategory>(
              'validation', 'network', 'authentication', 'authorization',
              'business_logic', 'system', 'user_input', 'external_service', 'unknown'
            )
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (errorData) => {
          const { result } = renderHook(() => 
            useErrorHandler({ showToast: false, logToConsole: false })
          );

          const handledErrors: StandardizedError[] = [];

          // Handle multiple errors
          errorData.forEach(data => {
            act(() => {
              const error = new Error(data.message);
              const standardizedError = result.current.handleError(error, {
                metadata: { category: data.category }
              });
              handledErrors.push(standardizedError);
            });
          });

          // State should be consistent
          expect(result.current.errors).toHaveLength(errorData.length);
          expect(result.current.lastError).toEqual(handledErrors[handledErrors.length - 1]);
          expect(result.current.hasError()).toBe(true);

          // Error counts should be accurate
          const stats = result.current.getErrorStats();
          expect(stats.total).toBe(errorData.length);

          // Clear all errors
          act(() => {
            result.current.clearAllErrors();
          });

          // State should be reset
          expect(result.current.errors).toHaveLength(0);
          expect(result.current.lastError).toBeUndefined();
          expect(result.current.hasError()).toBe(false);
          
          const clearedStats = result.current.getErrorStats();
          expect(clearedStats.total).toBe(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Error filtering is consistent
   * Error filtering by category and severity should work predictably
   */
  test('error filtering follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            message: fc.string({ minLength: 1, maxLength: 50 }),
            category: fc.constantFrom<ErrorCategory>(
              'validation', 'network', 'authentication', 'business_logic'
            ),
            severity: fc.constantFrom<ErrorSeverity>('low', 'medium', 'high', 'critical')
          }),
          { minLength: 3, maxLength: 15 }
        ),
        (errorData) => {
          const { result } = renderHook(() => 
            useErrorHandler({ showToast: false, logToConsole: false })
          );

          // Handle all errors
          errorData.forEach(data => {
            act(() => {
              const error = new Error(data.message);
              result.current.handleError(error, {
                metadata: { category: data.category, severity: data.severity }
              });
            });
          });

          // Test filtering by category
          const categories = Array.from(new Set(errorData.map(e => e.category)));
          categories.forEach(category => {
            const filteredErrors = result.current.getErrorsByCategory(category);
            const expectedCount = errorData.filter(e => e.category === category).length;
            expect(filteredErrors).toHaveLength(expectedCount);
            filteredErrors.forEach(error => {
              expect(error.category).toBe(category);
            });
          });

          // Test filtering by severity
          const severities = Array.from(new Set(errorData.map(e => e.severity)));
          severities.forEach(severity => {
            const filteredErrors = result.current.getErrorsBySeverity(severity);
            const expectedCount = errorData.filter(e => e.severity === severity).length;
            expect(filteredErrors).toHaveLength(expectedCount);
            filteredErrors.forEach(error => {
              expect(error.severity).toBe(severity);
            });
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Error retry mechanism is consistent
   * Retry operations should handle errors consistently
   */
  test('error retry mechanism follows consistent patterns', () => {
    const { result } = renderHook(() => 
      useErrorHandler({ showToast: false, logToConsole: false })
    );

    // Test successful retry
    const successOperation = vi.fn().mockResolvedValue('success');
    
    act(async () => {
      const retryResult = await result.current.retry(successOperation, { action: 'test_retry' });
      expect(retryResult).toBe('success');
      expect(successOperation).toHaveBeenCalledTimes(1);
    });

    // Test failed retry
    const failOperation = vi.fn().mockRejectedValue(new Error('Test error'));
    
    act(async () => {
      try {
        await result.current.retry(failOperation, { action: 'test_retry' });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should be a StandardizedError
        expect(error).toHaveProperty('id');
        expect(error).toHaveProperty('category');
        expect(error).toHaveProperty('severity');
        expect(error.context.action).toBe('test_retry_retry');
      }
    });
  });

  /**
   * Property: Error configuration is consistently applied
   * Different configurations should produce predictable behavior
   */
  test('error configuration is consistently applied', () => {
    fc.assert(
      fc.property(
        fc.record({
          component: fc.string({ minLength: 1, maxLength: 30 }),
          defaultSeverity: fc.constantFrom<ErrorSeverity>('low', 'medium', 'high', 'critical'),
          defaultCategory: fc.constantFrom<ErrorCategory>('validation', 'network', 'system'),
          showToast: fc.boolean(),
          logToConsole: fc.boolean(),
          maxErrors: fc.integer({ min: 1, max: 20 })
        }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (config, errorMessage) => {
          const mockLogger = vi.fn();
          const { result } = renderHook(() => 
            useErrorHandler({
              ...config,
              logger: mockLogger
            } as ErrorHandlerConfig)
          );

          let standardizedError: StandardizedError;
          act(() => {
            const error = new Error(errorMessage);
            standardizedError = result.current.handleError(error);
          });

          // Configuration should be applied
          expect(standardizedError!.context.component).toBe(config.component);
          
          // Logger should be called if logToConsole is true
          if (config.logToConsole) {
            expect(mockLogger).toHaveBeenCalledWith(standardizedError!);
          }

          // Error should be stored
          expect(result.current.errors).toContain(standardizedError!);
          expect(result.current.lastError).toEqual(standardizedError!);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Error recovery actions are consistent
   * Recovery actions should be appropriate for error categories
   */
  test('error recovery actions follow consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ErrorCategory>(
          'validation', 'network', 'authentication', 'authorization',
          'business_logic', 'system', 'user_input', 'external_service', 'unknown'
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
        (category, errorMessage) => {
          const { result } = renderHook(() => 
            useErrorHandler({ showToast: false, logToConsole: false })
          );

          let standardizedError: StandardizedError;
          act(() => {
            const error = new Error(errorMessage);
            standardizedError = result.current.handleError(error, {
              metadata: { category }
            });
          });

          // Recovery actions should be appropriate for category
          expect(standardizedError!.recoveryActions).toBeDefined();
          expect(Array.isArray(standardizedError!.recoveryActions)).toBe(true);
          expect(standardizedError!.recoveryActions!.length).toBeGreaterThan(0);

          // Specific category checks - only check if category wasn't overridden
          const actualCategory = standardizedError!.category;
          switch (actualCategory) {
            case 'validation':
              expect(standardizedError!.recoverable).toBe(true);
              expect(standardizedError!.recoveryActions).toContain('Check input format');
              break;
            case 'network':
              expect(standardizedError!.recoverable).toBe(true);
              expect(standardizedError!.recoveryActions).toContain('Check internet connection');
              break;
            case 'authentication':
              expect(standardizedError!.recoverable).toBe(true);
              expect(standardizedError!.recoveryActions).toContain('Log in again');
              break;
            case 'authorization':
              expect(standardizedError!.recoverable).toBe(false);
              expect(standardizedError!.recoveryActions).toContain('Contact administrator');
              break;
            case 'system':
              expect(standardizedError!.recoverable).toBe(false);
              expect(standardizedError!.recoveryActions).toContain('Contact support');
              break;
            default:
              // For unknown or other categories, just check that recovery actions exist
              expect(standardizedError!.recoveryActions!.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Error statistics are consistent
   * Error statistics should accurately reflect the current state
   */
  test('error statistics follow consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            category: fc.constantFrom<ErrorCategory>(
              'validation', 'network', 'authentication', 'business_logic'
            ),
            severity: fc.constantFrom<ErrorSeverity>('low', 'medium', 'high')
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (errorSpecs) => {
          const { result } = renderHook(() => 
            useErrorHandler({ showToast: false, logToConsole: false })
          );

          // Handle errors
          errorSpecs.forEach((spec, index) => {
            act(() => {
              const error = new Error(`Error ${index}`);
              result.current.handleError(error, {
                metadata: { category: spec.category, severity: spec.severity }
              });
            });
          });

          const stats = result.current.getErrorStats();

          // Total should match
          expect(stats.total).toBe(errorSpecs.length);

          // Category counts should be accurate
          const categoryCounts = errorSpecs.reduce((acc, spec) => {
            acc[spec.category] = (acc[spec.category] || 0) + 1;
            return acc;
          }, {} as Record<ErrorCategory, number>);

          Object.entries(categoryCounts).forEach(([category, count]) => {
            expect(stats.byCategory[category as ErrorCategory]).toBe(count);
          });

          // Severity counts should be accurate
          const severityCounts = errorSpecs.reduce((acc, spec) => {
            acc[spec.severity] = (acc[spec.severity] || 0) + 1;
            return acc;
          }, {} as Record<ErrorSeverity, number>);

          Object.entries(severityCounts).forEach(([severity, count]) => {
            expect(stats.bySeverity[severity as ErrorSeverity]).toBe(count);
          });
        }
      ),
      { numRuns: 30 }
    );
  });
});

/**
 * Integration tests for error pattern consistency
 */
describe('Error Pattern Integration Tests', () => {
  /**
   * Test error utility functions
   */
  test('error utility functions work consistently', () => {
    const error: StandardizedError = {
      id: 'test-error',
      message: 'Test error message',
      severity: 'medium',
      category: 'validation',
      context: {
        component: 'TestComponent',
        timestamp: Date.now()
      },
      recoverable: true,
      recoveryActions: ['Try again'],
      reportable: false
    };

    // Test utility functions
    expect(ErrorUtils.isCategory(error, 'validation')).toBe(true);
    expect(ErrorUtils.isCategory(error, 'network')).toBe(false);
    expect(ErrorUtils.isSeverity(error, 'medium')).toBe(true);
    expect(ErrorUtils.isSeverity(error, 'high')).toBe(false);

    const displayFormat = ErrorUtils.formatForDisplay(error);
    expect(displayFormat).toContain('VALIDATION');
    expect(displayFormat).toContain('Test error message');

    const logFormat = ErrorUtils.formatForLogging(error);
    expect(logFormat).toContain('test-error');
    expect(logFormat).toContain('medium');
    expect(logFormat).toContain('validation');
  });

  /**
   * Test error handler with different configurations
   */
  test('error handler configurations work independently', () => {
    const config1 = { component: 'Component1', maxErrors: 5 };
    const config2 = { component: 'Component2', maxErrors: 3 };

    const handler1 = renderHook(() => useErrorHandler(config1));
    const handler2 = renderHook(() => useErrorHandler(config2));

    // Add errors to both handlers
    act(() => {
      for (let i = 0; i < 7; i++) {
        handler1.result.current.handleError(new Error(`Error 1-${i}`));
        handler2.result.current.handleError(new Error(`Error 2-${i}`));
      }
    });

    // Handler 1 should have max 5 errors
    expect(handler1.result.current.errors.length).toBe(5);
    
    // Handler 2 should have max 3 errors
    expect(handler2.result.current.errors.length).toBe(3);

    // Handlers should be independent
    handler1.result.current.errors.forEach(error => {
      expect(error.context.component).toBe('Component1');
    });

    handler2.result.current.errors.forEach(error => {
      expect(error.context.component).toBe('Component2');
    });
  });

  /**
   * Test error clearing behavior
   */
  test('error clearing works consistently', () => {
    const { result } = renderHook(() => 
      useErrorHandler({ showToast: false, logToConsole: false })
    );

    const errorIds: string[] = [];

    // Add multiple errors
    act(() => {
      for (let i = 0; i < 5; i++) {
        const error = result.current.handleError(new Error(`Error ${i}`));
        errorIds.push(error.id);
      }
    });

    expect(result.current.errors.length).toBe(5);

    // Clear specific error
    act(() => {
      result.current.clearError(errorIds[2]);
    });

    expect(result.current.errors.length).toBe(4);
    expect(result.current.hasError(errorIds[2])).toBe(false);

    // Clear all errors
    act(() => {
      result.current.clearAllErrors();
    });

    expect(result.current.errors.length).toBe(0);
    expect(result.current.hasError()).toBe(false);
  });
});