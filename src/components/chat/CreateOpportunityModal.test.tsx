/**
 * Tests for CreateOpportunityModal
 * 
 * Verifies that the refactored modal using FormModal maintains
 * all functionality and validation.
 * 
 * Requirements: 8.2, 8.5, 8.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateOpportunityModal } from './CreateOpportunityModal';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: '1' }, error: null })),
        })),
      })),
    })),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    business: { id: 'business-1', name: 'Test Business' },
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('CreateOpportunityModal', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with all form fields', () => {
    render(
      <CreateOpportunityModal
        open={true}
        onOpenChange={mockOnOpenChange}
        leadId="lead-1"
        customerId={null}
        contactName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    // Verify modal title and description
    expect(screen.getByText('Criar Oportunidade')).toBeInTheDocument();
    expect(screen.getByText('Crie uma nova oportunidade de venda para este contato.')).toBeInTheDocument();

    // Verify all form fields are present
    expect(screen.getByLabelText(/Título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor \(R\$\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Probabilidade \(%\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estágio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Data Prevista de Fechamento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Descrição/i)).toBeInTheDocument();

    // Verify buttons
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar Oportunidade/i })).toBeInTheDocument();
  });

  it('pre-fills title with contact name when provided', () => {
    render(
      <CreateOpportunityModal
        open={true}
        onOpenChange={mockOnOpenChange}
        leadId="lead-1"
        customerId={null}
        contactName="Jane Smith"
      />,
      { wrapper: createWrapper() }
    );

    const titleInput = screen.getByLabelText(/Título/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Oportunidade - Jane Smith');
  });

  it('sets default values correctly', () => {
    render(
      <CreateOpportunityModal
        open={true}
        onOpenChange={mockOnOpenChange}
        leadId={null}
        customerId={null}
        contactName={null}
      />,
      { wrapper: createWrapper() }
    );

    // Check default probability value
    const probabilityInput = screen.getByLabelText(/Probabilidade \(%\)/i) as HTMLInputElement;
    expect(probabilityInput.value).toBe('50');
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateOpportunityModal
        open={true}
        onOpenChange={mockOnOpenChange}
        leadId={null}
        customerId={null}
        contactName={null}
      />,
      { wrapper: createWrapper() }
    );

    // Clear the title field
    const titleInput = screen.getByLabelText(/Título/i);
    await user.clear(titleInput);

    // Try to submit
    const submitButton = screen.getByRole('button', { name: /Criar Oportunidade/i });
    await user.click(submitButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
    });
  });

  it('allows form submission with valid data', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateOpportunityModal
        open={true}
        onOpenChange={mockOnOpenChange}
        leadId="lead-1"
        customerId={null}
        contactName="Test Contact"
      />,
      { wrapper: createWrapper() }
    );

    // Fill in the form
    const titleInput = screen.getByLabelText(/Título/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'New Opportunity');

    const valueInput = screen.getByLabelText(/Valor \(R\$\)/i);
    await user.type(valueInput, '5000');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Criar Oportunidade/i });
    await user.click(submitButton);

    // Form should submit without validation errors
    await waitFor(() => {
      expect(screen.queryByText('Campo obrigatório')).not.toBeInTheDocument();
    });
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateOpportunityModal
        open={true}
        onOpenChange={mockOnOpenChange}
        leadId={null}
        customerId={null}
        contactName={null}
      />,
      { wrapper: createWrapper() }
    );

    const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('preserves all field types from original implementation', () => {
    render(
      <CreateOpportunityModal
        open={true}
        onOpenChange={mockOnOpenChange}
        leadId={null}
        customerId={null}
        contactName={null}
      />,
      { wrapper: createWrapper() }
    );

    // Verify field types
    const titleInput = screen.getByLabelText(/Título/i);
    expect(titleInput).toHaveAttribute('type', 'text');

    const valueInput = screen.getByLabelText(/Valor \(R\$\)/i);
    expect(valueInput).toHaveAttribute('type', 'number');
    expect(valueInput).toHaveAttribute('min', '0');
    expect(valueInput).toHaveAttribute('step', '0.01');

    const probabilityInput = screen.getByLabelText(/Probabilidade \(%\)/i);
    expect(probabilityInput).toHaveAttribute('type', 'number');
    expect(probabilityInput).toHaveAttribute('min', '0');
    expect(probabilityInput).toHaveAttribute('max', '100');

    const dateInput = screen.getByLabelText(/Data Prevista de Fechamento/i);
    expect(dateInput).toHaveAttribute('type', 'date');

    // Verify textarea
    const descriptionInput = screen.getByLabelText(/Descrição/i);
    expect(descriptionInput.tagName).toBe('TEXTAREA');
  });
});
