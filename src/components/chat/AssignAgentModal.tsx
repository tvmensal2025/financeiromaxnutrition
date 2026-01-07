import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, UserCheck, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssignAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  currentAssignedTo?: string | null;
}

export function AssignAgentModal({
  open,
  onOpenChange,
  phone,
  currentAssignedTo,
}: AssignAgentModalProps) {
  const { business, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(currentAssignedTo || null);

  // Fetch profiles for this business (team members)
  const { data: agents, isLoading } = useQuery({
    queryKey: ['team-members', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .eq('business_id', business.id)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!business?.id && open,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error('Negócio não encontrado');
      
      // Update all messages for this phone with the assigned agent
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ assigned_to: selectedAgentId })
        .eq('phone', phone)
        .eq('business_id', business.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      const agent = agents?.find(a => a.id === selectedAgentId);
      toast({
        title: selectedAgentId 
          ? `Atribuído a ${agent?.full_name || 'agente'}!` 
          : 'Atribuição removida!',
      });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atribuir',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Atribuir Atendente
          </DialogTitle>
          <DialogDescription>
            Selecione quem será responsável por esta conversa.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-64">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents && agents.length > 0 ? (
            <div className="space-y-2">
              {/* Option to unassign */}
              <div
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer',
                  selectedAgentId === null ? 'bg-accent' : 'hover:bg-muted/50'
                )}
                onClick={() => setSelectedAgentId(null)}
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <X className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Sem atribuição</p>
                  <p className="text-xs text-muted-foreground">Qualquer um pode atender</p>
                </div>
                {selectedAgentId === null && (
                  <Check className="h-5 w-5 text-success" />
                )}
              </div>

              {agents.map((agent) => {
                const isCurrentUser = agent.id === user?.id;
                return (
                  <div
                    key={agent.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer',
                      selectedAgentId === agent.id ? 'bg-accent' : 'hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(agent.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{agent.full_name || 'Sem nome'}</p>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Você
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{agent.role || 'Membro'}</p>
                    </div>
                    {selectedAgentId === agent.id && (
                      <Check className="h-5 w-5 text-success" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum membro da equipe encontrado.
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}