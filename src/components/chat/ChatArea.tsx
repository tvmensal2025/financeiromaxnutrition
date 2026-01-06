import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { ChatMessage, Message } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ChatAreaProps {
  phone: string | null;
  contactName: string | null;
  contactType: 'lead' | 'customer' | 'new';
  messages: Message[];
  isLoading?: boolean;
  isSending?: boolean;
  onSend: (message: string) => void;
  onConvertToCustomer?: () => void;
  onBack?: () => void;
  showBack?: boolean;
}

export function ChatArea({
  phone,
  contactName,
  contactType,
  messages,
  isLoading,
  isSending,
  onSend,
  onBack,
  showBack,
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!phone) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10 p-8">
        <div className="rounded-full bg-primary/10 p-6 mb-4 animate-pulse-slow">
          <MessageCircle className="h-12 w-12 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Selecione uma conversa
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Escolha um contato na lista para ver o histórico e enviar mensagens
        </p>
      </div>
    );
  }

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

  const getTypeLabel = () => {
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
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 shadow-sm">
        {showBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-semibold">
            {getInitials(contactName, phone)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">
              {contactName || formatPhone(phone)}
            </h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', typeInfo.className)}>
              {typeInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{formatPhone(phone)}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 chat-container" ref={scrollRef}>
        <div className="p-4 min-h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Carregando mensagens...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="rounded-full bg-primary/10 p-4 mb-3">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <p className="font-medium text-foreground mb-1">
                Inicie a conversa
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Envie a primeira mensagem para começar
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-card border border-border text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
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