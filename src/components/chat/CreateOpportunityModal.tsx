import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Target } from 'lucide-react';
import { FormModal, FormField } from '@/components/common/FormModal';

interface CreateOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  customerId?: string | null;
  contactName?: string | null;
}

const STAGES = [
  { value: 'prospecting', label: 'Prospecção' },
  { value: 'qualification', label: 'Qualificação' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'closed_won', label: 'Fechado (Ganho)' },
  { value: 'closed_lost', label: 'Fechado (Perdido)' },
];

/**
 * CreateOpportunityModal - Refactored to use FormModal
 * 
 * Creates a new sales opportunity for a contact (lead or customer).
 * Uses the generic FormModal component for consistent form handling.
 * 
 * Requirements: 8.2, 8.5, 8.6
 */
export function CreateOpportunityModal({
  open,
  onOpenChange,
  leadId,
  customerId,
  contactName,
}: CreateOpportunityModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Define form fields configuration
  const fields: FormField[] = [
    {
      name: 'title',
      label: 'Título',
      type: 'text',
      placeholder: 'Nome da oportunidade',
      required: true,
      defaultValue: contactName ? `Oportunidade - ${contactName}` : '',
    },
    {
      name: 'value',
      label: 'Valor (R$)',
      type: 'number',
      placeholder: '0,00',
      min: 0,
      step: 0.01,
      defaultValue: '',
    },
    {
      name: 'probability',
      label: 'Probabilidade (%)',
      type: 'number',
      placeholder: '50',
      min: 0,
      max: 100,
      defaultValue: '50',
    },
    {
      name: 'stage',
      label: 'Estágio',
      type: 'select',
      options: STAGES,
      defaultValue: 'prospecting',
    },
    {
      name: 'expected_close_date',
      label: 'Data Prevista de Fechamento',
      type: 'date',
      defaultValue: '',
    },
    {
      name: 'description',
      label: 'Descrição',
      type: 'textarea',
      placeholder: 'Detalhes sobre a oportunidade...',
      rows: 3,
      defaultValue: '',
    },
  ];

  const mutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (!business?.id) throw new Error('Negócio não encontrado');

      const { data, error } = await supabase
        .from('opportunities')
        .insert({
          business_id: business.id,
          lead_id: leadId || null,
          customer_id: customerId || null,
          title: values.title,
          value: parseFloat(values.value) || 0,
          stage: values.stage as any,
          probability: parseInt(values.probability) || 50,
          expected_close_date: values.expected_close_date || null,
          description: values.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, values) => {
      toast({
        title: 'Oportunidade criada!',
        description: `${values.title} foi adicionada ao pipeline.`,
      });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Create opportunity error:', error);
      toast({
        title: 'Erro ao criar oportunidade',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (values: Record<string, any>) => {
    await mutation.mutateAsync(values);
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Criar Oportunidade"
      description="Crie uma nova oportunidade de venda para este contato."
      icon={Target}
      fields={fields}
      onSubmit={handleSubmit}
      isLoading={mutation.isPending}
      submitLabel="Criar Oportunidade"
      cancelLabel="Cancelar"
    />
  );
}
