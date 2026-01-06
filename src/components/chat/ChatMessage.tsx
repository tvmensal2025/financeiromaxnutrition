import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Clock, XCircle, Play, Pause, FileText, Download, Image as ImageIcon, Film, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

export interface Message {
  id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  sender_name?: string | null;
  is_group?: boolean;
  participant_phone?: string | null;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isOutbound = message.direction === 'outbound';
  const showSenderName = !isOutbound && (message.sender_name || message.is_group);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  const handleAudioToggle = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const getMediaTypeFromUrl = (url: string): string | null => {
    const lower = url.toLowerCase();
    if (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.gif') || lower.includes('.webp') || lower.includes('image')) {
      return 'image';
    }
    if (lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.avi') || lower.includes('.webm') || lower.includes('video')) {
      return 'video';
    }
    if (lower.includes('.mp3') || lower.includes('.ogg') || lower.includes('.opus') || lower.includes('.m4a') || lower.includes('.wav') || lower.includes('audio') || lower.includes('ptt')) {
      return 'audio';
    }
    if (lower.includes('.pdf')) {
      return 'pdf';
    }
    if (lower.includes('.doc') || lower.includes('.docx') || lower.includes('.xls') || lower.includes('.xlsx') || lower.includes('.ppt') || lower.includes('.pptx')) {
      return 'document';
    }
    return null;
  };

  const renderMedia = () => {
    if (!message.media_url) return null;

    const mediaType = message.media_type || getMediaTypeFromUrl(message.media_url);

    // Image
    if (mediaType === 'image' || mediaType?.startsWith('image')) {
      return (
        <div className="mb-2 rounded-lg overflow-hidden">
          {!imageLoaded && !imageError && (
            <div className="w-48 h-48 bg-muted/50 animate-pulse rounded-lg flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          {imageError ? (
            <a
              href={message.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                isOutbound ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80'
              )}
            >
              <ImageIcon className="h-4 w-4" />
              Ver imagem
            </a>
          ) : (
            <>
              <img
                src={message.media_url}
                alt="Imagem"
                className={cn(
                  'max-w-full max-h-64 rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-opacity',
                  !imageLoaded && 'hidden'
                )}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                onClick={() => setShowFullImage(true)}
              />
              {/* Fullscreen image modal */}
              {showFullImage && (
                <div 
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setShowFullImage(false)}
                >
                  <img
                    src={message.media_url}
                    alt="Imagem ampliada"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    // Video
    if (mediaType === 'video' || mediaType?.startsWith('video')) {
      return (
        <div className="mb-2 rounded-lg overflow-hidden">
          <video
            src={message.media_url}
            controls
            className="max-w-full max-h-64 rounded-lg shadow-sm"
            preload="metadata"
          >
            <source src={message.media_url} />
            Seu navegador não suporta vídeos.
          </video>
        </div>
      );
    }

    // Audio
    if (mediaType === 'audio' || mediaType?.startsWith('audio') || message.media_type?.includes('ogg') || message.media_type?.includes('opus')) {
      return (
        <div className={cn(
          'mb-2 flex items-center gap-3 px-3 py-2 rounded-xl min-w-[200px]',
          isOutbound ? 'bg-white/10' : 'bg-muted'
        )}>
          <audio
            ref={audioRef}
            src={message.media_url}
            onEnded={handleAudioEnded}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            preload="metadata"
          />
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              'h-10 w-10 rounded-full shrink-0',
              isOutbound ? 'hover:bg-white/20' : 'hover:bg-accent'
            )}
            onClick={handleAudioToggle}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          <div className="flex-1 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <div className={cn(
              'flex-1 h-1 rounded-full',
              isOutbound ? 'bg-white/20' : 'bg-border'
            )}>
              <div className={cn(
                'h-full rounded-full w-0 transition-all',
                isOutbound ? 'bg-white/60' : 'bg-primary/60'
              )} />
            </div>
          </div>
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'p-2 rounded-lg transition-colors',
              isOutbound ? 'hover:bg-white/20' : 'hover:bg-accent'
            )}
            title="Baixar áudio"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      );
    }

    // PDF
    if (mediaType === 'pdf' || message.media_type?.includes('pdf')) {
      const fileName = message.message !== '[Documento]' && message.message !== '[PDF]' 
        ? message.message 
        : 'Documento.pdf';
      
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'mb-2 flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
            isOutbound 
              ? 'bg-white/10 hover:bg-white/20' 
              : 'bg-muted hover:bg-accent'
          )}
        >
          <div className={cn(
            'p-2 rounded-lg shrink-0',
            isOutbound ? 'bg-red-500/20' : 'bg-red-500/10'
          )}>
            <FileText className="h-6 w-6 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <p className={cn(
              'text-xs',
              isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'
            )}>PDF</p>
          </div>
          <Download className="h-5 w-5 shrink-0" />
        </a>
      );
    }

    // Other documents
    if (mediaType === 'document' || message.media_type?.includes('document') || message.media_type?.includes('application')) {
      const fileName = message.message !== '[Documento]' 
        ? message.message 
        : 'Documento';
      
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'mb-2 flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
            isOutbound 
              ? 'bg-white/10 hover:bg-white/20' 
              : 'bg-muted hover:bg-accent'
          )}
        >
          <div className={cn(
            'p-2 rounded-lg shrink-0',
            isOutbound ? 'bg-blue-500/20' : 'bg-blue-500/10'
          )}>
            <FileText className="h-6 w-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <p className={cn(
              'text-xs',
              isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'
            )}>Documento</p>
          </div>
          <Download className="h-5 w-5 shrink-0" />
        </a>
      );
    }

    // Unknown/fallback - generic link
    return (
      <a
        href={message.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'mb-2 inline-flex items-center gap-2 text-sm underline px-3 py-2 rounded-lg',
          isOutbound ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-accent'
        )}
      >
        📎 Ver anexo
      </a>
    );
  };

  // Check if message is just a media placeholder
  const isMediaPlaceholder = message.media_url && (
    message.message === '[Imagem]' ||
    message.message === '[Áudio]' ||
    message.message === '[Vídeo]' ||
    message.message === '[Documento]' ||
    message.message === '[PDF]'
  );

  return (
    <div
      className={cn(
        'flex w-full mb-3 group',
        isOutbound ? 'justify-end animate-slide-in-right' : 'justify-start animate-slide-in-left'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] md:max-w-[70%] px-4 py-2.5 transition-transform duration-200',
          isOutbound ? 'chat-bubble-out' : 'chat-bubble-in',
          'group-hover:scale-[1.01]'
        )}
      >
        {/* Sender name for inbound (especially in groups) */}
        {showSenderName && (
          <p className="text-xs font-semibold text-primary mb-1.5">
            {message.sender_name || 'Participante'}
          </p>
        )}

        {/* Media */}
        {renderMedia()}

        {/* Message text (hide if it's just a media placeholder) */}
        {!isMediaPlaceholder && message.message && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.message}
          </p>
        )}

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
