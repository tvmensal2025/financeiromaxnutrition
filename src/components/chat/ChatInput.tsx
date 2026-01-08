import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Smile, Paperclip, Mic, FileText, Image, X, File, StopCircle, Plus, Sparkles } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'audio' | 'video' | 'document';
}

export interface TemplateButton {
  text: string;
  type: 'reply' | 'link';
  url?: string;
}

interface ChatInputProps {
  onSend: (message: string, media?: { file: File; type: string }, buttons?: TemplateButton[]) => void;
  disabled?: boolean;
  isSending?: boolean;
  businessId?: string;
  onManageTemplates?: () => void;
}

const quickEmojis = ['👍', '❤️', '😊', '🙏', '✅', '🔥', '👏', '🎉', '😂', '🤔', '👋', '💪'];

interface TemplateData {
  id: string;
  name: string;
  content: string;
  emoji: string;
  buttons: TemplateButton[];
}

export function ChatInput({ onSend, disabled, isSending, businessId, onManageTemplates }: ChatInputProps) {
  const { data: templates = [] } = useQuery({
    queryKey: ['message-templates', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at');
      if (error) throw error;
      return (data || []).map(t => ({
        id: t.id,
        name: t.name,
        content: t.content,
        emoji: (t.emoji as string) || '📝',
        buttons: (Array.isArray(t.buttons) ? t.buttons : []) as unknown as TemplateButton[]
      })) as TemplateData[];
    },
    enabled: !!businessId,
  });
  
  const [message, setMessage] = useState('');
  const [pendingButtons, setPendingButtons] = useState<TemplateButton[]>([]);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 100);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const getFileType = (file: File): 'image' | 'audio' | 'video' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, forceType?: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = forceType || getFileType(file);
    const attached: AttachedFile = { file, type };

    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = (e) => {
        attached.preview = e.target?.result as string;
        setAttachedFile(attached);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachedFile(attached);
    }

    e.target.value = '';
  };

  const removeAttachment = () => {
    setAttachedFile(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `audio-${Date.now()}.webm`;
        const audioFile = new globalThis.File([audioBlob], fileName, { type: 'audio/webm' });
        
        setAttachedFile({
          file: audioFile,
          type: 'audio'
        });

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = () => {
    if ((!message.trim() && !attachedFile) || disabled || isSending) return;

    if (attachedFile) {
      onSend(message.trim() || '', { file: attachedFile.file, type: attachedFile.type });
      setAttachedFile(null);
    } else {
      onSend(message.trim(), undefined, pendingButtons.length > 0 ? pendingButtons : undefined);
    }
    setMessage('');
    setPendingButtons([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplate = (template: TemplateData) => {
    setMessage(template.content);
    
    if (template.buttons && template.buttons.length > 0) {
      setPendingButtons(template.buttons);
    } else {
      setPendingButtons([]);
    }
    
    setTemplatesOpen(false);
    textareaRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const canSend = (message.trim() || attachedFile) && !disabled && !isSending;

  return (
    <div className="border-t border-border/50 bg-card/95 backdrop-blur-md">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'document')}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e)}
      />

      {/* Attached file preview */}
      {attachedFile && (
        <div className="px-3 pt-3">
          <div className={cn(
            'flex items-center gap-3 p-2.5 rounded-xl',
            'bg-muted/50 border border-border/50'
          )}>
            {attachedFile.type === 'image' && attachedFile.preview ? (
              <img 
                src={attachedFile.preview} 
                alt="Preview" 
                className="h-12 w-12 object-cover rounded-lg"
              />
            ) : attachedFile.type === 'audio' ? (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mic className="h-5 w-5 text-primary" />
              </div>
            ) : attachedFile.type === 'video' ? (
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <File className="h-5 w-5 text-purple-500" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{attachedFile.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(attachedFile.file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={removeAttachment}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-500">Gravando</span>
            <span className="text-sm text-muted-foreground">{formatTime(recordingTime)}</span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8"
              onClick={stopRecording}
            >
              <StopCircle className="h-4 w-4 mr-1" />
              Parar
            </Button>
          </div>
        </div>
      )}

      {/* Pending buttons indicator */}
      {pendingButtons.length > 0 && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">
              {pendingButtons.length} botão(ões)
            </span>
            <div className="flex-1 flex gap-1 overflow-x-auto">
              {pendingButtons.map((btn, idx) => (
                <span key={idx} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full shrink-0">
                  {btn.text}
                </span>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-primary hover:text-primary/80"
              onClick={() => setPendingButtons([])}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Compact input area */}
      <div className="flex items-end gap-2 p-3">
        {/* Templates popover */}
        <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-72 p-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">Modelos rápidos</p>
              {templates.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">Nenhum modelo</p>
                  {onManageTemplates && (
                    <Button variant="outline" size="sm" onClick={() => { setTemplatesOpen(false); onManageTemplates(); }}>
                      Criar modelo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTemplate(t)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <span className="text-lg">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.content.substring(0, 40)}...</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {templates.length > 0 && onManageTemplates && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-1 text-muted-foreground"
                  onClick={() => { setTemplatesOpen(false); onManageTemplates(); }}
                >
                  Gerenciar modelos
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Emoji picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-auto p-2">
            <div className="grid grid-cols-6 gap-0.5">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Attachment */}
        <Button 
          variant="ghost" 
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        {/* Image/Video */}
        <Button 
          variant="ghost" 
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={() => imageInputRef.current?.click()}
          disabled={isRecording}
        >
          <Image className="h-5 w-5" />
        </Button>

        {/* Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedFile ? "Legenda..." : "Digite uma mensagem"}
            disabled={disabled || isSending || isRecording}
            className={cn(
              'min-h-[40px] max-h-[100px] resize-none rounded-2xl py-2.5 px-4',
              'bg-background border-border/50',
              'focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50',
              'transition-all duration-200 text-sm'
            )}
            rows={1}
          />
        </div>

        {/* Audio button */}
        {!canSend && !isRecording && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50"
            onClick={startRecording}
            disabled={disabled || isSending || !!attachedFile}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}

        {isRecording && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={stopRecording}
          >
            <StopCircle className="h-5 w-5" />
          </Button>
        )}

        {/* Send button */}
        {(canSend || isSending) && (
          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="icon"
            className={cn(
              'h-10 w-10 shrink-0 rounded-full transition-all duration-300',
              canSend && 'shadow-lg shadow-primary/25 animate-pulse-slow'
            )}
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
