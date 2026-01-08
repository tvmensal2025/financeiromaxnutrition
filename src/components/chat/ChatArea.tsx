import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Phone, MessageCircle, ArrowLeft, Sparkles, UsersRound, MoreVertical, Pin, Tag, Target, UserCheck, ShoppingCart, UserPlus, Search, Video } from 'lucide-react';
import { ChatMessage, Message } from './ChatMessage';
import { ChatInput, TemplateButton } from './ChatInput';
import type { ConversationStatus } from './ConversationsList';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { QuickSaleModal } from './QuickSaleModal';
import { ManageTagsModal } from './ManageTagsModal';
import { AssignAgentModal } from './AssignAgentModal';
import { CreateOpportunityModal } from './CreateOpportunityModal';
import { AddCustomerModal } from './AddCustomerModal';
import { MessageTemplatesModal } from './MessageTemplatesModal';

interface ChatAreaProps {
  phone: string | null;
  contactName: string | null;
  contactType: 'lead' | 'customer' | 'new' | 'group';
  conversationStatus?: ConversationStatus;
  messages: Message[];
  isLoading?: boolean;
  isSending?: boolean;
  onSend: (message: string, media?: { file: File; type: string }, buttons?: TemplateButton[]) => void;
  onConvertToCustomer?: () => void;
  onBack?: () => void;
  showBack?: boolean;
  onViewParticipants?: () => void;
  onUpdateConversationStatus?: (status: ConversationStatus) => void;
  leadId?: string | null;
  customerId?: string | null;
  email?: string | null;
}

