/**
 * Standardized Error Handling Hook
 * 
 * Provides consistent error display, logging, and user feedback patterns
 * across all components in the application.
 * 
 * @fileoverview Standardized error handling patterns
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for classification
 */
export type ErrorCategory = 
  | 'validation' 
  | 'network' 
  | 'authentication' 
  | 'authorization' 
  | 'business_logic' 
  | 'system' 
  | 'user_input' 
  | 'external_service'
  | 'unknown';

/**
 * Error context interface
 */
export interface ErrorContext {
  /** Component or feature where error occurred */
  component?: string;
  
  /** User action that triggered the error */
  action?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  
  /** User ID if available */
  userId?: string;
  
  /** Session ID if available */
  sessionId?: string;
  
  /** Timestamp when error occurred */
  timestamp: number;
}

/**
 * Standardized error interface
 */
export interface StandardizedError {
  /** Error identifier */
  id: string;
  
  /** Error message for users */
  message: string;
  
  /** Technical error message for developers */
  technicalMessage?: string;
  
  /** Error code */
  code?: string;
  
  /** Error severity */
  severity: ErrorSeverity;
  
  /** Error category */
  category: ErrorCategory;
  
  /** Error context */
  context: ErrorContext;
  
  /** Original error object */
  originalError?: Error;
  
  /** Whether error is recoverable */
  recoverable: boolean;
  
  /** Suggested recovery actions */
  recoveryActions?: string[];
  
  /** Whether error should be reported to monitoring */
  reportable: boolean;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlerConfig {
  /** Default error severity */
  defaultSeverity?: ErrorSeverity;
  
  /** Default error category */
  defaultCategory?: ErrorCategory;
  
  /** Component context */
  component?: string;
  
  /** Whether to show toast notifications */
  showToast?: boolean;
  
  /** Whether to log errors to console */
  logToConsole?: boolean;
  
  /** Whether to report errors to monitoring service */
  reportToMonitoring?: boolean;
  
  /** Custom error message formatter */
  messageFormatter?: (error: StandardizedError) => string;
  
  /** Custom error logger */
  logger?: (error: StandardizedError) => void;
  
  /** Custom error reporter */
  reporter?: (error: StandardizedError) => Promise<void>;
  
  /** Maximum number of errors to store */
  maxErrors?: number;
  
  /** Auto-clear errors after timeout (ms) */
  autoClearTimeout?: number;
}

/**
 * Error handler state
 */
export interface ErrorHandlerState {
  /** Current errors */
  errors: StandardizedError[];
  
  /** Whether any error is currently being handled */
  isHandling: boolean;
  
  /** Last error that occurred */
  lastError?: StandardizedError;
  
  /** Error count by category */
  errorCounts: Record<ErrorCategory, number>;
}

/**
 * Error handler actions
 */
export interface ErrorHandlerActions {
  /** Handle a new error */
  handleError: (error: unknown, context?: Partial<ErrorContext>) => StandardizedError;
  
  /** Clear a specific error */
  clearError: (errorId: string) => void;
  
  /** Clear all errors */
  clearAllErrors: () => void;
  
  /** Retry an operation with error handling */
  retry: <T>(operation: () => Promise<T>, context?: Partial<ErrorContext>) => Promise<T>;
  
  /** Get errors by category */
  getErrorsByCategory: (category: ErrorCategory) => StandardizedError[];
  
  /** Get errors by severity */
  getErrorsBySeverity: (severity: ErrorSeverity) => StandardizedError[];
  
  /** Check if error exists */
  hasError: (errorId?: string) => boolean;
  
