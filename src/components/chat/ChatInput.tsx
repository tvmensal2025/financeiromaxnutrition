import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Smile, Paperclip } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FileText } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

const templates = [
  {
    label: 'Saudação',
    emoji: '👋',
    content: 'Olá! Como posso ajudá-lo(a) hoje?',
  },
  {
    label: 'Agradecimento',
    emoji: '🙏',
    content: 'Obrigado pelo contato! Qualquer dúvida, estamos à disposição.',
  },
  {
    label: 'Lembrete',
    emoji: '⏰',
    content: 'Olá! Passando para lembrar sobre nossa conversa. Posso ajudar em algo mais?',
  },
  {
    label: 'Boas-vindas',
    emoji: '🎉',
    content: 'Bem-vindo(a)! Estamos muito felizes em tê-lo(a) conosco.',
  },
];

const quickEmojis = ['👍', '❤️', '😊', '🙏', '✅', '🔥'];

export function ChatInput({ onSend, disabled, isSending }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled && !isSending) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplate = (content: string) => {
    setMessage(content);
    textareaRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-border bg-card p-3 space-y-2">
      {/* Quick actions row */}
      <div className="flex items-center gap-1 px-1">
        {/* Templates */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
              <FileText className="h-4 w-4 mr-1.5" />
              <span className="text-xs">Modelos</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Modelos rápidos</p>
            <div className="space-y-0.5">
              {templates.map((t) => (
                <button
                  key={t.label}
                  onClick={() => handleTemplate(t.content)}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors"
                >
                  <p className="font-medium text-foreground text-sm flex items-center gap-2">
                    <span>{t.emoji}</span>
                    {t.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.content}</p>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Quick emojis */}
        <div className="flex items-center gap-0.5 ml-1">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => insertEmoji(emoji)}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-base"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={disabled || isSending}
            className="min-h-[44px] max-h-[120px] resize-none pr-4 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
            rows={1}
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isSending}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full shadow-lg shadow-primary/20"
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}