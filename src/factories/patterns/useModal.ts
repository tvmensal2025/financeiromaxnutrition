/**
 * Standardized Modal Management Hook
 * 
 * Provides consistent modal state management, opening, closing, and data passing patterns
 * across all modal components in the application.
 * 
 * @fileoverview Standardized modal management patterns
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Modal state interface
 */
export interface ModalState<T = unknown> {
  /** Whether the modal is open */
  isOpen: boolean;
  
  /** Data passed to the modal */
  data?: T;
  
  /** Modal configuration */
  config?: ModalConfig;
  
  /** Loading state */
  isLoading?: boolean;
  
  /** Error state */
  error?: string | null;
}

/**
 * Modal configuration interface
 */
export interface ModalConfig {
  /** Whether the modal can be closed by clicking outside */
  closeOnOutsideClick?: boolean;
  
  /** Whether the modal can be closed by pressing escape */
  closeOnEscape?: boolean;
  
  /** Whether to show the close button */
  showCloseButton?: boolean;
  
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  
  /** Custom CSS classes */
  className?: string;
  
  /** Z-index for modal layering */
  zIndex?: number;
  
  /** Animation configuration */
  animation?: {
    enter?: string;
    exit?: string;
    duration?: number;
  };
}

/**
 * Modal actions interface
 */
export interface ModalActions<T = unknown> {
  /** Open the modal */
  open: (data?: T, config?: ModalConfig) => void;
  
  /** Close the modal */
  close: () => void;
  
  /** Toggle the modal */
  toggle: (data?: T, config?: ModalConfig) => void;
  
  /** Update modal data */
  updateData: (data: Partial<T>) => void;
  
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  
  /** Set error state */
  setError: (error: string | null) => void;
  
  /** Reset modal state */
  reset: () => void;
}

/**
 * Modal hook options
 */
export interface UseModalOptions<T = unknown> {
  /** Initial modal state */
  initialState?: Partial<ModalState<T>>;
  
  /** Default modal configuration */
  defaultConfig?: ModalConfig;
  
  /** Callback when modal opens */
  onOpen?: (data?: T) => void;
  
  /** Callback when modal closes */
  onClose?: () => void;
  
  /** Callback when modal data changes */
  onDataChange?: (data: T) => void;
  
  /** Auto-close timeout in milliseconds */
  autoCloseTimeout?: number;
  
  /** Whether to persist modal state in session storage */
  persistState?: boolean;
  
  /** Storage key for persisting state */
  storageKey?: string;
}

/**
 * Default modal configuration
 */
const DEFAULT_CONFIG: ModalConfig = {
  closeOnOutsideClick: true,
  closeOnEscape: true,
  showCloseButton: true,
  size: 'md',
  zIndex: 1000,
  animation: {
    enter: 'fadeIn',
    exit: 'fadeOut',
    duration: 200
  }
};

/**
 * Standardized modal management hook
 * 
 * @param options - Configuration options for the modal
 * @returns Modal state and actions
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const modal = useModal();
 * 
 * // With typed data
 * interface UserData {
 *   id: string;
 *   name: string;
 * }
 * 
 * const userModal = useModal<UserData>({
 *   onOpen: (data) => console.log('Opening modal with user:', data),
 *   onClose: () => console.log('Modal closed')
 * });
 * 
 * // Open modal with data
 * userModal.open({ id: '1', name: 'John' });
 * 
 * // Update data
 * userModal.updateData({ name: 'Jane' });
 * 
 * // Close modal
 * userModal.close();
 * ```
 * 
 * **Validates: Requirements 5.1**
 */