  /** Get error statistics */
  getErrorStats: () => {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
  };
}

/**
 * Default error handler configuration
 */
const DEFAULT_CONFIG: Required<ErrorHandlerConfig> = {
  defaultSeverity: 'medium',
  defaultCategory: 'unknown',
  component: 'unknown',
  showToast: true,
  logToConsole: true,
  reportToMonitoring: false,
  messageFormatter: (error) => error.message,
  logger: (error) => {
    console.error(`[${error.severity.toUpperCase()}] ${error.category}:`, error);
  },
  reporter: async (error) => {
    // Default reporter - could integrate with Sentry, LogRocket, etc.
    console.warn('Error reporting not configured:', error);
  },
  maxErrors: 50,
  autoClearTimeout: 0 // 0 means no auto-clear
};

/**
 * Error classification utility
 */
class ErrorClassifier {
  /**
   * Classifies an error based on its properties
   */
  static classify(error: unknown): { category: ErrorCategory; severity: ErrorSeverity } {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const name = error.name.toLowerCase();

      // Network errors
      if (message.includes('network') || message.includes('fetch') || 
          message.includes('connection') || name.includes('networkerror')) {
        return { category: 'network', severity: 'medium' };
      }

      // Authentication errors
      if (message.includes('unauthorized') || message.includes('authentication') ||
          message.includes('login') || name.includes('autherror')) {
        return { category: 'authentication', severity: 'high' };
      }

      // Authorization errors
      if (message.includes('forbidden') || message.includes('permission') ||
          message.includes('access denied')) {
        return { category: 'authorization', severity: 'high' };
      }

      // Validation errors
      if (message.includes('validation') || message.includes('invalid') ||
          message.includes('required') || message.includes('format')) {
        return { category: 'validation', severity: 'low' };
      }

      // Business logic errors
      if (message.includes('business') || message.includes('rule') ||
          message.includes('constraint') || message.includes('duplicate')) {
        return { category: 'business_logic', severity: 'medium' };
      }

      // System errors
      if (message.includes('system') || message.includes('internal') ||
          message.includes('server') || name.includes('systemerror')) {
        return { category: 'system', severity: 'critical' };
      }
    }

    return { category: 'unknown', severity: 'medium' };
  }

  /**
   * Determines if an error is recoverable
   */
  static isRecoverable(error: unknown, category: ErrorCategory): boolean {
    switch (category) {
      case 'validation':
      case 'user_input':
        return true;
      case 'network':
        return true; // Can retry
      case 'authentication':
        return true; // Can re-authenticate
      case 'authorization':
        return false; // Need different permissions
      case 'business_logic':
        return false; // Business rules violation
      case 'system':
      case 'critical':
        return false; // System-level issues
      default:
        return true; // Assume recoverable by default
    }
  }

  /**
   * Suggests recovery actions based on error category
   */
  static suggestRecoveryActions(category: ErrorCategory): string[] {
    switch (category) {
      case 'validation':
        return ['Check input format', 'Verify required fields', 'Review validation rules'];
      case 'network':
        return ['Check internet connection', 'Retry request', 'Try again later'];
      case 'authentication':
        return ['Log in again', 'Check credentials', 'Reset password'];
      case 'authorization':
        return ['Contact administrator', 'Request access', 'Check permissions'];
      case 'business_logic':
        return ['Review business rules', 'Check data constraints', 'Contact support'];
      case 'system':
        return ['Contact support', 'Try again later', 'Check system status'];
      default:
        return ['Try again', 'Contact support if problem persists'];
    }
  }
}

/**
 * Standardized Error Handling Hook
 * 
 * @param config - Configuration options for error handling
 * @returns Error handler state and actions
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const errorHandler = useErrorHandler({
 *   component: 'UserForm',
 *   showToast: true
 * });
 * 
 * // Handle an error
 * try {
 *   await saveUser(userData);
 * } catch (error) {
 *   errorHandler.handleError(error, { action: 'save_user' });
 * }
 * 
 * // Retry with error handling
 * const result = await errorHandler.retry(
 *   () => saveUser(userData),
 *   { action: 'save_user_retry' }
 * );
 * ```
 * 
 * **Validates: Requirements 5.2**
 */
