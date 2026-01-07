import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Tag, Plus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManageTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
}

const TAG_COLORS = [
  '#3B82F6', // blue
  '#22C55E', // green
  '#EAB308', // yellow
  '#EF4444', // red
  '#A855F7', // purple
  '#EC4899', // pink
  '#F97316', // orange
  '#14B8A6', // teal
];

export function ManageTagsModal({
  open,
  onOpenChange,
  phone,
}: ManageTagsModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showNewTagForm, setShowNewTagForm] = useState(false);

  // Fetch all tags for business
  const { data: allTags, isLoading: tagsLoading } = useQuery({
    queryKey: ['conversation-tags', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('conversation_tags')
        .select('*')
        .eq('business_id', business.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!business?.id && open,
  });

  // Fetch assigned tags for this phone
  const { data: assignedTags, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['conversation-tag-assignments', business?.id, phone],
    queryFn: async () => {
      if (!business?.id || !phone) return [];
      const { data, error } = await supabase
        .from('conversation_tag_assignments')
        .select('tag_id')
        .eq('business_id', business.id)
        .eq('phone', phone);
      if (error) throw error;
      return data?.map(a => a.tag_id) || [];
    },
    enabled: !!business?.id && !!phone && open,
  });

  // Create new tag
  const createTagMutation = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error('Negócio não encontrado');
      const { data, error } = await supabase
        .from('conversation_tags')
        .insert({
          business_id: business.id,
          name: newTagName.trim(),
          color: newTagColor,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Etiqueta criada!' });
      queryClient.invalidateQueries({ queryKey: ['conversation-tags'] });
      setNewTagName('');
      setShowNewTagForm(false);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar etiqueta',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  // Toggle tag assignment
  const toggleTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      if (!business?.id) throw new Error('Negócio não encontrado');
      
      const isAssigned = assignedTags?.includes(tagId);
      
      if (isAssigned) {
        const { error } = await supabase
          .from('conversation_tag_assignments')
          .delete()
          .eq('business_id', business.id)
          .eq('tag_id', tagId)
          .eq('phone', phone);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('conversation_tag_assignments')
          .insert({
            business_id: business.id,
            tag_id: tagId,
            phone: phone,
          });
        if (error) throw error;
      }
      
      return { tagId, action: isAssigned ? 'removed' : 'added' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tag-assignments'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar etiqueta',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  // Delete tag
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('conversation_tags')
        .delete()
        .eq('id', tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Etiqueta removida!' });
      queryClient.invalidateQueries({ queryKey: ['conversation-tags'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-tag-assignments'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover etiqueta',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const isLoading = tagsLoading || assignmentsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Etiquetas
          </DialogTitle>
          <DialogDescription>
            Adicione etiquetas para organizar suas conversas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new tag */}
          {showNewTagForm ? (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="tagName">Nome da etiqueta</Label>
                <Input
                  id="tagName"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Ex: Urgente, VIP, Follow-up..."
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewTagColor(color)}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform',
                        newTagColor === color ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => createTagMutation.mutate()}
                  disabled={!newTagName.trim() || createTagMutation.isPending}
                >
                  {createTagMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Criar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewTagForm(false);
                    setNewTagName('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setShowNewTagForm(true)}
            >
              <Plus className="h-4 w-4" />
              Criar nova etiqueta
            </Button>
          )}

          {/* Tag list */}
          <ScrollArea className="h-64">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allTags && allTags.length > 0 ? (
              <div className="space-y-2">
                {allTags.map((tag) => {
                  const isAssigned = assignedTags?.includes(tag.id);
                  return (
                    <div
                      key={tag.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer group',
                        isAssigned ? 'bg-accent' : 'hover:bg-muted/50'
                      )}
                      onClick={() => toggleTagMutation.mutate(tag.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm font-medium">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isAssigned && (
                          <Check className="h-4 w-4 text-success" />
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTagMutation.mutate(tag.id);
                          }}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma etiqueta criada ainda.
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}