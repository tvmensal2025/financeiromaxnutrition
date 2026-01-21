import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Clock } from 'lucide-react';
import { FormModal } from '@/components/common/FormModal';

interface ScheduleMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  leadId?: string | null;
  customerId?: string | null;
  contactName?: string | null;
}

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Sem recorrência' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensalmente' },
];

export function ScheduleMessageModal({
  open,
  onOpenChange,
  phone,
  leadId,
  customerId,
  contactName,
}: ScheduleMessageModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (formData: any) => {
      if (!business?.id) throw new Error('Negócio não encontrado');

      const scheduledAt = new Date(`${formData.date}T${formData.time}`);

      const { data, error } = await supabase
        .from('scheduled_messages')
        .insert({
          business_id: business.id,
          phone,
          message: formData.message,
          lead_id: leadId || null,
          customer_id: customerId || null,
          scheduled_at: scheduledAt.toISOString(),
          is_recurring: formData.is_recurring && formData.recurrence_pattern !== 'none',
          recurrence_pattern:
            formData.is_recurring && formData.recurrence_pattern !== 'none'
              ? formData.recurrence_pattern
              : null,
          recurrence_end_date: formData.recurrence_end_date || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, formData) => {
      toast({
        title: 'Mensagem agendada!',
        description: `Mensagem será enviada em ${formData.date} às ${formData.time}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
    },
    onError: (error) => {
      console.error('Schedule message error:', error);
      toast({
        title: 'Erro ao agendar mensagem',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  const fields = [
    {
      name: 'message',
      label: 'Mensagem',
      type: 'textarea' as const,
      placeholder: 'Digite a mensagem a ser enviada...',
      rows: 4,
      required: true,
    },
    {
      name: 'date',
      label: 'Data',
      type: 'date' as const,
      required: true,
      min: today,
    },
    {
      name: 'time',
      label: 'Hora',
      type: 'time' as const,
      required: true,
    },
    {
      name: 'is_recurring',
      label: 'Mensagem Recorrente',
      type: 'switch' as const,
      description: 'Enviar automaticamente de forma periódica',
    },
    {
      name: 'recurrence_pattern',
      label: 'Frequência',
      type: 'select' as const,
      options: RECURRENCE_OPTIONS,
      visibleWhen: (data: any) => data.is_recurring === true,
    },
    {
      name: 'recurrence_end_date',
      label: 'Data Final (opcional)',
      type: 'date' as const,
      description: 'Deixe em branco para continuar indefinidamente',
      visibleWhen: (data: any) => data.is_recurring === true,
      min: today,
    },
  ];

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Agendar Mensagem"
      description={`Agende uma mensagem para ${contactName || phone}.`}
      icon={Clock}
      fields={fields}
      onSubmit={mutation.mutate}
      submitLabel="Agendar"
      isLoading={mutation.isPending}
    />
  );
}
