import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, MessageCircle, User, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface Conversation {
  phone: string;
  sender_name: string | null;
  lead_id: string | null;
  customer_id: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  direction: 'inbound' | 'outbound';
}

interface ConversationsListProps {
  conversations: Conversation[];
  selectedPhone: string | null;
  onSelectConversation: (phone: string) => void;
  isLoading?: boolean;
}

type FilterType = 'all' | 'unread' | 'leads' | 'customers';

export function ConversationsList({
  conversations,
  selectedPhone,
  onSelectConversation,
  isLoading,
}: ConversationsListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.sender_name?.toLowerCase().includes(search.toLowerCase()) ||
      conv.phone.includes(search) ||
      conv.last_message.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    switch (filter) {
      case 'unread':
        return conv.unread_count > 0;
      case 'leads':
        return conv.lead_id && !conv.customer_id;
      case 'customers':
        return conv.customer_id;
      default:
        return true;
    }
  });

  const getInitials = (name: string | null, phone: string) => {
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
    const cleaned = p.replace(/\D/g, '');
    if (cleaned.length >= 11) {
      return `(${cleaned.slice(-11, -9)}) ${cleaned.slice(-9, -4)}-${cleaned.slice(-4)}`;
    }
    return p;
  };

  const filters: { value: FilterType; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Todos', icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { value: 'unread', label: 'Não lidos', icon: <span className="h-2 w-2 rounded-full bg-primary" /> },
    { value: 'leads', label: 'Leads', icon: <User className="h-3.5 w-3.5" /> },
    { value: 'customers', label: 'Clientes', icon: <Users className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {conversations.length}
          </span>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                filter === f.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted'
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
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="rounded-full bg-muted p-3 mb-3">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nenhuma conversa</p>
            <p className="text-xs text-muted-foreground">
              As mensagens aparecerão aqui
            </p>
          </div>
        ) : (
          <div>
            {filteredConversations.map((conv, idx) => (
              <button
                key={conv.phone}
                onClick={() => onSelectConversation(conv.phone)}
                className={cn(
                  'flex w-full items-start gap-3 p-4 text-left transition-all hover:bg-muted/50',
                  selectedPhone === conv.phone && 'bg-primary/5 border-l-2 border-l-primary',
                  idx !== 0 && 'border-t border-border/50'
                )}
              >
                <div className="relative">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarFallback 
                      className={cn(
                        'font-semibold text-sm',
                        conv.customer_id 
                          ? 'bg-success/10 text-success'
                          : conv.lead_id
                          ? 'bg-warning/10 text-warning'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {getInitials(conv.sender_name, conv.phone)}
                    </AvatarFallback>
                  </Avatar>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-card" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-semibold text-foreground truncate text-sm">
                      {conv.sender_name || formatPhone(conv.phone)}
                    </span>
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
                      <Badge className="h-5 min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>

                  {/* Type indicator */}
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
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}