export function ChatArea({
  phone,
  contactName,
  contactType,
  conversationStatus,
  messages,
  isLoading,
  isSending,
  onSend,
  onBack,
  showBack,
  onViewParticipants,
  onUpdateConversationStatus,
  leadId,
  customerId,
  email,
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Modal states
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showAssignAgent, setShowAssignAgent] = useState(false);
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Check if conversation is pinned
  const { data: isPinned } = useQuery({
    queryKey: ['pinned-conversation', business?.id, phone],
    queryFn: async () => {
      if (!business?.id || !phone) return false;
      const { data, error } = await supabase
        .from('pinned_conversations')
        .select('id')
        .eq('business_id', business.id)
        .eq('phone', phone)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!business?.id && !!phone,
  });

  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async () => {
      if (!business?.id || !phone) throw new Error('Dados inválidos');
      
      if (isPinned) {
        const { error } = await supabase
          .from('pinned_conversations')
          .delete()
          .eq('business_id', business.id)
          .eq('phone', phone);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pinned_conversations')
          .insert({
            business_id: business.id,
            phone: phone,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-conversation'] });
      toast({
        title: isPinned ? 'Conversa desfixada' : 'Conversa fixada!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  // Auto-scroll to bottom when messages change - FIX for ScrollArea
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollElement) {
          scrollElement.scrollTo({ 
            top: scrollElement.scrollHeight, 
            behavior: 'smooth' 
          });
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const isGroup = phone?.startsWith('group:') || contactType === 'group';

  if (!phone) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-8">
        <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/5 p-8 mb-6 animate-pulse-slow">
          <MessageCircle className="h-16 w-16 text-primary" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-3">
          Selecione uma conversa
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Escolha um contato na lista para visualizar o histórico e enviar mensagens
        </p>
      </div>
    );
  }

  const getInitials = (name: string | null, phone: string) => {
    if (isGroup) return 'GP';
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return phone.slice(-2);
  };

  const getTypeLabel = () => {
    if (isGroup) {
      return { label: 'Grupo', className: 'bg-purple-500/10 text-purple-500 border border-purple-500/20' };
    }
    switch (contactType) {
      case 'customer':
        return { label: 'Cliente', className: 'bg-success/10 text-success border border-success/20' };
      case 'lead':
        return { label: 'Lead', className: 'bg-warning/10 text-warning border border-warning/20' };
      default:
        return { label: 'Novo', className: 'bg-muted text-muted-foreground border border-border' };
    }
  };

  const typeInfo = getTypeLabel();

  // Format phone for display
  const formatPhone = (p: string) => {
    if (p.startsWith('group:')) return 'Grupo do WhatsApp';
    const cleaned = p.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return p;
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, Message[]>);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return 'Hoje';
    }
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return 'Ontem';
    }
    return format(date, "d 'de' MMMM", { locale: ptBR });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Compact Premium Header */}
      <div className="flex items-center gap-3 border-b border-border/50 bg-card/95 backdrop-blur-md px-3 py-2">
        {showBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        
        <div className="relative">
          <Avatar className={cn(
            'h-10 w-10 shrink-0 ring-2 ring-offset-1 ring-offset-card',
            isGroup ? 'ring-purple-500/40' : 'ring-primary/40'
          )}>
            <AvatarFallback className={cn(
              'font-semibold text-sm',
              isGroup 
                ? 'bg-purple-500/10 text-purple-500' 
                : 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
            )}>
              {isGroup ? <UsersRound className="h-4 w-4" /> : getInitials(contactName, phone)}
            </AvatarFallback>
          </Avatar>
          <span className="status-dot online" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-foreground truncate">
              {contactName || (isGroup ? 'Grupo' : formatPhone(phone))}
            </h3>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', typeInfo.className)}>
              {typeInfo.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {isGroup ? 'Toque para ver participantes' : formatPhone(phone)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {isGroup && onViewParticipants && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onViewParticipants}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              <UsersRound className="h-4 w-4" />
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Video className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* Pin conversation */}
              <DropdownMenuItem
                onSelect={() => togglePinMutation.mutate()}
                disabled={togglePinMutation.isPending}
              >
                <Pin className={cn("mr-2 h-4 w-4", isPinned && "text-primary")} />
                {isPinned ? 'Desafixar' : 'Fixar conversa'}
              </DropdownMenuItem>
              
              {/* Tags */}
              <DropdownMenuItem onSelect={() => setShowManageTags(true)}>
                <Tag className="mr-2 h-4 w-4" />
                Etiquetas
              </DropdownMenuItem>
              
              {/* Assign agent */}
              <DropdownMenuItem onSelect={() => setShowAssignAgent(true)}>
                <UserCheck className="mr-2 h-4 w-4" />
                Atribuir atendente
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              
              {/* Quick actions for leads/new contacts */}
              {!isGroup && (contactType === 'lead' || contactType === 'new') && (
                <>
                  <DropdownMenuItem onSelect={() => setShowAddCustomer(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Converter para cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setShowQuickSale(true)}>
                    <ShoppingCart className="mr-2 h-4 w-4 text-success" />
                    Venda rápida
                  </DropdownMenuItem>
                </>
              )}
              
              {/* Quick actions for customers */}
              {!isGroup && contactType === 'customer' && (
                <>
                  <DropdownMenuItem onSelect={() => setShowQuickSale(true)}>
                    <ShoppingCart className="mr-2 h-4 w-4 text-success" />
                    Venda rápida
                  </DropdownMenuItem>
                </>
              )}

              {/* Create opportunity */}
              {!isGroup && (
                <DropdownMenuItem onSelect={() => setShowCreateOpportunity(true)}>
                  <Target className="mr-2 h-4 w-4 text-warning" />
                  Criar oportunidade
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              
              {/* Status submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Status da conversa
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onSelect={() => onUpdateConversationStatus?.('waiting')}
                    className={cn(conversationStatus === 'waiting' || conversationStatus === 'pending' ? 'bg-accent' : '')}
                  >
                    Esperando
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onUpdateConversationStatus?.('inbox')}
                    className={cn(conversationStatus === 'inbox' ? 'bg-accent' : '')}
                  >
                    Entrada
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onUpdateConversationStatus?.('finished')}
                    className={cn(conversationStatus === 'finished' ? 'bg-accent' : '')}
                  >
                    Finalizado
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 chat-container" ref={scrollRef}>
        <div className="px-4 py-2 min-h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Carregando...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/5 p-4 mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <p className="font-medium text-foreground mb-1">
                Inicie a conversa
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Envie a primeira mensagem
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-card/90 backdrop-blur-sm border border-border/30 text-muted-foreground text-[11px] font-medium px-3 py-1 rounded-full shadow-sm">
                      {formatDateHeader(date)}
                    </div>
                  </div>

                  {/* Messages for this date */}
                  {msgs.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput 
        onSend={onSend} 
        disabled={!phone} 
        isSending={isSending} 
        businessId={business?.id}
        onManageTemplates={() => setShowTemplatesModal(true)}
      />

      {/* Modals */}
      {phone && (
        <>
          <QuickSaleModal
            open={showQuickSale}
            onOpenChange={setShowQuickSale}
            phone={phone}
            name={contactName}
            email={email}
            leadId={leadId}
            customerId={customerId}
          />
          
          <ManageTagsModal
            open={showManageTags}
            onOpenChange={setShowManageTags}
            phone={phone}
          />
          
          <AssignAgentModal
            open={showAssignAgent}
            onOpenChange={setShowAssignAgent}
            phone={phone}
          />
          
          <CreateOpportunityModal
            open={showCreateOpportunity}
            onOpenChange={setShowCreateOpportunity}
            leadId={leadId}
            customerId={customerId}
            contactName={contactName}
          />
          
          <AddCustomerModal
            open={showAddCustomer}
            onOpenChange={setShowAddCustomer}
            phone={phone}
            name={contactName}
            email={email}
            leadId={leadId}
          />
          
          <MessageTemplatesModal
            open={showTemplatesModal}
            onOpenChange={setShowTemplatesModal}
          />
        </>
      )}
    </div>
  );
}
