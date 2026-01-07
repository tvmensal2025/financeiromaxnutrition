import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Send, Users, User, UsersRound, Search, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Conversation } from './ConversationsList';

interface BulkMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  onOpenTemplates: () => void;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
}

export function BulkMessageModal({
  open,
  onOpenChange,
  conversations,
  onOpenTemplates,
}: BulkMessageModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'leads' | 'customers' | 'groups'>('all');
  const [search, setSearch] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['message-templates', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: !!business?.id && open,
  });

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const isGroup = conv.phone.startsWith('group:') || conv.is_group;
      const matchesSearch =
        conv.sender_name?.toLowerCase().includes(search.toLowerCase()) ||
        conv.phone.includes(search);

      if (!matchesSearch) return false;

      switch (filterType) {
        case 'groups':
          return isGroup;
        case 'leads':
          return conv.lead_id && !conv.customer_id && !isGroup;
        case 'customers':
          return conv.customer_id && !isGroup;
        default:
          return true;
      }
    });
  }, [conversations, filterType, search]);

  const handleTogglePhone = (phone: string) => {
    const newSet = new Set(selectedPhones);
    if (newSet.has(phone)) {
      newSet.delete(phone);
    } else {
      newSet.add(phone);
    }
    setSelectedPhones(newSet);
  };

  const handleSelectAll = () => {
    if (selectedPhones.size === filteredConversations.length) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(new Set(filteredConversations.map((c) => c.phone)));
    }
  };

  const handleSelectTemplate = (content: string) => {
    setMessage(content);
  };

  const sendBulkMutation = useMutation({
    mutationFn: async () => {
      if (!business?.id || selectedPhones.size === 0) return;

      setIsSending(true);
      const phones = Array.from(selectedPhones);
      const results = [];

      for (const phone of phones) {
        const conv = conversations.find((c) => c.phone === phone);
        
        // Replace variables
        let personalizedMessage = message;
        personalizedMessage = personalizedMessage.replace(/\{\{nome\}\}/g, conv?.sender_name || 'Cliente');
        personalizedMessage = personalizedMessage.replace(/\{\{telefone\}\}/g, phone);
        personalizedMessage = personalizedMessage.replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'));
        personalizedMessage = personalizedMessage.replace(/\{\{hora\}\}/g, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

        try {
          const { data, error } = await supabase.functions.invoke('send-evolution-message', {
            body: {
              phone,
              message: personalizedMessage,
              business_id: business.id,
              lead_id: conv?.lead_id,
              customer_id: conv?.customer_id,
            },
          });

          results.push({ phone, success: !error && data?.success, error: error?.message });
          
          // Add small delay between messages to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (err) {
          results.push({ phone, success: false, error: String(err) });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setIsSending(false);
      const successCount = results?.filter((r) => r.success).length || 0;
      const failCount = (results?.length || 0) - successCount;

      toast({
        title: 'Disparo concluído!',
        description: `${successCount} mensagem(ns) enviada(s)${failCount > 0 ? `, ${failCount} falha(s)` : ''}.`,
      });

      setSelectedPhones(new Set());
      setMessage('');
      onOpenChange(false);
    },
    onError: () => {
      setIsSending(false);
      toast({
        title: 'Erro no disparo',
        description: 'Ocorreu um erro ao enviar as mensagens.',
        variant: 'destructive',
      });
    },
  });

  const formatPhone = (p: string) => {
    if (p.startsWith('group:')) return 'Grupo';
    const cleaned = p.replace(/\D/g, '');
    if (cleaned.length >= 11) {
      return `(${cleaned.slice(-11, -9)}) ${cleaned.slice(-9, -4)}-${cleaned.slice(-4)}`;
    }
    return p;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Disparo em Massa
          </DialogTitle>
          <DialogDescription>
            Selecione os contatos e envie mensagens personalizadas para todos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* Seleção de contatos */}
          <div className="flex flex-col min-h-0">
            <div className="space-y-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar contatos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Tabs value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">Todos</TabsTrigger>
                  <TabsTrigger value="groups" className="flex-1">Grupos</TabsTrigger>
                  <TabsTrigger value="leads" className="flex-1">Leads</TabsTrigger>
                  <TabsTrigger value="customers" className="flex-1">Clientes</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={handleSelectAll}>
                  {selectedPhones.size === filteredConversations.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
                <Badge variant="secondary">
                  {selectedPhones.size} selecionado(s)
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredConversations.map((conv) => {
                  const isGroup = conv.phone.startsWith('group:') || conv.is_group;
                  const isSelected = selectedPhones.has(conv.phone);

                  return (
                    <label
                      key={conv.phone}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleTogglePhone(conv.phone)}
                      />
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={cn(
                            'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                            isGroup
                              ? 'bg-purple-500/10 text-purple-500'
                              : conv.customer_id
                              ? 'bg-success/10 text-success'
                              : 'bg-warning/10 text-warning'
                          )}
                        >
                          {isGroup ? (
                            <UsersRound className="h-4 w-4" />
                          ) : conv.customer_id ? (
                            <Users className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {isGroup ? conv.group_name || 'Grupo' : conv.sender_name || formatPhone(conv.phone)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {isGroup ? `${conv.participant_count || 0} membros` : formatPhone(conv.phone)}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Mensagem */}
          <div className="flex flex-col min-h-0 gap-3">
            <div className="flex items-center justify-between">
              <Label>Mensagem</Label>
              <Button size="sm" variant="outline" onClick={onOpenTemplates}>
                <FileText className="h-4 w-4 mr-1" />
                Modelos
              </Button>
            </div>

            {templates.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {templates.slice(0, 3).map((t) => (
                  <Badge
                    key={t.id}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleSelectTemplate(t.content)}
                  >
                    {t.name}
                  </Badge>
                ))}
                {templates.length > 3 && (
                  <Badge variant="outline" className="cursor-pointer" onClick={onOpenTemplates}>
                    +{templates.length - 3} mais
                  </Badge>
                )}
              </div>
            )}

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem aqui...&#10;&#10;Use variáveis como {{nome}}, {{telefone}}, {{data}}, {{hora}}"
              className="flex-1 min-h-[200px] resize-none"
            />

            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <p className="font-medium mb-1">Variáveis disponíveis:</p>
              <p>{'{{nome}}'} - Nome do contato</p>
              <p>{'{{telefone}}'} - Número de telefone</p>
              <p>{'{{data}}'} - Data atual</p>
              <p>{'{{hora}}'} - Hora atual</p>
            </div>

            <Button
              className="w-full"
              disabled={selectedPhones.size === 0 || !message.trim() || isSending}
              onClick={() => sendBulkMutation.mutate()}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para {selectedPhones.size} contato(s)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
