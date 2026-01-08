import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExtractContactsModal } from './ExtractContactsModal';

interface SelectGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Group {
  phone: string;
  name: string;
  participantCount?: number;
  lastMessageDate: string;
}

export function SelectGroupModal({ open, onOpenChange }: SelectGroupModalProps) {
  const { business } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showExtractModal, setShowExtractModal] = useState(false);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups-list', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('phone, group_name, participant_count, created_at')
        .eq('business_id', business.id)
        .eq('is_group', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const uniqueGroups = new Map<string, Group>();
      data?.forEach(msg => {
        if (!uniqueGroups.has(msg.phone)) {
          uniqueGroups.set(msg.phone, {
            phone: msg.phone,
            name: msg.group_name || 'Grupo sem nome',
            participantCount: msg.participant_count || undefined,
            lastMessageDate: msg.created_at
          });
        }
      });
      
      return Array.from(uniqueGroups.values());
    },
    enabled: open && !!business?.id
  });

  const filteredGroups = groups?.filter(group => 
    group.name.toLowerCase().includes(search.toLowerCase()) ||
    group.phone.includes(search)
  ) || [];

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
    setShowExtractModal(true);
  };

  const handleCloseExtractModal = (open: boolean) => {
    setShowExtractModal(open);
    if (!open) {
      setSelectedGroup(null);
    }
  };

  return (
    <>
      <Dialog open={open && !showExtractModal} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Selecionar Grupo
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[50vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                <p>Nenhum grupo encontrado</p>
                <p className="text-sm">Grupos aparecerão aqui quando você receber mensagens</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGroups.map((group) => (
                  <button
                    key={group.phone}
                    onClick={() => handleSelectGroup(group)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {group.participantCount && (
                          <span>{group.participantCount} participantes</span>
                        )}
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(group.lastMessageDate), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedGroup && (
        <ExtractContactsModal
          open={showExtractModal}
          onOpenChange={handleCloseExtractModal}
          groupPhone={selectedGroup.phone}
          groupName={selectedGroup.name}
          businessId={business?.id || ''}
        />
      )}
    </>
  );
}
