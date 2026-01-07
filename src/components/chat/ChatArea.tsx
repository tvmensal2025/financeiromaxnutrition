import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Phone, MessageCircle, ArrowLeft, Sparkles, UsersRound, MoreVertical } from 'lucide-react';
import { ChatMessage, Message } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ConversationStatus } from './ConversationsList';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ChatAreaProps {
  phone: string | null;
  contactName: string | null;
  contactType: 'lead' | 'customer' | 'new' | 'group';
  conversationStatus?: ConversationStatus;
  messages: Message[];
  isLoading?: boolean;
  isSending?: boolean;
  onSend: (message: string, media?: { file: File; type: string }) => void;
  onConvertToCustomer?: () => void;
  onBack?: () => void;
  showBack?: boolean;
  onViewParticipants?: () => void;
  onUpdateConversationStatus?: (status: ConversationStatus) => void;
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
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
      return { label: 'Grupo', className: 'bg-purple-500/10 text-purple-500' };
    }
    switch (contactType) {
      case 'customer':
        return { label: 'Cliente', className: 'bg-success/10 text-success' };
      case 'lead':
        return { label: 'Lead', className: 'bg-warning/10 text-warning' };
      default:
        return { label: 'Novo', className: 'bg-muted text-muted-foreground' };
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
      {/* Premium Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3">
        {showBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden h-9 w-9 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <div className="relative">
          <Avatar className={cn(
            'h-11 w-11 shrink-0 ring-2 ring-offset-2 ring-offset-card',
            isGroup ? 'ring-purple-500/30' : 'ring-primary/30'
          )}>
            <AvatarFallback className={cn(
              'font-semibold',
              isGroup 
                ? 'bg-purple-500/10 text-purple-500' 
                : 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
            )}>
              {isGroup ? <UsersRound className="h-5 w-5" /> : getInitials(contactName, phone)}
            </AvatarFallback>
          </Avatar>
          <span className="status-dot online" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">
              {contactName || (isGroup ? 'Grupo' : formatPhone(phone))}
            </h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', typeInfo.className)}>
              {typeInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {isGroup ? (
              <UsersRound className="h-3 w-3" />
            ) : (
              <Phone className="h-3 w-3" />
            )}
            <span>{formatPhone(phone)}</span>
          </div>
        </div>

        {isGroup && onViewParticipants && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onViewParticipants}
            className="shrink-0 gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
          >
            <UsersRound className="h-4 w-4" />
            <span className="hidden sm:inline">Ver Participantes</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Status da conversa</DropdownMenuLabel>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-muted-foreground">
              Mais ações (em breve)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 chat-container" ref={scrollRef}>
        <div className="p-4 min-h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Carregando mensagens...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/5 p-5 mb-4">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1 text-lg">
                Inicie a conversa
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Envie a primeira mensagem para começar a interação
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-6">
                    <div className="bg-card/80 backdrop-blur-sm border border-border/50 text-muted-foreground text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">
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
      <ChatInput onSend={onSend} disabled={!phone} isSending={isSending} />
    </div>
  );
}
