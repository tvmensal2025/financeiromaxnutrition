/**
 * Tests for FormModal component
 * 
 * Feature: project-refactoring
 * 
 * Properties tested:
 * - Property 4: FormModal Field Rendering
 * - Property 5: FormModal Required Field Validation
 * - Property 6: FormModal Conditional Field Visibility
 * 
 * Validates: Requirements 4.4, 4.9, 4.11
 * 
 * @module components/common/FormModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormModal, FormField } from './FormModal';

// Mock all UI components to avoid Radix UI issues
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => 
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => 
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => 
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => 
    <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => 
    <p data-testid="dialog-description">{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type, disabled }: any) => 
    <button type={type} onClick={onClick} disabled={disabled}>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ id, type, value, onChange, placeholder }: any) => 
    <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => 
    <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ id, value, onChange, placeholder, rows }: any) => 
    <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => 
    <div data-testid="select-root">{children}</div>,
  SelectTrigger: ({ children, id }: any) => 
    <button type="button" role="combobox" id={id}>{children}</button>,
  SelectValue: ({ placeholder }: any) => 
    <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => 
    <div>{children}</div>,
  SelectItem: ({ children, value }: any) => 
    <div data-value={value}>{children}</div>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ id, checked, onCheckedChange }: any) => 
    <button 
      type="button" 
      role="switch" 
      id={id}
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? 'On' : 'Off'}
    </button>,
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader">Loading...</div>,
}));

// ============================================================================
// Property 4: FormModal Field Rendering
// ============================================================================

describe('FormModal - Property 4: FormModal Field Rendering', () => {
  /**
   * Property 4: For any valid field configuration array passed to FormModal,
   * the component SHALL render exactly one input element for each field in the
   * configuration where visibleWhen returns true or is not specified.
   * 
   * **Validates: Requirements 4.4**
   */
  
  it('should render exactly one input element for each field without visibleWhen', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'field1', label: 'Field 1', type: 'text' },
      { name: 'field2', label: 'Field 2', type: 'email' },
    ];
    
    const { container } = render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    );

    // Count rendered input elements for each field
    fields.forEach((field) => {
      const inputElement = container.querySelector(`#${field.name}`);
      expect(inputElement).not.toBeNull();
    });

    // Verify total count matches
    const allInputs = container.querySelectorAll('input, textarea, button[role="combobox"], button[role="switch"]');
    // Subtract 2 for the Cancel and Submit buttons
    const formInputCount = allInputs.length - 2;
    expect(formInputCount).toBe(fields.length);
  });

  it('should render correct input type for each field type', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'text', label: 'Text', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'number', label: 'Number', type: 'number' },
      { name: 'textarea', label: 'Textarea', type: 'textarea' },
      { name: 'select', label: 'Select', type: 'select', options: [{ value: 'a', label: 'A' }] },
      { name: 'switch', label: 'Switch', type: 'switch' },
    ];
    
    const { container } = render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    );

    fields.forEach((field) => {
      const element = container.querySelector(`#${field.name}`);
      expect(element).not.toBeNull();
      
      switch (field.type) {
        case 'textarea':
          expect(element?.tagName.toLowerCase()).toBe('textarea');
          break;
        case 'select':
          expect(element?.getAttribute('role')).toBe('combobox');
          break;
        case 'switch':
          expect(element?.getAttribute('role')).toBe('switch');
          break;
        default:
          // text, email, number, date, time
          expect(element?.tagName.toLowerCase()).toBe('input');
          expect(element?.getAttribute('type')).toBe(field.type);
          break;
      }
    });
  });

  it('should render field labels for each field', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
    ];
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    );

    // Required fields have ' *' appended
    expect(screen.getByText('Name *')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should not render any fields when fields array is empty', () => {
    const mockOnSubmit = vi.fn();
    
    const { container } = render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={[]}
        onSubmit={mockOnSubmit}
      />
    );

    // Only Cancel and Submit buttons should be present
    const allInputs = container.querySelectorAll('input, textarea, button[role="combobox"], button[role="switch"]');
    expect(allInputs.length).toBe(0);
  });
});

// ============================================================================
// Property 5: FormModal Required Field Validation
// ============================================================================

describe('FormModal - Property 5: FormModal Required Field Validation', () => {
  /**
   * Property 5: For any FormModal with required fields, when the form is submitted
   * with any required field empty or containing only whitespace, the onSubmit
   * callback SHALL NOT be invoked.
   * 
   * **Validates: Requirements 4.9**
   */

  it('should NOT invoke onSubmit when any required field is empty', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
    ];
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    );

    // Find and click the submit button
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);

    // onSubmit should NOT be called because required fields are empty
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should NOT invoke onSubmit when required field contains only whitespace', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'requiredField', label: 'Required Field', type: 'text', required: true },
    ];
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        initialValues={{ requiredField: '   ' }}
        onSubmit={mockOnSubmit}
      />
    );

    // Find and click the submit button
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);

    // onSubmit should NOT be called because required field is whitespace-only
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should display error message when required field is empty on submit', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
    ];
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    );

    // Click submit without filling fields
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);

    // Should show error messages
    const errorMessages = screen.getAllByText('Campo obrigatório');
    expect(errorMessages.length).toBe(2);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should invoke onSubmit when all required fields have valid values', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'requiredField', label: 'Required Field', type: 'text', required: true },
    ];
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        initialValues={{ requiredField: 'valid value' }}
        onSubmit={mockOnSubmit}
      />
    );

    // Find and click the submit button
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);

    // onSubmit SHOULD be called because required field has valid value
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith({ requiredField: 'valid value' });
  });

  it('should allow submission when non-required fields are empty', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'optional', label: 'Optional Field', type: 'text', required: false },
    ];
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    );

    // Click submit without filling optional field
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);

    // Should allow submission
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Property 6: FormModal Conditional Field Visibility
// ============================================================================

