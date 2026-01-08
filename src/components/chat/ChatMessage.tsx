import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Clock, XCircle, Play, Pause, FileText, Download, Image as ImageIcon, MapPin, User, Users, AlertTriangle, MessageSquareText, Smile, Copy, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export interface Message {
  id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  media_metadata?: any;
  sender_name?: string | null;
  is_group?: boolean;
  participant_phone?: string | null;
  transcribed_text?: string | null;
  transcription_error?: string | null;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isOutbound = message.direction === 'outbound';
  const showSenderName = !isOutbound && (message.sender_name || message.is_group);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (message.media_metadata?.duration) {
      setDuration(message.media_metadata.duration);
    }
  }, [message.media_metadata]);

  const getStatusIcon = () => {
    switch (message.status) {
      case 'read':
        return <CheckCheck className="h-3 w-3 text-sky-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-white/60" />;
      case 'sent':
        return <Check className="h-3 w-3 text-white/60" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-300" />;
      default:
        return <Clock className="h-3 w-3 text-white/60" />;
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
    setCurrentTime(0);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const parseVCardPhones = (vcard: string): string[] => {
    const phones: string[] = [];
    const lines = vcard.split('\n');
    for (const line of lines) {
      if (line.startsWith('TEL') || line.includes('TEL:') || line.includes('TEL;')) {
        const match = line.match(/[\d\+\-\s\(\)]+/g);
        if (match) {
          phones.push(match.join('').trim());
        }
      }
    }
    return phones;
  };

  const renderMedia = () => {
    if (!message.media_url && !message.media_type) return null;

    const mediaType = message.media_type || (message.media_url ? getMediaTypeFromUrl(message.media_url) : null);

    // Location
    if (mediaType === 'location') {
      const metadata = message.media_metadata || {};
      const lat = metadata.latitude;
      const lng = metadata.longitude;
      const name = metadata.name;
      const address = metadata.address;
      
      return (
        <a
          href={message.media_url || `https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'mb-2 flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            isOutbound 
              ? 'bg-white/10 hover:bg-white/15' 
              : 'bg-muted/50 hover:bg-muted'
          )}
        >
          <div className={cn(
            'p-2 rounded-lg shrink-0',
            isOutbound ? 'bg-green-500/20' : 'bg-green-500/10'
          )}>
            <MapPin className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{name || 'Localização'}</p>
            {address && (
              <p className={cn(
                'text-xs truncate',
                isOutbound ? 'text-white/60' : 'text-muted-foreground'
              )}>{address}</p>
            )}
          </div>
        </a>
      );
    }

    // Contact
    if (mediaType === 'contact') {
      const metadata = message.media_metadata || {};
      const displayName = metadata.displayName || 'Contato';
      const phones = metadata.vcard ? parseVCardPhones(metadata.vcard) : [];
      
      return (
        <div className={cn(
          'mb-2 flex items-center gap-3 px-3 py-2 rounded-lg',
          isOutbound ? 'bg-white/10' : 'bg-muted/50'
        )}>
          <div className={cn(
            'p-2 rounded-full shrink-0',
            isOutbound ? 'bg-blue-500/20' : 'bg-blue-500/10'
          )}>
            <User className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {phones.length > 0 && (
              <p className={cn(
                'text-xs truncate',
                isOutbound ? 'text-white/60' : 'text-muted-foreground'
              )}>{phones[0]}</p>
            )}
          </div>
        </div>
      );
    }

    // Contacts array
    if (mediaType === 'contacts') {
      const metadata = message.media_metadata || {};
      const contacts = metadata.contacts || [];
      
      return (
        <div className={cn(
          'mb-2 flex items-center gap-3 px-3 py-2 rounded-lg',
          isOutbound ? 'bg-white/10' : 'bg-muted/50'
        )}>
          <div className={cn(
            'p-2 rounded-full shrink-0',
            isOutbound ? 'bg-blue-500/20' : 'bg-blue-500/10'
          )}>
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{contacts.length} contatos</p>
            <p className={cn(
              'text-xs truncate',
              isOutbound ? 'text-white/60' : 'text-muted-foreground'
            )}>
              {contacts.map((c: any) => c.displayName).join(', ')}
            </p>
          </div>
        </div>
      );
    }

    // Sticker
    if (mediaType === 'sticker' && message.media_url) {
      return (
        <div className="mb-1">
          <img
            src={message.media_url}
            alt="Sticker"
            className="max-w-[120px] max-h-[120px]"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      );
    }

    if (!message.media_url) return null;

    // Image
    if (mediaType === 'image' || mediaType?.startsWith('image')) {
      return (
        <div className="mb-1.5 rounded-lg overflow-hidden">
          {!imageLoaded && !imageError && (
            <div className="w-48 h-48 bg-muted/30 animate-pulse rounded-lg flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
          {imageError ? (
            <a
              href={message.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                isOutbound ? 'bg-white/10 hover:bg-white/15' : 'bg-muted/50 hover:bg-muted'
              )}
            >
              <Download className="h-4 w-4" />
              Baixar imagem
            </a>
          ) : (
            <>
              <img
                src={message.media_url}
                alt="Imagem"
                className={cn(
                  'max-w-full max-h-56 rounded-lg cursor-pointer hover:opacity-95 transition-opacity',
                  !imageLoaded && 'hidden'
                )}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                onClick={() => setShowFullImage(true)}
              />
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
                  <a
                    href={message.media_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-6 right-6 p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-5 w-5 text-white" />
                  </a>
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
        <div className="mb-1.5 rounded-lg overflow-hidden">
          <video
            src={message.media_url}
            controls
            className="max-w-full max-h-56 rounded-lg"
            preload="metadata"
          >
            <source src={message.media_url} />
          </video>
        </div>
      );
    }

    // Audio
    if (mediaType === 'audio' || mediaType?.startsWith('audio') || message.media_type?.includes('ogg') || message.media_type?.includes('opus')) {
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      
      return (
        <div className={cn(
          'mb-1.5 flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-[200px]',
          isOutbound ? 'bg-white/10' : 'bg-muted/50'
        )}>
          <audio
            ref={audioRef}
            src={message.media_url}
            onEnded={handleAudioEnded}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            preload="metadata"
          />
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              'h-9 w-9 rounded-full shrink-0',
              isOutbound ? 'hover:bg-white/15' : 'hover:bg-muted'
            )}
            onClick={handleAudioToggle}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>
          <div className="flex-1 flex flex-col gap-0.5">
            <div 
              className={cn(
                'h-1 rounded-full cursor-pointer',
                isOutbound ? 'bg-white/20' : 'bg-border'
              )}
              onClick={handleSeek}
            >
              <div 
                className={cn(
                  'h-full rounded-full transition-all',
                  isOutbound ? 'bg-white/70' : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={cn(
              'flex justify-between text-[10px]',
              isOutbound ? 'text-white/50' : 'text-muted-foreground'
            )}>
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>
        </div>
      );
    }

    // PDF
    if (mediaType === 'pdf' || message.media_type?.includes('pdf')) {
      const fileName = message.media_metadata?.fileName || 'Documento.pdf';
      
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className={cn(
            'mb-1.5 flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            isOutbound 
              ? 'bg-white/10 hover:bg-white/15' 
              : 'bg-muted/50 hover:bg-muted'
          )}
        >
          <div className={cn(
            'p-2 rounded-lg shrink-0',
            isOutbound ? 'bg-red-500/20' : 'bg-red-500/10'
          )}>
            <FileText className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <p className={cn(
              'text-xs',
              isOutbound ? 'text-white/50' : 'text-muted-foreground'
            )}>PDF</p>
          </div>
          <Download className="h-4 w-4 shrink-0" />
        </a>
      );
    }

    // Other documents
    if (mediaType === 'document' || message.media_type?.includes('document') || message.media_type?.includes('application')) {
      const fileName = message.media_metadata?.fileName || 'Documento';
      
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className={cn(
            'mb-1.5 flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            isOutbound 
              ? 'bg-white/10 hover:bg-white/15' 
              : 'bg-muted/50 hover:bg-muted'
          )}
        >
          <div className={cn(
            'p-2 rounded-lg shrink-0',
            isOutbound ? 'bg-blue-500/20' : 'bg-blue-500/10'
          )}>
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <p className={cn(
              'text-xs',
              isOutbound ? 'text-white/50' : 'text-muted-foreground'
            )}>Documento</p>
          </div>
          <Download className="h-4 w-4 shrink-0" />
        </a>
      );
    }

    // Unknown/fallback
    return (
      <a
        href={message.media_url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className={cn(
          'mb-1.5 inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
          isOutbound ? 'bg-white/10 hover:bg-white/15' : 'bg-muted/50 hover:bg-muted'
        )}
      >
        <Download className="h-4 w-4" />
        Baixar anexo
      </a>
    );
  };

  const isMediaPlaceholder = (message.media_url || message.media_type) && (
    message.message === '[Imagem]' ||
    message.message === '[Áudio]' ||
    message.message === '[Vídeo]' ||
    message.message === '[Documento]' ||
    message.message === '[PDF]' ||
    message.message === '[Sticker]' ||
    message.message === '[Localização]' ||
    message.message.startsWith('[Contato:') ||
    message.message.startsWith('[Contatos:')
  );

  return (
    <div
      className={cn(
        'flex w-full mb-1 group relative',
        isOutbound ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Hover actions */}
      <div className={cn(
        'absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10',
        'flex items-center gap-0.5 bg-card border border-border/50 rounded-lg shadow-lg p-0.5',
        isOutbound ? 'right-full mr-1' : 'left-full ml-1'
      )}>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md">
          <Smile className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md">
          <Reply className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        className={cn(
          'max-w-[75%] md:max-w-[65%] px-3 py-2 relative',
          isOutbound 
            ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl rounded-br-md shadow-md shadow-primary/20' 
            : 'bg-card border border-border/50 text-foreground rounded-2xl rounded-bl-md shadow-sm',
          'transition-transform duration-150 group-hover:scale-[1.01]'
        )}
      >
        {/* Sender name for inbound (especially in groups) */}
        {showSenderName && (
          <p className="text-xs font-semibold text-primary mb-1">
            {message.sender_name || 'Participante'}
          </p>
        )}

        {/* Media */}
        {renderMedia()}

        {/* Transcription for audio messages */}
        {message.media_type === 'audio' && message.transcribed_text && (
          <div className={cn(
            'mb-1.5 px-2 py-1.5 rounded-lg text-xs',
            isOutbound ? 'bg-white/10' : 'bg-muted/50'
          )}>
            <div className="flex items-center gap-1 mb-0.5">
              <MessageSquareText className="h-3 w-3 text-primary" />
              <span className={cn(
                'text-[10px] font-medium',
                isOutbound ? 'text-white/60' : 'text-muted-foreground'
              )}>Transcrição</span>
            </div>
            <p className="whitespace-pre-wrap break-words leading-relaxed italic text-xs">
              "{message.transcribed_text}"
            </p>
          </div>
        )}

        {/* Transcription error for audio messages */}
        {message.media_type === 'audio' && message.transcription_error && !message.transcribed_text && (
          <div className={cn(
            'mb-1.5 px-2 py-1.5 rounded-lg text-[10px] flex items-start gap-1.5',
            isOutbound ? 'bg-red-500/20 text-red-100' : 'bg-red-50 text-red-600'
          )}>
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="break-words">Erro: {message.transcription_error}</span>
          </div>
        )}

        {/* Message text */}
        {!isMediaPlaceholder && message.message && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.message}
          </p>
        )}

        {/* Time and status */}
        <div
          className={cn(
            'flex items-center gap-1 mt-1',
            isOutbound ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className={cn(
              'text-[10px]',
              isOutbound ? 'text-white/60' : 'text-muted-foreground'
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
