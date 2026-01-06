import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, User, UserPlus, MessageCircle, ArrowLeft } from 'lucide-react';
import { ChatMessage, Message } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  onConvertToCustomer,
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
      <div className="flex h-full flex-col items-center justify-center bg-muted/30 p-8">
        <div className="rounded-full bg-muted p-6 mb-4">
          <MessageCircle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
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
        return { label: 'Cliente', className: 'text-success' };
      case 'lead':
        return { label: 'Lead', className: 'text-warning' };
      default:
        return { label: 'Novo contato', className: 'text-muted-foreground' };
    }
  };

  const typeInfo = getTypeLabel();

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
    return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        {showBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {getInitials(contactName, phone)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-foreground truncate">
            {contactName || phone}
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{phone}</span>
            <span className={typeInfo.className}>• {typeInfo.label}</span>
          </div>
        </div>

        {contactType === 'lead' && onConvertToCustomer && (
          <Button variant="outline" size="sm" onClick={onConvertToCustomer}>
            <UserPlus className="h-4 w-4 mr-2" />
            Converter
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <User className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Envie a primeira mensagem para iniciar a conversa
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
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
      </ScrollArea>

      {/* Input */}
      <ChatInput onSend={onSend} disabled={!phone} isSending={isSending} />
    </div>
  );
}