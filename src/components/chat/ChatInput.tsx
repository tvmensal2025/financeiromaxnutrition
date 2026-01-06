import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Smile, Paperclip, Mic, FileText, Image } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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

const quickEmojis = ['👍', '❤️', '😊', '🙏', '✅', '🔥', '👏', '🎉'];

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
    <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4 space-y-3">
      {/* Quick actions row */}
      <div className="flex items-center gap-2 px-1">
        {/* Templates */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              <span className="text-xs font-medium">Modelos</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2 rounded-xl">
            <p className="text-xs font-semibold text-muted-foreground px-2 mb-2 uppercase tracking-wider">
              Modelos rápidos
            </p>
            <div className="space-y-1">
              {templates.map((t) => (
                <button
                  key={t.label}
                  onClick={() => handleTemplate(t.content)}
                  className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-accent transition-colors group"
                >
                  <p className="font-medium text-foreground text-sm flex items-center gap-2">
                    <span className="text-lg">{t.emoji}</span>
                    {t.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 group-hover:text-foreground/70 transition-colors">
                    {t.content}
                  </p>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Emoji picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3 rounded-xl">
            <div className="grid grid-cols-4 gap-1">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-xl"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Attachment (visual only) */}
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Image (visual only) */}
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg"
        >
          <Image className="h-4 w-4" />
        </Button>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={disabled || isSending}
            className={cn(
              'min-h-[48px] max-h-[120px] resize-none pr-4 rounded-2xl',
              'bg-background/50 border-border/50',
              'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50',
              'transition-all duration-200'
            )}
            rows={1}
          />
        </div>

        {/* Audio button (visual only) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50"
        >
          <Mic className="h-5 w-5" />
        </Button>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isSending}
          size="icon"
          className={cn(
            'h-12 w-12 shrink-0 rounded-full transition-all duration-300',
            message.trim() 
              ? 'shadow-lg shadow-primary/30 scale-100' 
              : 'scale-95 opacity-70'
          )}
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
