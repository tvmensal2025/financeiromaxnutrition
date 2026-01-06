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
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  const filters: { value: FilterType; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Todos', icon: <MessageCircle className="h-3 w-3" /> },
    { value: 'unread', label: 'Não lidos', icon: <Badge className="h-2 w-2 rounded-full bg-primary p-0" /> },
    { value: 'leads', label: 'Leads', icon: <User className="h-3 w-3" /> },
    { value: 'customers', label: 'Clientes', icon: <Users className="h-3 w-3" /> },
  ];

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-foreground mb-3">Conversas</h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                filter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
            <MessageCircle className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredConversations.map((conv) => (
              <button
                key={conv.phone}
                onClick={() => onSelectConversation(conv.phone)}
                className={cn(
                  'flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50',
                  selectedPhone === conv.phone && 'bg-muted'
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getInitials(conv.sender_name, conv.phone)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">
                      {conv.sender_name || conv.phone}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.direction === 'outbound' && (
                        <span className="text-primary mr-1">Você:</span>
                      )}
                      {conv.last_message}
                    </p>
                    {conv.unread_count > 0 && (
                      <Badge className="h-5 min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>

                  {/* Type indicator */}
                  <div className="mt-1">
                    {conv.customer_id ? (
                      <span className="text-xs text-success">Cliente</span>
                    ) : conv.lead_id ? (
                      <span className="text-xs text-warning">Lead</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Novo</span>
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