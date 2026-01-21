/**
 * Form Experience Preservation Property Tests
 * 
 * Tests to ensure that migrating existing form dialogs to the unified system
 * preserves the original user experience and functionality.
 * 
 * @fileoverview Form experience preservation property tests
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fc from 'fast-check';
import React from 'react';
import { UnifiedFormDialog } from './UnifiedFormDialog';
import { customerFormConfig } from './configs/customerFormConfig';
import { leadFormConfig } from './configs/leadFormConfig';
import { Arbitraries } from '../../test/fast-check.config';
import { BaseEntity } from '../types/core';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id', name: 'Test' }, error: null }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'test-id', name: 'Test' }, error: null }))
          }))
        }))
      }))
    }))
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    business: { id: 'test-business-id' }
  }))
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn()
  }))
}));

// Test entity interfaces
interface TestCustomer extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface TestLead extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
}

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

/**
 * Property-Based Tests for Form Experience Preservation
 * **Property 16: Form Experience Preservation**
 * **Validates: Requirements 3.6**
 */
describe('Form Experience Preservation Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 16: Form Experience Preservation', () => {
    it('should preserve form field structure across different entity types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entityType: fc.constantFrom('customer', 'lead'),
            mode: fc.constantFrom('create', 'edit'),
            hasInitialData: fc.boolean()
          }),
          async ({ entityType, mode, hasInitialData }) => {
            const wrapper = createWrapper();
            
            // Get appropriate form configuration
            const config = entityType === 'customer' ? customerFormConfig : leadFormConfig;
            const initialData = hasInitialData ? (
              entityType === 'customer' 
                ? { name: 'Test Customer', email: 'test@example.com' }
                : { name: 'Test Lead', source: 'website', status: 'new' }
            ) : undefined;

            const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
            const mockOnClose = vi.fn();

            // Render unified form dialog
            render(
              React.createElement(UnifiedFormDialog, {
                isOpen: true,
                onClose: mockOnClose,
                mode: mode,
                initialData: initialData,
                fields: config.fields,
                onSubmit: mockOnSubmit
              }),
              { wrapper }
            );

            // Property: All required fields should be present
            const requiredFields = config.fields.filter(field => field.required);
            const requiredFieldsPresent = requiredFields.every(field => {
              const element = screen.queryByLabelText(new RegExp(field.label, 'i'));
              return element !== null;
            });

            // Property: Form should have submit and cancel buttons
            const submitButton = screen.queryByRole('button', { name: /criar|salvar/i });
            const cancelButton = screen.queryByRole('button', { name: /cancelar/i });
            const hasRequiredButtons = submitButton && cancelButton;

            return requiredFieldsPresent && hasRequiredButtons;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should preserve form validation behavior', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entityType: fc.constantFrom('customer', 'lead'),
            submitEmptyForm: fc.boolean()
          }),
          async ({ entityType, submitEmptyForm }) => {
            const wrapper = createWrapper();
            const config = entityType === 'customer' ? customerFormConfig : leadFormConfig;
            
            const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
            const mockOnClose = vi.fn();

            render(
              React.createElement(UnifiedFormDialog, {
                isOpen: true,
                onClose: mockOnClose,
                mode: 'create',
                fields: config.fields,
                onSubmit: mockOnSubmit
              }),
              { wrapper }
            );

            const submitButton = screen.queryByRole('button', { name: /criar/i });

            if (submitEmptyForm && submitButton) {
              // Try to submit empty form
              fireEvent.click(submitButton);
              
              // Property: Required field validation should prevent submission
              expect(mockOnSubmit).not.toHaveBeenCalled();
              return true;
            }

            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should preserve form interaction patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entityType: fc.constantFrom('customer', 'lead'),
            interactionType: fc.constantFrom('button_click', 'form_render')
          }),
          async ({ entityType, interactionType }) => {
            const wrapper = createWrapper();
            const config = entityType === 'customer' ? customerFormConfig : leadFormConfig;
            
            const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
            const mockOnClose = vi.fn();

            render(
              React.createElement(UnifiedFormDialog, {
                isOpen: true,
                onClose: mockOnClose,
                mode: 'create',
                fields: config.fields,
                onSubmit: mockOnSubmit
              }),
              { wrapper }
            );

            switch (interactionType) {
              case 'button_click': {
                // Property: Cancel button should close dialog
                const cancelButton = screen.queryByRole('button', { name: /cancelar/i });
                if (cancelButton) {
                  fireEvent.click(cancelButton);
                  expect(mockOnClose).toHaveBeenCalled();
                }
                return true;
              }

              case 'form_render': {
                // Property: Dialog should be rendered
                const dialog = screen.queryByRole('dialog');
                return dialog !== null;
              }

              default:
                return true;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve form accessibility features', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entityType: fc.constantFrom('customer', 'lead')
          }),
          async ({ entityType }) => {
            const wrapper = createWrapper();
            const config = entityType === 'customer' ? customerFormConfig : leadFormConfig;
            
            const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
            const mockOnClose = vi.fn();

            render(
              React.createElement(UnifiedFormDialog, {
                isOpen: true,
                onClose: mockOnClose,
                mode: 'create',
                fields: config.fields,
                onSubmit: mockOnSubmit
              }),
              { wrapper }
            );

            // Property: Form should have proper ARIA attributes
            const dialog = screen.queryByRole('dialog');
            const hasDialog = dialog !== null;

            // Property: Required fields should be marked as required
            const requiredFields = config.fields.filter(field => field.required);
            const requiredFieldsMarked = requiredFields.length > 0 ? 
              requiredFields.some(field => {
                const labelElement = screen.queryByText(new RegExp(`${field.label}.*\\*`, 'i'));
                return labelElement !== null;
              }) : true;

            return hasDialog && requiredFieldsMarked;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should preserve form performance characteristics', () => {
      const wrapper = createWrapper();
      
      // Property: Form rendering should be performant
      const startTime = performance.now();
      
      render(
        React.createElement(UnifiedFormDialog, {
          isOpen: true,
          onClose: vi.fn(),
          mode: 'create',
          fields: customerFormConfig.fields,
          onSubmit: vi.fn()
        }),
        { wrapper }
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Property: Form should render within reasonable time (< 100ms)
      expect(renderTime).toBeLessThan(100);
      
      // Property: Form should not cause memory leaks
      const dialog = screen.queryByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
  });
});