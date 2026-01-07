import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  X,
  Crown,
  Shield,
  User,
  Loader2,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupParticipant {
  id: string;
  phone: string;
  name: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface GroupParticipantsPanelProps {
  groupPhone: string;
  groupName: string | null;
  businessId?: string;
  onClose?: () => void;
  onSelectParticipant?: (phone: string) => void;
}

export function GroupParticipantsPanel({
  groupPhone,
  groupName,
  businessId,
  onClose,
  onSelectParticipant,
}: GroupParticipantsPanelProps) {
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realGroupName, setRealGroupName] = useState<string | null>(groupName);

  useEffect(() => {
    fetchParticipants();
  }, [groupPhone]);

  const fetchParticipants = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-group-participants', {
        body: { group_id: groupPhone, business_id: businessId }
      });

      if (fnError) throw fnError;

      if (data?.participants) {
        setParticipants(data.participants);
        if (data.group_name) {
          setRealGroupName(data.group_name);
        }
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError('Não foi possível carregar os participantes');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    // Brazilian format: 55 + DDD (2 digits) + number (8-9 digits)
    if (cleaned.length >= 12 && cleaned.startsWith('55')) {
      const withoutCountry = cleaned.slice(2);
      const ddd = withoutCountry.slice(0, 2);
      const number = withoutCountry.slice(2);
      if (number.length === 9) {
        return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
      } else if (number.length === 8) {
        return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
      }
    }
    // Fallback for other formats
    if (cleaned.length >= 10) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4)}`;
    }
    return phone;
  };

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

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-foreground">Participantes</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Group Info */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-purple-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-foreground truncate">
              {realGroupName || 'Grupo'}
            </h4>
            <span className="text-xs text-muted-foreground">
              {participants.length} participante{participants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Carregando...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchParticipants}>
              Tentar novamente
            </Button>
          </div>
        ) : participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Users className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum participante encontrado</p>
          </div>
        ) : (
          <div className="py-2">
            {participants.map((participant) => (
              <button
                key={participant.id}
                onClick={() => onSelectParticipant?.(participant.phone)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors',
                  'text-left'
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback 
                    className={cn(
                      'text-xs font-medium',
                      participant.isSuperAdmin
                        ? 'bg-amber-500/10 text-amber-500'
                        : participant.isAdmin
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {getInitials(participant.name, participant.phone)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {participant.name || formatPhone(participant.phone)}
                    </span>
                    {participant.isSuperAdmin && (
                      <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    )}
                    {participant.isAdmin && !participant.isSuperAdmin && (
                      <Shield className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatPhone(participant.phone)}
                    </span>
                  </div>
                </div>

                {participant.isSuperAdmin ? (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/30 text-amber-500">
                    Criador
                  </Badge>
                ) : participant.isAdmin ? (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-blue-500/30 text-blue-500">
                    Admin
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
