import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormModal } from '@/components/common/FormModal';

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string | null;
  contactName?: string | null;
  onNeedCustomer?: () => void;
}

export function CreateInvoiceModal({
  open,
  onOpenChange,
  customerId,
  contactName,
  onNeedCustomer,
}: CreateInvoiceModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (formData: any) => {
      if (!business?.id) throw new Error('Negócio não encontrado');
      if (!customerId) throw new Error('Cliente não encontrado');

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const total = parseFloat(formData.value) || 0;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          business_id: business.id,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          subtotal: total,
          discount: 0,
          total,
          due_date: formData.due_date,
          notes: formData.notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice item
      const { error: itemError } = await supabase.from('invoice_items').insert({
        invoice_id: invoice.id,
        description: formData.description,
        quantity: 1,
        unit_price: total,
        total,
      });

      if (itemError) throw itemError;

      return invoice;
    },
    onSuccess: (invoice) => {
      toast({
        title: 'Fatura criada!',
        description: `Fatura ${invoice.invoice_number} criada com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error) => {
      console.error('Create invoice error:', error);
      toast({
        title: 'Erro ao criar fatura',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const fields = [
    {
      name: 'description',
      label: 'Descrição',
      type: 'text' as const,
      placeholder: 'Serviço ou produto',
      required: true,
    },
    {
      name: 'value',
      label: 'Valor (R$)',
      type: 'number' as const,
      placeholder: '0,00',
      required: true,
      min: 0,
      step: 0.01,
    },
    {
      name: 'due_date',
      label: 'Vencimento',
      type: 'date' as const,
      required: true,
    },
    {
      name: 'notes',
      label: 'Observações',
      type: 'textarea' as const,
      placeholder: 'Observações da fatura...',
      rows: 3,
    },
  ];

  // If no customer, show alert
  if (!customerId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Criar Cobrança
            </DialogTitle>
          </DialogHeader>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Para criar uma cobrança, primeiro você precisa converter este contato em
              cliente.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                onNeedCustomer?.();
              }}
            >
              Converter para Cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Criar Cobrança"
      description={`Crie uma fatura para ${contactName || 'este cliente'}.`}
      icon={FileText}
      fields={fields}
      onSubmit={mutation.mutate}
      submitLabel="Criar Fatura"
      isLoading={mutation.isPending}
    />
  );
}
