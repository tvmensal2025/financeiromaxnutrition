import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Plus, Trash2, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface RemindersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone?: string;
  contactName?: string;
  customerId?: string;
  leadId?: string;
}

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  is_completed: boolean;
  phone: string | null;
}

export function RemindersModal({ open, onOpenChange, phone, contactName, customerId, leadId }: RemindersModalProps) {
  const { business, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remindAt, setRemindAt] = useState('');

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders', business?.id, phone],
    queryFn: async () => {
      let query = supabase
        .from('reminders')
        .select('*')
        .eq('business_id', business?.id)
        .order('remind_at', { ascending: true });
      
      if (phone) {
        query = query.eq('phone', phone);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Reminder[];
    },
    enabled: open && !!business?.id,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reminders').insert({
        business_id: business?.id,
        phone: phone || null,
        customer_id: customerId || null,
        lead_id: leadId || null,
        title,
        description: description || null,
        remind_at: new Date(remindAt).toISOString(),
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      resetForm();
      toast.success('Lembrete criado');
    },
    onError: () => toast.error('Erro ao criar lembrete'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: completed })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Lembrete removido');
    },
    onError: () => toast.error('Erro ao remover lembrete'),
  });

  const resetForm = () => {
    setIsAdding(false);
    setTitle('');
    setDescription('');
    setRemindAt('');
  };

  const pendingReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);

  const isOverdue = (date: string) => new Date(date) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Lembretes {contactName && `- ${contactName}`}
          </DialogTitle>
        </DialogHeader>

        {isAdding ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Ligar para o cliente"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data e Hora *</Label>
              <Input
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button 
                onClick={() => addMutation.mutate()} 
                disabled={!title || !remindAt || addMutation.isPending}
              >
                Criar Lembrete
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="outline" className="w-full" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo Lembrete
            </Button>

            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : reminders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum lembrete</p>
              ) : (
                <div className="space-y-4">
                  {pendingReminders.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Pendentes</h4>
                      {pendingReminders.map((reminder) => (
                        <ReminderItem
                          key={reminder.id}
                          reminder={reminder}
                          isOverdue={isOverdue(reminder.remind_at)}
                          onToggle={() => toggleMutation.mutate({ id: reminder.id, completed: true })}
                          onDelete={() => deleteMutation.mutate(reminder.id)}
                        />
                      ))}
                    </div>
                  )}
                  
                  {completedReminders.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Concluídos</h4>
                      {completedReminders.map((reminder) => (
                        <ReminderItem
                          key={reminder.id}
                          reminder={reminder}
                          isOverdue={false}
                          onToggle={() => toggleMutation.mutate({ id: reminder.id, completed: false })}
                          onDelete={() => deleteMutation.mutate(reminder.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReminderItem({ 
  reminder, 
  isOverdue, 
  onToggle, 
  onDelete 
}: { 
  reminder: Reminder; 
  isOverdue: boolean; 
  onToggle: () => void; 
  onDelete: () => void;
}) {
  return (
    <div className={`p-3 rounded-lg border ${reminder.is_completed ? 'bg-muted/30 opacity-60' : isOverdue ? 'border-destructive/50 bg-destructive/5' : 'bg-card'}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={reminder.is_completed}
          onCheckedChange={onToggle}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${reminder.is_completed ? 'line-through text-muted-foreground' : ''}`}>
            {reminder.title}
          </p>
          {reminder.description && (
            <p className="text-xs text-muted-foreground mt-1">{reminder.description}</p>
          )}
          <div className={`flex items-center gap-1 mt-2 text-xs ${isOverdue && !reminder.is_completed ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="h-3 w-3" />
            {format(new Date(reminder.remind_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
            {isOverdue && !reminder.is_completed && <span className="ml-1 font-medium">(Atrasado)</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
