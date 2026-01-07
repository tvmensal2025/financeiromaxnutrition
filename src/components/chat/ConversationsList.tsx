import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MessageCircle, User, Users, UsersRound, Plus, Check, X, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ConversationStatus = 'pending' | 'inbox' | 'waiting' | 'finished';

export interface Conversation {
  phone: string;
  sender_name: string | null;
  lead_id: string | null;
  customer_id: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  direction: 'inbound' | 'outbound';
  is_group?: boolean;
  group_name?: string | null;
  participant_count?: number;
  avatar_url?: string | null;
  conversation_status?: ConversationStatus;
}

interface ConversationsListProps {
  conversations: Conversation[];
  selectedPhone: string | null;
  onSelectConversation: (phone: string) => void;
  onApproveConversation?: (phone: string) => void;
  onUpdateStatus?: (phone: string, status: ConversationStatus) => void;
  isLoading?: boolean;
  /** Mostra o título "Mensagens" + contador + botão "+" no topo da lista */
  showTitle?: boolean;
}

type FilterType = 'all' | 'groups' | 'leads' | 'customers';
type StatusTab = 'entrada' | 'esperando' | 'finalizado';

export function ConversationsList({
  conversations,
  selectedPhone,
  onSelectConversation,
  onApproveConversation,
  onUpdateStatus,
  isLoading,
  showTitle = true,
}: ConversationsListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusTab, setStatusTab] = useState<StatusTab>('esperando');

  // Categorize conversations by conversation_status from database
  const categorizedConversations = conversations.reduce(
    (acc, conv) => {
      const status = conv.conversation_status || 'pending';
      
      switch (status) {
        case 'pending':
        case 'waiting':
          // Unificado: pending e waiting vão para "esperando"
          acc.esperando.push(conv);
          break;
        case 'inbox':
          acc.entrada.push(conv);
          break;
        case 'finished':
          acc.finalizado.push(conv);
          break;
        default:
          acc.esperando.push(conv);
      }
      return acc;
    },
    { 
      entrada: [] as Conversation[], 
      esperando: [] as Conversation[], 
      finalizado: [] as Conversation[] 
    }
  );

  const currentConversations = categorizedConversations[statusTab];

  const filteredConversations = currentConversations.filter((conv) => {
    const matchesSearch =
      conv.sender_name?.toLowerCase().includes(search.toLowerCase()) ||
      conv.phone.includes(search) ||
      conv.last_message.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    const isGroup = conv.phone.startsWith('group:') || conv.is_group;

    switch (filter) {
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

  const getInitials = (name: string | null, phone: string, isGroup: boolean) => {
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

  const formatTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: false, locale: ptBR });
  };

  const formatPhone = (p: string) => {
    if (p.startsWith('group:')) return 'Grupo';
    const cleaned = p.replace(/\D/g, '');
    if (cleaned.length >= 11) {
      return `(${cleaned.slice(-11, -9)}) ${cleaned.slice(-9, -4)}-${cleaned.slice(-4)}`;
    }
    return p;
  };

  return (
    <div className="flex h-full flex-col bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-border p-3 space-y-2">
        {showTitle && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Mensagens</h2>
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {conversations.length}
              </span>
            </div>
            <Button size="icon" className="h-8 w-8 rounded-full shadow-md shadow-primary/20">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-background/50 border-border/50 rounded-lg"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-1">
          <button
            onClick={() => setStatusTab('esperando')}
            className={cn(
              'text-[10px] font-medium px-2 py-1 rounded transition-all',
              statusTab === 'esperando'
                ? 'bg-warning text-warning-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Esperando {categorizedConversations.esperando.length > 0 && `(${categorizedConversations.esperando.length})`}
          </button>
          <button
            onClick={() => setStatusTab('entrada')}
            className={cn(
              'text-[10px] font-medium px-2 py-1 rounded transition-all',
              statusTab === 'entrada'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Entrada {categorizedConversations.entrada.length > 0 && `(${categorizedConversations.entrada.length})`}
          </button>
          <button
            onClick={() => setStatusTab('finalizado')}
            className={cn(
              'text-[10px] font-medium px-2 py-1 rounded transition-all',
              statusTab === 'finalizado'
                ? 'bg-muted text-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Finalizado {categorizedConversations.finalizado.length > 0 && `(${categorizedConversations.finalizado.length})`}
          </button>
        </div>

        {/* Type Filters - Below */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'text-[10px] font-medium px-2 py-1 rounded transition-all',
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('groups')}
            className={cn(
              'text-[10px] font-medium px-2 py-1 rounded transition-all',
              filter === 'groups'
                ? 'bg-purple-500 text-white'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Grupos
          </button>
          <button
            onClick={() => setFilter('leads')}
            className={cn(
              'text-[10px] font-medium px-2 py-1 rounded transition-all',
              filter === 'leads'
                ? 'bg-warning text-warning-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Leads
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Carregando...</span>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="rounded-full bg-muted p-4 mb-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nenhuma conversa</p>
            <p className="text-xs text-muted-foreground">
              As mensagens aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="py-2">
            {filteredConversations.map((conv) => {
              const isGroup = conv.phone.startsWith('group:') || conv.is_group;
              const isWaiting = statusTab === 'esperando';
              
              return (
                <div
                  key={conv.phone}
                  className={cn(
                    'conversation-card',
                    selectedPhone === conv.phone && 'active'
                  )}
                >
                  <button 
                    onClick={() => onSelectConversation(conv.phone)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="relative">
                      <Avatar className={cn(
                        'h-12 w-12 shrink-0 ring-2 ring-offset-2 ring-offset-background transition-all',
                        isGroup 
                          ? 'ring-purple-500/30'
                          : conv.customer_id 
                            ? 'ring-success/30'
                            : conv.lead_id
                              ? 'ring-warning/30'
                              : 'ring-primary/30'
                      )}>
                        {conv.avatar_url && (
                          <AvatarImage 
                            src={conv.avatar_url} 
                            alt={conv.sender_name || 'Contato'} 
                          />
                        )}
                        <AvatarFallback 
                          className={cn(
                            'font-semibold text-sm',
                            isGroup
                              ? 'bg-purple-500/10 text-purple-500'
                              : conv.customer_id 
                                ? 'bg-success/10 text-success'
                                : conv.lead_id
                                  ? 'bg-warning/10 text-warning'
                                  : 'bg-primary/10 text-primary'
                          )}
                        >
                          {isGroup ? (
                            <UsersRound className="h-5 w-5" />
                          ) : (
                            getInitials(conv.sender_name, conv.phone, isGroup)
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {conv.unread_count > 0 && (
                        <span className="status-dot online" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-foreground truncate text-sm">
                            {isGroup ? (conv.group_name || conv.sender_name || 'Grupo') : (conv.sender_name || formatPhone(conv.phone))}
                          </span>
                          {isGroup && (
                            <span className="group-indicator">
                              <UsersRound className="h-2.5 w-2.5" />
                              {conv.participant_count ? `${conv.participant_count} membros` : 'Grupo'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.direction === 'outbound' && (
                            <span className="text-primary font-medium mr-1">Você:</span>
                          )}
                          {conv.last_message}
                        </p>
                        {conv.unread_count > 0 && (
                          <Badge className="h-5 min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-md shadow-primary/30">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>

                      {/* Type indicator */}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {isGroup ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded">
                            <UsersRound className="h-2.5 w-2.5" />
                            Grupo
                          </span>
                        ) : conv.customer_id ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                            <Users className="h-2.5 w-2.5" />
                            Cliente
                          </span>
                        ) : conv.lead_id ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                            <User className="h-2.5 w-2.5" />
                            Lead
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Novo
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Approval buttons for waiting conversations */}
                  {isWaiting && onApproveConversation && (
                    <div className="flex flex-col gap-1 ml-2 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 bg-success/10 hover:bg-success/20 text-success"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApproveConversation(conv.phone);
                        }}
                        title="Aprovar para Entrada"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus?.(conv.phone, 'finished');
                        }}
                        title="Arquivar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
