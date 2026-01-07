import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Smile, Paperclip, Mic, FileText, Image, X, File, StopCircle, Settings2 } from 'lucide-react';
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

interface ChatInputProps {
  onSend: (message: string, media?: { file: File; type: string }) => void;
  disabled?: boolean;
  isSending?: boolean;
  businessId?: string;
  onManageTemplates?: () => void;
}

const quickEmojis = ['👍', '❤️', '😊', '🙏', '✅', '🔥', '👏', '🎉'];

export function ChatInput({ onSend, disabled, isSending, businessId, onManageTemplates }: ChatInputProps) {
  // Fetch templates from database
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
        ...t,
        emoji: t.emoji || '📝',
      }));
    },
    enabled: !!businessId,
  });
  const [message, setMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
      // Auto-scroll to bottom when content grows
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [message]);

  // Cleanup on unmount
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

    // Create preview for images
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

    // Reset input
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

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
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
      onSend(message.trim());
    }
    setMessage('');
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

  const canSend = (message.trim() || attachedFile) && !disabled && !isSending;

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4 space-y-3">
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
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-xl',
          'bg-muted/50 border border-border'
        )}>
          {attachedFile.type === 'image' && attachedFile.preview ? (
            <img 
              src={attachedFile.preview} 
              alt="Preview" 
              className="h-16 w-16 object-cover rounded-lg"
            />
          ) : attachedFile.type === 'audio' ? (
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mic className="h-6 w-6 text-primary" />
            </div>
          ) : attachedFile.type === 'video' ? (
            <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <File className="h-6 w-6 text-purple-500" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-500" />
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
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-red-500">Gravando</span>
          <span className="text-sm text-muted-foreground">{formatTime(recordingTime)}</span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={stopRecording}
          >
            <StopCircle className="h-4 w-4 mr-1" />
            Parar
          </Button>
        </div>
      )}

      {/* Quick templates row - 1 click access */}
      <div className="flex items-center gap-1.5 px-1 overflow-x-auto">
        {templates.map((t: { id: string; name: string; content: string; emoji?: string }) => (
          <Button
            key={t.id}
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs hover:bg-accent/50 rounded-full border-border/50"
            onClick={() => handleTemplate(t.content)}
          >
            <span className="mr-1">{t.emoji || '📝'}</span>
            <span className="font-bold">{t.name}</span>
          </Button>
        ))}
        {onManageTemplates && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-full"
            onClick={onManageTemplates}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
        {templates.length === 0 && onManageTemplates && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs font-medium hover:bg-accent/50 rounded-full border-dashed border-border/50"
            onClick={onManageTemplates}
          >
            <Settings2 className="h-3 w-3 mr-1" />
            Criar modelos
          </Button>
        )}
      </div>

      {/* Quick actions row */}
      <div className="flex items-center gap-2 px-1">
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

        {/* Attachment (documents) */}
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Image/Video */}
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg"
          onClick={() => imageInputRef.current?.click()}
          disabled={isRecording}
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
            placeholder={attachedFile ? "Adicione uma legenda..." : "Digite sua mensagem..."}
            disabled={disabled || isSending || isRecording}
            className={cn(
              'min-h-[48px] max-h-[120px] resize-none pr-4 rounded-2xl',
              'bg-background/50 border-border/50',
              'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50',
              'transition-all duration-200'
            )}
            rows={1}
          />
        </div>

        {/* Audio button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-12 w-12 shrink-0 rounded-full transition-colors",
            isRecording 
              ? "text-red-500 hover:text-red-600 hover:bg-red-500/10" 
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isSending || !!attachedFile}
        >
          {isRecording ? (
            <StopCircle className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className={cn(
            'h-12 w-12 shrink-0 rounded-full transition-all duration-300',
            canSend 
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
