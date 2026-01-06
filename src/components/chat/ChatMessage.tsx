import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Message {
  id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  sender_name?: string | null;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isOutbound = message.direction === 'outbound';

  const getStatusIcon = () => {
    switch (message.status) {
      case 'read':
        return <CheckCheck className="h-3.5 w-3.5 text-sky-400" />;
      case 'delivered':
        return <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/60" />;
      case 'sent':
        return <Check className="h-3.5 w-3.5 text-primary-foreground/60" />;
      case 'failed':
        return <XCircle className="h-3.5 w-3.5 text-red-300" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-primary-foreground/60" />;
    }
  };

  return (
    <div
      className={cn(
        'flex w-full mb-3',
        isOutbound ? 'justify-end animate-slide-in-right' : 'justify-start animate-slide-in-left'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] md:max-w-[70%] px-4 py-2.5',
          isOutbound ? 'chat-bubble-out' : 'chat-bubble-in'
        )}
      >
        {/* Sender name for inbound */}
        {!isOutbound && message.sender_name && (
          <p className="text-xs font-semibold text-primary mb-1">
            {message.sender_name}
          </p>
        )}

        {/* Media */}
        {message.media_url && (
          <div className="mb-2">
            {message.media_type?.startsWith('image') ? (
              <img
                src={message.media_url}
                alt="Mídia"
                className="max-w-full rounded-lg"
              />
            ) : (
              <a
                href={message.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                Ver anexo
              </a>
            )}
          </div>
        )}

        {/* Message text */}
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.message}
        </p>

        {/* Time and status */}
        <div
          className={cn(
            'flex items-center gap-1.5 mt-1.5',
            isOutbound ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className={cn(
              'text-[11px]',
              isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
          </span>
          {isOutbound && getStatusIcon()}
        </div>
      </div>
    </div>
  );
}