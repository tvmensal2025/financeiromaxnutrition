import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
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
    content: 'Olá! Como posso ajudá-lo(a) hoje?',
  },
  {
    label: 'Agradecimento',
    content: 'Obrigado pelo contato! Qualquer dúvida, estamos à disposição.',
  },
  {
    label: 'Lembrete',
    content: 'Olá! Passando para lembrar sobre nossa conversa. Posso ajudar em algo mais?',
  },
  {
    label: 'Boas-vindas',
    content: 'Bem-vindo(a)! Estamos muito felizes em tê-lo(a) conosco. 🎉',
  },
];

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

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Templates */}
      <div className="mb-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <FileText className="h-4 w-4 mr-2" />
              Modelos rápidos
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <div className="space-y-1">
              {templates.map((t) => (
                <button
                  key={t.label}
                  onClick={() => handleTemplate(t.content)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                >
                  <p className="font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.content}</p>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          disabled={disabled || isSending}
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isSending}
          size="icon"
          className="h-11 w-11 shrink-0"
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