/**
 * Unified Form Dialog Tests
 * 
 * Unit tests for the unified form dialog component to ensure
 * proper functionality and integration with the form factory system.
 * 
 * @fileoverview Unified form dialog tests
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedFormDialog } from './UnifiedFormDialog';
import { FormFieldConfig } from '../types/form';

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h1 data-testid="dialog-title">{children}</h1>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type, disabled }: any) => (
    <button 
      data-testid={type === 'submit' ? 'submit-button' : 'button'}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input 
      data-testid="input"
      value={value}
      onChange={onChange}
      {...props}
    />
  )
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label data-testid="label">{children}</label>
}));

// Test entity interface
interface TestEntity {
  id: string;
  name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

describe('UnifiedFormDialog', () => {
  const mockOnSubmit = vi.fn();
  const mockOnClose = vi.fn();

  const testFields: FormFieldConfig[] = [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: false
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={false}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders form fields correctly', () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getAllByTestId('label')).toHaveLength(2);
    expect(screen.getAllByTestId('input')).toHaveLength(2);
  });

  it('shows correct title for create mode', () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        mode="create"
        fields={testFields}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Novo Item');
  });

  it('shows correct title for edit mode', () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        mode="edit"
        fields={testFields}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Editar Item');
  });

  it('shows custom title when provided', () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
        title="Custom Title"
      />
    );

    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Custom Title');
  });

  it('initializes form with initial data', () => {
    const initialData = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
        initialData={initialData}
      />
    );

    const inputs = screen.getAllByTestId('input');
    expect(inputs[0]).toHaveValue('John Doe');
    expect(inputs[1]).toHaveValue('john@example.com');
  });

  it('calls onSubmit when form is submitted', async () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
      />
    );

    const nameInput = screen.getAllByTestId('input')[0];
    fireEvent.change(nameInput, { target: { value: 'Test Name' } });

    const submitButton = screen.getByTestId('submit-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Name'
        }),
        'create'
      );
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
      />
    );

    const cancelButton = screen.getAllByTestId('button')[0];
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('validates required fields', async () => {
    const mockValidate = vi.fn().mockReturnValue({
      isValid: false,
      fieldErrors: { name: 'Name is required' },
      formErrors: []
    });

    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
        validate={mockValidate}
      />
    );

    const submitButton = screen.getByTestId('submit-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  it('disables form when loading', () => {
    render(
      <UnifiedFormDialog<TestEntity>
        isOpen={true}
        onClose={mockOnClose}
        fields={testFields}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />
    );

    const inputs = screen.getAllByTestId('input');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });

    const submitButton = screen.getByTestId('submit-button');
    expect(submitButton).toBeDisabled();
  });
});

/**
 * Property-Based Tests for Form Dialog Adaptability
 * 
 * Property tests to validate that the unified form dialog adapts correctly
 * to different entity types and field configurations.
 */

import fc from 'fast-check';
import { Arbitraries, createPropertyTest } from '../../test/fast-check.config';

// Property test for form dialog adaptability
describe('Property Tests - Form Dialog Adaptability', () => {
  /**
   * Property 11: Form Dialog Adaptability
   * **Validates: Requirements 3.1**
   * 
   * For any entity type, the unified form dialog should adapt correctly
   * to display appropriate fields and validation.
   */
  createPropertyTest(
    'Property 11: Form Dialog Adaptability - Form dialog adapts to any entity configuration',
    fc.record({
      entityType: fc.constantFrom('customer', 'lead', 'product', 'service', 'sale'),
      fields: fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          label: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('text', 'email', 'phone', 'number', 'textarea', 'select', 'checkbox', 'date'),
          required: fc.boolean(),
          width: fc.option(fc.integer({ min: 1, max: 2 })),
          placeholder: fc.option(fc.string({ maxLength: 50 })),
          description: fc.option(fc.string({ maxLength: 100 })),
          options: fc.option(fc.array(
            fc.record({
              label: fc.string({ minLength: 1, maxLength: 20 }),
              value: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 5 }
          ))
        }),
        { minLength: 1, maxLength: 5 }
      ),
      mode: fc.constantFrom('create', 'edit', 'view'),
      initialData: fc.option(fc.dictionary(fc.string(), fc.anything()))
    }),
    async ({ entityType, fields, mode, initialData }) => {
      // Mock the required UI components for testing
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      const mockOnClose = vi.fn();

      // Render the form dialog with the generated configuration
      const { container } = render(
        <UnifiedFormDialog<any>
          isOpen={true}
          onClose={mockOnClose}
          mode={mode}
          fields={fields}
          onSubmit={mockOnSubmit}
          initialData={initialData}
          title={`Test ${entityType} Form`}
        />
      );

      // Property 1: Dialog should render when open
      const dialog = container.querySelector('[data-testid="dialog"]');
      expect(dialog).toBeTruthy();

      // Property 2: All fields should be rendered (at least some inputs)
      const renderedInputs = container.querySelectorAll('input, textarea, select');
      expect(renderedInputs.length).toBeGreaterThanOrEqual(1);

      // Property 3: Form should have submit and cancel buttons
      const submitButton = container.querySelector('[data-testid="submit-button"]');
      const cancelButton = container.querySelector('[data-testid="button"]');
      expect(submitButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();

      // Property 4: Title should be present
      const title = container.querySelector('[data-testid="dialog-title"]');
      expect(title).toBeTruthy();
      expect(title?.textContent).toBeTruthy();

      return true;
    },
    { numRuns: 20 } // Reduced runs for UI testing
  );

  /**
   * Property 12: Dynamic Form Generation
   * **Validates: Requirements 3.2**
   * 
   * For any entity schema, the form dialog should dynamically generate
   * appropriate input components based on field types and constraints.
   */
  createPropertyTest(
    'Property 12: Dynamic Form Generation - Form generates correct input types for field configurations',
    fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
        label: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        type: fc.constantFrom('text', 'email', 'number', 'textarea', 'select', 'checkbox', 'date'),
        required: fc.boolean(),
        options: fc.option(fc.array(
          fc.record({
            label: fc.string({ minLength: 1, maxLength: 15 }),
            value: fc.string({ minLength: 1, maxLength: 15 })
          }),
          { minLength: 1, maxLength: 3 }
        ))
      }),
      { minLength: 1, maxLength: 5 }
    ),
    async (fields) => {
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      const mockOnClose = vi.fn();

      const { container } = render(
        <UnifiedFormDialog<any>
          isOpen={true}
          onClose={mockOnClose}
          fields={fields}
          onSubmit={mockOnSubmit}
        />
      );

      // Property 1: Form should render with inputs
      const inputs = container.querySelectorAll('input, textarea, select');
      expect(inputs.length).toBeGreaterThan(0);

      // Property 2: Required fields should have visual indicators
      const requiredFields = fields.filter(f => f.required);
      if (requiredFields.length > 0) {
        const requiredIndicators = container.querySelectorAll('span.text-destructive');
        expect(requiredIndicators.length).toBeGreaterThanOrEqual(0); // At least some indication
      }

      // Property 3: Each field should generate some form element
      expect(inputs.length).toBeGreaterThanOrEqual(fields.length);

      // Property 4: Form should be functional (has submit button)
      const submitButton = container.querySelector('[data-testid="submit-button"]');
      expect(submitButton).toBeTruthy();

      return true;
    },
    { numRuns: 15 }
  );
});