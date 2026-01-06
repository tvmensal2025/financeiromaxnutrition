import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Clock } from 'lucide-react';

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

  const [formData, setFormData] = useState({
    message: '',
    date: '',
    time: '',
    is_recurring: false,
    recurrence_pattern: 'none',
    recurrence_end_date: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
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
    onSuccess: () => {
      toast({
        title: 'Mensagem agendada!',
        description: `Mensagem será enviada em ${formData.date} às ${formData.time}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      onOpenChange(false);
      setFormData({
        message: '',
        date: '',
        time: '',
        is_recurring: false,
        recurrence_pattern: 'none',
        recurrence_end_date: '',
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Agendar Mensagem
          </DialogTitle>
          <DialogDescription>
            Agende uma mensagem para {contactName || phone}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Digite a mensagem a ser enviada..."
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                min={today}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora *</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="recurring">Mensagem Recorrente</Label>
              <p className="text-xs text-muted-foreground">
                Enviar automaticamente de forma periódica
              </p>
            </div>
            <Switch
              id="recurring"
              checked={formData.is_recurring}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_recurring: checked })
              }
            />
          </div>

          {formData.is_recurring && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recurrence">Frequência</Label>
                <Select
                  value={formData.recurrence_pattern}
                  onValueChange={(value) =>
                    setFormData({ ...formData, recurrence_pattern: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a frequência" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurrence_end">Data Final (opcional)</Label>
                <Input
                  id="recurrence_end"
                  type="date"
                  min={formData.date || today}
                  value={formData.recurrence_end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, recurrence_end_date: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para continuar indefinidamente
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending || !formData.message || !formData.date || !formData.time
              }
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agendar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