describe('FormModal - Property 6: FormModal Conditional Field Visibility', () => {
  /**
   * Property 6: For any field with a visibleWhen function, the field SHALL be
   * rendered if and only if visibleWhen(currentValues) returns true.
   * 
   * **Validates: Requirements 4.11**
   */

  it('should render field when visibleWhen returns true', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'toggle', label: 'Toggle', type: 'switch' },
      { 
        name: 'conditionalField', 
        label: 'Conditional Field', 
        type: 'text',
        visibleWhen: (values) => values.toggle === true,
      },
    ];
    
    const { container } = render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        initialValues={{ toggle: true }}
        onSubmit={mockOnSubmit}
      />
    );

    const conditionalInput = container.querySelector('#conditionalField');
    expect(conditionalInput).not.toBeNull();
  });

  it('should NOT render field when visibleWhen returns false', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { 
        name: 'hiddenField', 
        label: 'Hidden Field', 
        type: 'text',
        visibleWhen: () => false,
      },
    ];
    
    const { container } = render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    );

    const hiddenInput = container.querySelector('#hiddenField');
    expect(hiddenInput).toBeNull();
  });

  it('should render field when visibleWhen is not specified', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'field1', label: 'Field 1', type: 'text' },
      { name: 'field2', label: 'Field 2', type: 'email' },
    ];
    
    const { container } = render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    );

    // All fields should be rendered
    fields.forEach((field) => {
      const inputElement = container.querySelector(`#${field.name}`);
      expect(inputElement).not.toBeNull();
    });
  });

  it('should update field visibility when dependent values change', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'showDetails', label: 'Show Details', type: 'switch' },
      { 
        name: 'details', 
        label: 'Details', 
        type: 'textarea',
        visibleWhen: (values) => values.showDetails === true,
      },
    ];
    
    const { container } = render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        initialValues={{ showDetails: false }}
        onSubmit={mockOnSubmit}
      />
    );

    // Initially, details field should be hidden
    let detailsInput = container.querySelector('#details');
    expect(detailsInput).toBeNull();

    // Toggle the switch
    const switchElement = container.querySelector('#showDetails');
    expect(switchElement).not.toBeNull();
    fireEvent.click(switchElement!);

    // After toggle, details field should be visible
    detailsInput = container.querySelector('#details');
    expect(detailsInput).not.toBeNull();
  });

  it('should correctly evaluate visibleWhen with multiple field dependencies', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'fieldA', label: 'Field A', type: 'switch' },
      { name: 'fieldB', label: 'Field B', type: 'switch' },
      { 
        name: 'conditionalField', 
        label: 'Conditional', 
        type: 'text',
        visibleWhen: (values) => values.fieldA === true && values.fieldB === true,
      },
    ];
    
    const { container } = render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        initialValues={{ fieldA: true, fieldB: true }}
        onSubmit={mockOnSubmit}
      />
    );

    const conditionalInput = container.querySelector('#conditionalField');
    expect(conditionalInput).not.toBeNull();
  });

  it('should NOT validate hidden required fields', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'showRequired', label: 'Show Required', type: 'switch' },
      { 
        name: 'hiddenRequired', 
        label: 'Hidden Required', 
        type: 'text',
        required: true,
        visibleWhen: (values) => values.showRequired === true,
      },
    ];
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        initialValues={{ showRequired: false }}
        onSubmit={mockOnSubmit}
      />
    );

    // Submit form - hidden required field should not block submission
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);

    // onSubmit SHOULD be called because the required field is hidden
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it('should validate visible required fields', () => {
    const mockOnSubmit = vi.fn();
    
    const fields: FormField[] = [
      { name: 'showRequired', label: 'Show Required', type: 'switch' },
      { 
        name: 'visibleRequired', 
        label: 'Visible Required', 
        type: 'text',
        required: true,
        visibleWhen: (values) => values.showRequired === true,
      },
    ];
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Test Form"
        fields={fields}
        initialValues={{ showRequired: true }}
        onSubmit={mockOnSubmit}
      />
    );

    // Submit form - visible required field should block submission
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);

    // onSubmit should NOT be called because the visible required field is empty
    expect(mockOnSubmit).not.toHaveBeenCalled();
    
    // Error message should be displayed
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });
});

// ============================================================================
// Unit Tests for FormModal
// ============================================================================

describe('FormModal - Unit Tests: Basic Functionality', () => {
  it('should render modal title', () => {
    const mockOnSubmit = vi.fn();
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Create Customer"
        fields={[]}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Create Customer')).toBeInTheDocument();
  });

  it('should render modal description when provided', () => {
    const mockOnSubmit = vi.fn();
    
    render(
      <FormModal
        open={true}
        onOpenChange={() => {}}
        title="Create Customer"
        description="Fill in the details below"
        fields={[]}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Fill in the details below')).toBeInTheDocument();
  });

  it('should not render modal when open is false', () => {
    const mockOnSubmit = vi.fn();
    
    render(
      <FormModal
        open={false}
        onOpenChange={() => {}}
        title="Test Form"
        fields={[]}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.queryByText('Test Form')).not.toBeInTheDocument();
  });

  it('should call onOpenChange when cancel button is clicked', () => {
    const mockOnSubmit = vi.fn();
    const mockOnOpenChange = vi.fn();
    
    render(
      <FormModal
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Test Form"
        fields={[]}
        onSubmit={mockOnSubmit}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});