export function useModal<T = unknown>(
  options: UseModalOptions<T> = {}
): ModalState<T> & ModalActions<T> {
  const {
    initialState = {},
    defaultConfig = {},
    onOpen,
    onClose,
    onDataChange,
    autoCloseTimeout,
    persistState = false,
    storageKey = 'modal-state'
  } = options;

  // Merge default config with user config
  const mergedConfig = { ...DEFAULT_CONFIG, ...defaultConfig };

  // Initialize state
  const [state, setState] = useState<ModalState<T>>(() => {
    const baseState: ModalState<T> = {
      isOpen: false,
      data: undefined,
      config: mergedConfig,
      isLoading: false,
      error: null,
      ...initialState
    };

    // Load persisted state if enabled
    if (persistState && typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          const parsedState = JSON.parse(saved);
          return { ...baseState, ...parsedState };
        }
      } catch (error) {
        console.warn('Failed to load persisted modal state:', error);
      }
    }

    return baseState;
  });

  // Auto-close timeout ref
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Persist state when it changes
  useEffect(() => {
    if (persistState && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to persist modal state:', error);
      }
    }
  }, [state, persistState, storageKey]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Open the modal with optional data and config
   */
  const open = useCallback((data?: T, config?: ModalConfig) => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      data,
      config: config ? { ...mergedConfig, ...config } : prev.config,
      error: null
    }));

    // Call onOpen callback
    onOpen?.(data);

    // Set auto-close timeout if specified
    if (autoCloseTimeout) {
      timeoutRef.current = setTimeout(() => {
        close();
      }, autoCloseTimeout);
    }
  }, [onOpen, autoCloseTimeout, mergedConfig]);

  /**
   * Close the modal
   */
  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      isLoading: false,
      error: null
    }));

    // Clear auto-close timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    // Call onClose callback
    onClose?.();
  }, [onClose]);

  /**
   * Toggle the modal
   */
  const toggle = useCallback((data?: T, config?: ModalConfig) => {
    if (state.isOpen) {
      close();
    } else {
      open(data, config);
    }
  }, [state.isOpen, open, close]);

  /**
   * Update modal data
   */
  const updateData = useCallback((newData: Partial<T>) => {
    setState(prev => {
      const updatedData = prev.data 
        ? { ...prev.data, ...newData }
        : newData as T;
      
      // Call onDataChange callback
      onDataChange?.(updatedData);
      
      return {
        ...prev,
        data: updatedData
      };
    });
  }, [onDataChange]);

  /**
   * Set loading state
   */
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading: loading
    }));
  }, []);

  /**
   * Set error state
   */
  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false
    }));
  }, []);

  /**
   * Reset modal state
   */
  const reset = useCallback(() => {
    setState({
      isOpen: false,
      data: undefined,
      config: mergedConfig,
      isLoading: false,
      error: null
    });

    // Clear auto-close timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, [mergedConfig]);

  return {
    // State
    isOpen: state.isOpen,
    data: state.data,
    config: state.config,
    isLoading: state.isLoading,
    error: state.error,
    
    // Actions
    open,
    close,
    toggle,
    updateData,
    setLoading,
    setError,
    reset
  };
}

/**
 * Modal context for managing multiple modals
 */
export interface ModalContextValue {
  /** Register a modal */
  register: (id: string, modal: ModalState & ModalActions) => void;
  
  /** Unregister a modal */
  unregister: (id: string) => void;
  
  /** Get a modal by id */
  getModal: (id: string) => (ModalState & ModalActions) | undefined;
  
  /** Close all modals */
  closeAll: () => void;
  
  /** Get all open modals */
  getOpenModals: () => string[];
}

/**
 * Modal registry for managing multiple modals
 */
class ModalRegistry {
  private modals = new Map<string, ModalState & ModalActions>();

  register(id: string, modal: ModalState & ModalActions) {
    this.modals.set(id, modal);
  }

  unregister(id: string) {
    this.modals.delete(id);
  }

  getModal(id: string) {
    return this.modals.get(id);
  }

  closeAll() {
    this.modals.forEach(modal => {
      if (modal.isOpen) {
        modal.close();
      }
    });
  }

  getOpenModals() {
    const openModals: string[] = [];
    this.modals.forEach((modal, id) => {
      if (modal.isOpen) {
        openModals.push(id);
      }
    });
    return openModals;
  }
}

// Global modal registry
const globalModalRegistry = new ModalRegistry();

/**
 * Hook for managing multiple modals
 */
export function useModalRegistry(): ModalContextValue {
  return {
    register: globalModalRegistry.register.bind(globalModalRegistry),
    unregister: globalModalRegistry.unregister.bind(globalModalRegistry),
    getModal: globalModalRegistry.getModal.bind(globalModalRegistry),
    closeAll: globalModalRegistry.closeAll.bind(globalModalRegistry),
    getOpenModals: globalModalRegistry.getOpenModals.bind(globalModalRegistry)
  };
}

/**
 * Hook for registering a modal with the global registry
 */
export function useModalRegistration<T = unknown>(
  id: string,
  options?: UseModalOptions<T>
) {
  const modal = useModal<T>(options);
  const registry = useModalRegistry();

  useEffect(() => {
    registry.register(id, modal);
    return () => registry.unregister(id);
  }, [id, modal, registry]);

  return modal;
}

/**
 * Utility functions for modal management
 */
export const ModalUtils = {
  /**
   * Create a modal configuration with common presets
   */
  createConfig: (preset: 'small' | 'medium' | 'large' | 'fullscreen' | 'dialog'): ModalConfig => {
    const presets: Record<string, ModalConfig> = {
      small: {
        size: 'sm',
        closeOnOutsideClick: true,
        closeOnEscape: true,
        showCloseButton: true
      },
      medium: {
        size: 'md',
        closeOnOutsideClick: true,
        closeOnEscape: true,
        showCloseButton: true
      },
      large: {
        size: 'lg',
        closeOnOutsideClick: false,
        closeOnEscape: true,
        showCloseButton: true
      },
      fullscreen: {
        size: 'full',
        closeOnOutsideClick: false,
        closeOnEscape: false,
        showCloseButton: true
      },
      dialog: {
        size: 'sm',
        closeOnOutsideClick: false,
        closeOnEscape: false,
        showCloseButton: false
      }
    };

    return { ...DEFAULT_CONFIG, ...presets[preset] };
  },

  /**
   * Generate a unique modal ID
   */
  generateId: (prefix = 'modal') => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Check if any modal is currently open
   */
  hasOpenModal: () => {
    return globalModalRegistry.getOpenModals().length > 0;
  },

  /**
   * Close all open modals
   */
  closeAllModals: () => {
    globalModalRegistry.closeAll();
  }
};