export function useErrorHandler(
  config: ErrorHandlerConfig = {}
): ErrorHandlerState & ErrorHandlerActions {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<ErrorHandlerState>({
    errors: [],
    isHandling: false,
    errorCounts: {
      validation: 0,
      network: 0,
      authentication: 0,
      authorization: 0,
      business_logic: 0,
      system: 0,
      user_input: 0,
      external_service: 0,
      unknown: 0
    }
  });

  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  /**
   * Generates a unique error ID
   */
  const generateErrorId = useCallback(() => {
    return `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  /**
   * Creates a standardized error from any error input
   */
  const createStandardizedError = useCallback((
    error: unknown,
    context: Partial<ErrorContext> = {}
  ): StandardizedError => {
    const { category: classifiedCategory, severity: classifiedSeverity } = ErrorClassifier.classify(error);
    
    // Use metadata overrides if provided, otherwise use classified values
    const finalCategory = (context.metadata?.category as ErrorCategory) || classifiedCategory;
    const finalSeverity = (context.metadata?.severity as ErrorSeverity) || classifiedSeverity || mergedConfig.defaultSeverity;
    
    const recoverable = ErrorClassifier.isRecoverable(error, finalCategory);
    const recoveryActions = ErrorClassifier.suggestRecoveryActions(finalCategory);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const technicalMessage = error instanceof Error ? error.stack : undefined;

    return {
      id: generateErrorId(),
      message: errorMessage,
      technicalMessage,
      code: error instanceof Error ? error.name : undefined,
      severity: finalSeverity,
      category: finalCategory,
      context: {
        component: mergedConfig.component,
        timestamp: Date.now(),
        ...context
      },
      originalError: error instanceof Error ? error : undefined,
      recoverable,
      recoveryActions,
      reportable: finalSeverity === 'critical' || finalSeverity === 'high'
    };
  }, [generateErrorId, mergedConfig]);

  /**
   * Handles a new error
   */
  const handleError = useCallback((
    error: unknown,
    context: Partial<ErrorContext> = {}
  ): StandardizedError => {
    setState(prev => ({ ...prev, isHandling: true }));

    const standardizedError = createStandardizedError(error, context);

    // Log error
    if (mergedConfig.logToConsole) {
      mergedConfig.logger(standardizedError);
    }

    // Show toast notification
    if (mergedConfig.showToast) {
      const message = mergedConfig.messageFormatter(standardizedError);
      toast({
        title: "Error",
        description: message,
        variant: standardizedError.severity === 'critical' ? 'destructive' : 'default'
      });
    }

    // Report error if needed
    if (mergedConfig.reportToMonitoring && standardizedError.reportable) {
      mergedConfig.reporter(standardizedError).catch(reportError => {
        console.warn('Failed to report error:', reportError);
      });
    }

    // Update state
    setState(prev => {
      const newErrors = [...prev.errors, standardizedError];
      
      // Limit number of stored errors
      if (newErrors.length > mergedConfig.maxErrors) {
        newErrors.splice(0, newErrors.length - mergedConfig.maxErrors);
      }

      const newErrorCounts = { ...prev.errorCounts };
      newErrorCounts[standardizedError.category]++;

      return {
        errors: newErrors,
        isHandling: false,
        lastError: standardizedError,
        errorCounts: newErrorCounts
      };
    });

    // Set auto-clear timeout if configured
    if (mergedConfig.autoClearTimeout > 0) {
      const timeout = setTimeout(() => {
        clearError(standardizedError.id);
      }, mergedConfig.autoClearTimeout);
      
      timeoutRefs.current.set(standardizedError.id, timeout);
    }

    return standardizedError;
  }, [createStandardizedError, mergedConfig]);

  /**
   * Clears a specific error
   */
  const clearError = useCallback((errorId: string) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.filter(error => error.id !== errorId)
    }));

    // Clear timeout if exists
    const timeout = timeoutRefs.current.get(errorId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(errorId);
    }
  }, []);

  /**
   * Clears all errors
   */
  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: [],
      lastError: undefined,
      errorCounts: {
        validation: 0,
        network: 0,
        authentication: 0,
        authorization: 0,
        business_logic: 0,
        system: 0,
        user_input: 0,
        external_service: 0,
        unknown: 0
      }
    }));

    // Clear all timeouts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current.clear();
  }, []);

  /**
   * Retries an operation with error handling
   */
  const retry = useCallback(async <T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const standardizedError = handleError(error, {
        ...context,
        action: context.action ? `${context.action}_retry` : 'retry'
      });
      throw standardizedError;
    }
  }, [handleError]);

  /**
   * Gets errors by category
   */
  const getErrorsByCategory = useCallback((category: ErrorCategory) => {
    return state.errors.filter(error => error.category === category);
  }, [state.errors]);

  /**
   * Gets errors by severity
   */
  const getErrorsBySeverity = useCallback((severity: ErrorSeverity) => {
    return state.errors.filter(error => error.severity === severity);
  }, [state.errors]);

  /**
   * Checks if error exists
   */
  const hasError = useCallback((errorId?: string) => {
    if (errorId) {
      return state.errors.some(error => error.id === errorId);
    }
    return state.errors.length > 0;
  }, [state.errors]);

  /**
   * Gets error statistics
   */
  const getErrorStats = useCallback(() => {
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    state.errors.forEach(error => {
      bySeverity[error.severity]++;
    });

    return {
      total: state.errors.length,
      byCategory: state.errorCounts,
      bySeverity
    };
  }, [state.errors, state.errorCounts]);

  return {
    // State
    errors: state.errors,
    isHandling: state.isHandling,
    lastError: state.lastError,
    errorCounts: state.errorCounts,
    
    // Actions
    handleError,
    clearError,
    clearAllErrors,
    retry,
    getErrorsByCategory,
    getErrorsBySeverity,
    hasError,
    getErrorStats
  };
}

/**
 * Higher-order component for error boundary functionality
 */
export interface ErrorBoundaryProps {
  /** Component name for error context */
  component: string;
  
  /** Fallback UI when error occurs */
  fallback?: React.ComponentType<{ error: StandardizedError; retry: () => void }>;
  
  /** Error handler configuration */
  errorConfig?: ErrorHandlerConfig;
  
  /** Children components */
  children: React.ReactNode;
}

/**
 * Error boundary hook for catching React errors
 */
export function useErrorBoundary(component: string) {
  const errorHandler = useErrorHandler({ component });

  const captureError = useCallback((error: Error, errorInfo?: { componentStack: string }) => {
    return errorHandler.handleError(error, {
      component,
      action: 'render',
      metadata: { errorInfo }
    });
  }, [errorHandler, component]);

  return {
    captureError,
    ...errorHandler
  };
}

/**
 * Utility functions for error handling
 */
export const ErrorUtils = {
  /**
   * Checks if error is of specific category
   */
  isCategory: (error: StandardizedError, category: ErrorCategory): boolean => {
    return error.category === category;
  },

  /**
   * Checks if error is of specific severity
   */
  isSeverity: (error: StandardizedError, severity: ErrorSeverity): boolean => {
    return error.severity === severity;
  },

  /**
   * Formats error for display
   */
  formatForDisplay: (error: StandardizedError): string => {
    return `[${error.category.toUpperCase()}] ${error.message}`;
  },

  /**
   * Formats error for logging
   */
  formatForLogging: (error: StandardizedError): string => {
    return `${error.id} | ${error.severity} | ${error.category} | ${error.context.component} | ${error.message}`;
  },

  /**
   * Creates error from validation result
   */
  fromValidation: (field: string, message: string): Partial<ErrorContext> => ({
    action: 'validation',
    metadata: { field, validationError: true }
  }),

  /**
   * Creates error from network failure
   */
  fromNetwork: (url: string, status?: number): Partial<ErrorContext> => ({
    action: 'network_request',
    metadata: { url, status, networkError: true }
  }),

  /**
   * Creates error from business logic violation
   */
  fromBusinessLogic: (rule: string, data?: unknown): Partial<ErrorContext> => ({
    action: 'business_validation',
    metadata: { rule, data, businessError: true }
  })
};