import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, User, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Participant {
  phone: string;
  name: string | null;
  isAdmin?: boolean;
}

interface ExtractContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupPhone: string;
  groupName: string | null;
  businessId?: string;
}

export function ExtractContactsModal({
  open,
  onOpenChange,
  groupPhone,
  groupName,
  businessId,
}: ExtractContactsModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [saveAs, setSaveAs] = useState<'lead' | 'customer'>('lead');

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['group-participants', groupPhone],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-group-participants', {
        body: {
          group_id: groupPhone,
          business_id: businessId || business?.id,
        },
      });

      if (error) throw error;
      return (data?.participants || []) as Participant[];
    },
    enabled: !!open && !!groupPhone,
  });

  const handleToggleParticipant = (phone: string) => {
    const newSet = new Set(selectedParticipants);
    if (newSet.has(phone)) {
      newSet.delete(phone);
    } else {
      newSet.add(phone);
    }
    setSelectedParticipants(newSet);
  };

  const handleSelectAll = () => {
    if (selectedParticipants.size === participants.length) {
      setSelectedParticipants(new Set());
    } else {
      setSelectedParticipants(new Set(participants.map((p) => p.phone)));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!business?.id || selectedParticipants.size === 0) return;

      const phones = Array.from(selectedParticipants);
      const records = phones.map((phone) => {
        const participant = participants.find((p) => p.phone === phone);
        return {
          business_id: business.id,
          name: participant?.name || `Contato ${phone.slice(-4)}`,
          phone,
          whatsapp: phone,
          source: `Grupo: ${groupName || groupPhone}`,
        };
      });

      if (saveAs === 'lead') {
        const { error } = await supabase.from('leads').upsert(
          records.map((r) => ({ ...r, status: 'new' as const })),
          { onConflict: 'phone,business_id', ignoreDuplicates: true }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').upsert(records, {
          onConflict: 'phone,business_id',
          ignoreDuplicates: true,
        });
        if (error) throw error;
      }

      return records.length;
    },
    onSuccess: (count) => {
      toast({
        title: 'Contatos extraídos!',
        description: `${count} contato(s) salvo(s) como ${saveAs === 'lead' ? 'leads' : 'clientes'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedParticipants(new Set());
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Save contacts error:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar os contatos.',
        variant: 'destructive',
      });
    },
  });

  const formatPhone = (p: string) => {
    const cleaned = p.replace(/\D/g, '');
    if (cleaned.length >= 11) {
      return `(${cleaned.slice(-11, -9)}) ${cleaned.slice(-9, -4)}-${cleaned.slice(-4)}`;
    }
    return p;
  };

  const handleExportCSV = () => {
    const phones = selectedParticipants.size > 0 
      ? participants.filter(p => selectedParticipants.has(p.phone))
      : participants;
    
    const csv = [
      'Nome,Telefone',
      ...phones.map(p => `"${p.name || ''}","${p.phone}"`)
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contatos_${groupName || 'grupo'}.csv`;
    link.click();

    toast({
      title: 'Exportado!',
      description: `${phones.length} contato(s) exportado(s) para CSV.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Extrair Contatos do Grupo
          </DialogTitle>
          <DialogDescription>
            {groupName || 'Grupo'} - {participants.length} participante(s)
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-2">
          <Button size="sm" variant="outline" onClick={handleSelectAll}>
            {selectedParticipants.size === participants.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
          <Badge variant="secondary">
            {selectedParticipants.size} selecionado(s)
          </Badge>
        </div>

        <ScrollArea className="flex-1 border rounded-lg max-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum participante encontrado
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {participants.map((participant) => {
                const isSelected = selectedParticipants.has(participant.phone);

                return (
                  <label
                    key={participant.phone}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleParticipant(participant.phone)}
                    />
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {participant.name || formatPhone(participant.phone)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(participant.phone)}
                        {participant.isAdmin && (
                          <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">
                            Admin
                          </Badge>
                        )}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="space-y-3 pt-3">
          <div className="flex gap-2">
            <Button
              variant={saveAs === 'lead' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setSaveAs('lead')}
            >
              <User className="h-4 w-4 mr-1" />
              Salvar como Lead
            </Button>
            <Button
              variant={saveAs === 'customer' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setSaveAs('customer')}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Salvar como Cliente
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
            <Button
              className="flex-1"
              disabled={selectedParticipants.size === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Salvar ({selectedParticipants.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
