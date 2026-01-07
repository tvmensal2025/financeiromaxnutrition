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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, FileText, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateButton {
  text: string;
  type: 'reply' | 'link';
  url?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  emoji: string;
  buttons: TemplateButton[];
  created_at: string;
}

interface MessageTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate?: (content: string) => void;
}

const AVAILABLE_VARIABLES = [
  { key: '{{nome}}', label: 'Nome', description: 'Nome do contato' },
  { key: '{{telefone}}', label: 'Telefone', description: 'Número de telefone' },
  { key: '{{empresa}}', label: 'Empresa', description: 'Nome da empresa' },
  { key: '{{data}}', label: 'Data', description: 'Data atual' },
  { key: '{{hora}}', label: 'Hora', description: 'Hora atual' },
];

const EMOJI_OPTIONS = ['📝', '👋', '😊', '🙏', '❤️', '✅', '🔥', '⭐', '💬', '📌', '🎉', '💡', '🛒', '💰', '📦', '🚀'];

export function MessageTemplatesModal({
  open,
  onOpenChange,
  onSelectTemplate,
}: MessageTemplatesModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    content: '', 
    emoji: '📝',
    buttons: [] as TemplateButton[]
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(t => ({
        id: t.id,
        name: t.name,
        content: t.content,
        created_at: t.created_at,
        emoji: (t.emoji as string) || '📝',
        buttons: (Array.isArray(t.buttons) ? t.buttons : []) as unknown as TemplateButton[]
      }));
    },
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error('Business not found');
      const { error } = await supabase.from('message_templates').insert([{
        business_id: business.id,
        name: formData.name,
        content: formData.content,
        emoji: formData.emoji,
        buttons: JSON.parse(JSON.stringify(formData.buttons)),
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Modelo criado!', description: 'Seu modelo de mensagem foi salvo.' });
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível criar o modelo.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTemplate) throw new Error('No template selected');
      const { error } = await supabase
        .from('message_templates')
        .update({ 
          name: formData.name, 
          content: formData.content,
          emoji: formData.emoji,
          buttons: JSON.parse(JSON.stringify(formData.buttons)),
        })
        .eq('id', editingTemplate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Modelo atualizado!', description: 'As alterações foram salvas.' });
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o modelo.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('message_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Modelo excluído!', description: 'O modelo foi removido.' });
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível excluir o modelo.', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setIsEditing(false);
    setEditingTemplate(null);
    setFormData({ name: '', content: '', emoji: '📝', buttons: [] });
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({ 
      name: template.name, 
      content: template.content,
      emoji: template.emoji || '📝',
      buttons: template.buttons || []
    });
    setIsEditing(true);
  };

  const handleInsertVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      content: prev.content + variable,
    }));
  };

  const handleSelectTemplate = (template: MessageTemplate) => {
    if (onSelectTemplate) {
      // Format message with buttons
      let finalContent = template.content;
      if (template.buttons && template.buttons.length > 0) {
        finalContent += '\n\n';
        template.buttons.forEach((btn, idx) => {
          if (btn.type === 'reply') {
            finalContent += `${idx + 1}️⃣ ${btn.text}\n`;
          } else if (btn.type === 'link' && btn.url) {
            finalContent += `🔗 ${btn.text}: ${btn.url}\n`;
          }
        });
      }
      onSelectTemplate(finalContent.trim());
      onOpenChange(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const addButton = () => {
    setFormData(prev => ({
      ...prev,
      buttons: [...prev.buttons, { text: '', type: 'reply' }]
    }));
  };

  const updateButton = (index: number, field: keyof TemplateButton, value: string) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.map((btn, i) => 
        i === index ? { ...btn, [field]: value } : btn
      )
    }));
  };

  const removeButton = (index: number) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Modelos de Mensagem
          </DialogTitle>
          <DialogDescription>
            Crie e gerencie modelos de mensagem com variáveis e botões.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* Lista de modelos */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Modelos salvos</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsEditing(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Novo
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-lg p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum modelo criado ainda
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent',
                        editingTemplate?.id === template.id && 'ring-2 ring-primary'
                      )}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            <span className="mr-1.5">{template.emoji}</span>
                            {template.name}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {template.content}
                          </p>
                          {template.buttons && template.buttons.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {template.buttons.map((btn, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {btn.type === 'link' ? <LinkIcon className="h-3 w-3 mr-1" /> : null}
                                  {btn.text}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(template);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(template.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Formulário de edição */}
          <div className="flex flex-col min-h-0">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="flex flex-col h-full gap-3">
                <div className="flex gap-2">
                  {/* Emoji picker */}
                  <div className="space-y-2">
                    <Label>Emoji</Label>
                    <Select 
                      value={formData.emoji} 
                      onValueChange={(value) => setFormData({ ...formData, emoji: value })}
                    >
                      <SelectTrigger className="w-16 h-10">
                        <SelectValue>{formData.emoji}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <div className="grid grid-cols-4 gap-1 p-1">
                          {EMOJI_OPTIONS.map((emoji) => (
                            <SelectItem 
                              key={emoji} 
                              value={emoji}
                              className="flex items-center justify-center text-lg cursor-pointer"
                            >
                              {emoji}
                            </SelectItem>
                          ))}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="name">Nome do modelo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Boas-vindas"
                      required
                    />
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                  <Label htmlFor="content">Conteúdo</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Olá {{nome}}, tudo bem?"
                    className="flex-1 min-h-[80px] resize-none"
                    required
                  />
                </div>

                {/* Buttons section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Botões de Resposta / Links</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      className="h-7 text-xs"
                      onClick={addButton}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {formData.buttons.length > 0 && (
                    <div className="space-y-2 max-h-[120px] overflow-y-auto">
                      {formData.buttons.map((btn, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Select 
                            value={btn.type} 
                            onValueChange={(value) => updateButton(idx, 'type', value)}
                          >
                            <SelectTrigger className="w-24 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reply">Resposta</SelectItem>
                              <SelectItem value="link">Link</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={btn.text}
                            onChange={(e) => updateButton(idx, 'text', e.target.value)}
                            placeholder="Texto do botão"
                            className="flex-1 h-8 text-xs"
                          />
                          {btn.type === 'link' && (
                            <Input
                              value={btn.url || ''}
                              onChange={(e) => updateButton(idx, 'url', e.target.value)}
                              placeholder="https://..."
                              className="flex-1 h-8 text-xs"
                            />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => removeButton(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Variáveis disponíveis</Label>
                  <div className="flex flex-wrap gap-1">
                    {AVAILABLE_VARIABLES.map((v) => (
                      <Badge
                        key={v.key}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleInsertVariable(v.key)}
                        title={v.description}
                      >
                        {v.key}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingTemplate ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 border rounded-lg bg-muted/30">
                <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Selecione um modelo para usar ou clique em "Novo" para criar
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
