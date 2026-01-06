import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, MessageCircle, User, Users, UsersRound, Plus, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
}

interface ConversationsListProps {
  conversations: Conversation[];
  selectedPhone: string | null;
  onSelectConversation: (phone: string) => void;
  isLoading?: boolean;
}

type FilterType = 'all' | 'unread' | 'groups' | 'leads' | 'customers';
type StatusTab = 'entrada' | 'esperando' | 'resolvidos';

export function ConversationsList({
  conversations,
  selectedPhone,
  onSelectConversation,
  isLoading,
}: ConversationsListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusTab, setStatusTab] = useState<StatusTab>('entrada');

  // Categorize conversations by status
  const now = new Date();
  const categorizedConversations = conversations.reduce(
    (acc, conv) => {
      const lastMessageDate = new Date(conv.last_message_at);
      const hoursSinceLastMessage = (now.getTime() - lastMessageDate.getTime()) / (1000 * 60 * 60);
      
      if (conv.unread_count > 0 || hoursSinceLastMessage < 1) {
        // Active conversations (unread or recent)
        acc.entrada.push(conv);
      } else if (hoursSinceLastMessage < 24 && conv.direction === 'outbound') {
        // Waiting for client response (we sent last message within 24h)
        acc.esperando.push(conv);
      } else {
        // Resolved (no activity for 24h+)
        acc.resolvidos.push(conv);
      }
      return acc;
    },
    { entrada: [] as Conversation[], esperando: [] as Conversation[], resolvidos: [] as Conversation[] }
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
      case 'unread':
        return conv.unread_count > 0;
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

  const filters: { value: FilterType; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Todos', icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { value: 'groups', label: 'Grupos', icon: <UsersRound className="h-3.5 w-3.5" /> },
    { value: 'leads', label: 'Leads', icon: <User className="h-3.5 w-3.5" /> },
    { value: 'customers', label: 'Clientes', icon: <Users className="h-3.5 w-3.5" /> },
  ];

  const statusTabs: { value: StatusTab; label: string; count: number }[] = [
    { value: 'entrada', label: 'Entrada', count: categorizedConversations.entrada.length },
    { value: 'esperando', label: 'Esperando', count: categorizedConversations.esperando.length },
    { value: 'resolvidos', label: 'Resolvidos', count: categorizedConversations.resolvidos.length },
  ];

  return (
    <div className="flex h-full flex-col bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Conversas</h2>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              {conversations.length}
            </span>
          </div>
          <Button size="icon" className="h-9 w-9 rounded-full shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-background/50 border-border/50 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={cn(
                'status-tab flex-1 flex items-center justify-center gap-1.5',
                statusTab === tab.value && 'active'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  statusTab === tab.value 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted-foreground/20 text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                filter === f.value
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-background/80 text-muted-foreground hover:bg-accent hover:text-foreground border border-border/50'
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
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
              
              return (
                <button
                  key={conv.phone}
                  onClick={() => onSelectConversation(conv.phone)}
                  className={cn(
                    'conversation-card',
                    selectedPhone === conv.phone && 'active'
                  )}
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
                          {isGroup ? (conv.sender_name || 'Grupo') : (conv.sender_name || formatPhone(conv.phone))}
                        </span>
                        {isGroup && (
                          <span className="group-indicator">
                            <UsersRound className="h-2.5 w-2.5" />
                            Grupo
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

                    {/* Type indicator - only show for non-groups */}
                    {!isGroup && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {conv.customer_id ? (
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
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
