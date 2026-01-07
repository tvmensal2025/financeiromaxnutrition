import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, User, Phone, CalendarDays, RefreshCw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ScheduledMessagesListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduledMessagesListModal({ open, onOpenChange }: ScheduledMessagesListModalProps) {
  const { business } = useAuth();
  const queryClient = useQueryClient();

  const { data: scheduledMessages = [], isLoading } = useQuery({
    queryKey: ['scheduled-messages', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select(`
          *,
          lead:leads(name),
          customer:customers(name)
        `)
        .eq('business_id', business.id)
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!business?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem agendada excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir mensagem');
    },
  });

  const getContactName = (msg: any) => {
    if (msg.lead?.name) return msg.lead.name;
    if (msg.customer?.name) return msg.customer.name;
    if (msg.phone?.startsWith('group:')) return 'Grupo';
    return msg.phone;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Enviada</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingMessages = scheduledMessages.filter(m => m.status === 'pending');
  const sentMessages = scheduledMessages.filter(m => m.status !== 'pending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Mensagens Agendadas
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : scheduledMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhuma mensagem agendada</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Messages */}
              {pendingMessages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pendentes ({pendingMessages.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1 text-sm font-medium">
                                <User className="h-3.5 w-3.5" />
                                {getContactName(msg)}
                              </div>
                              {getStatusBadge(msg.status)}
                              {msg.is_recurring && (
                                <Badge variant="secondary" className="gap-1">
                                  <RefreshCw className="h-3 w-3" />
                                  {msg.recurrence_pattern === 'daily' ? 'Diário' : 
                                   msg.recurrence_pattern === 'weekly' ? 'Semanal' : 'Mensal'}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {msg.phone}
                            </div>
                            
                            <div className="flex items-center gap-1 text-sm text-primary font-medium">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                            
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {msg.message}
                            </p>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteMutation.mutate(msg.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent Messages */}
              {sentMessages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    Histórico ({sentMessages.length})
                  </h3>
                  <div className="space-y-2">
                    {sentMessages.slice(0, 20).map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-sm">
                              <User className="h-3.5 w-3.5" />
                              {getContactName(msg)}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                            {getStatusBadge(msg.status)}
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
