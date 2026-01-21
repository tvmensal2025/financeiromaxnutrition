import { useState } from 'react';
import { contactNoteQueries, contactNoteCRUD } from '@/factories';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Edit2, Save, X, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotesPanelProps {
  phone: string;
  customerId?: string;
  leadId?: string;
}

export function NotesPanel({ phone, customerId, leadId }: NotesPanelProps) {
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const { data: notes = [], isLoading } = contactNoteQueries.useEntities({
    filters: {
      where: { phone },
      orderBy: { field: 'created_at', direction: 'desc' }
    }
  });

  const { create: addNote } = contactNoteCRUD.useCreate();
  const { update: updateNote } = contactNoteCRUD.useUpdate();
  const { delete: deleteNote } = contactNoteCRUD.useDelete();

  const handleAdd = () => {
    if (newNote.trim()) {
      addNote({
        phone,
        customer_id: customerId || null,
        lead_id: leadId || null,
        content: newNote.trim(),
      }, {
        onSuccess: () => {
          setNewNote('');
          setIsAdding(false);
        }
      });
    }
  };

  const handleEdit = (note: any) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (editingId && editContent.trim()) {
      updateNote({
        id: editingId,
        content: editContent.trim(),
      }, {
        onSuccess: () => {
          setEditingId(null);
        }
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          Notas Internas
        </h4>
        {!isAdding && (
          <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="space-y-2">
          <Textarea
            placeholder="Adicione uma nota interna..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setNewNote(''); }}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!newNote.trim() || addNote.isPending}>
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[200px]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                {editingId === note.id ? (
                  <>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[60px] text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={updateNote.isPending}>
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(note.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(note)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive" 
                          onClick={() => deleteNote(note.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
