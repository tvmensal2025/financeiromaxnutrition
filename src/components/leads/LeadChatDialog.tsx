import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead } from '@/hooks/queries/useLeads';

interface WhatsAppMessage {
  id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  sender_name: string | null;
}

interface LeadChatDialogProps {
  lead: Lead | null;
  onClose: () => void;
  onSendMessage: (lead: Lead, message: string) => void;
  isSending: boolean;
}

export function LeadChatDialog({ lead, onClose, onSendMessage, isSending }: LeadChatDialogProps) {
  const { business } = useAuth();
  const [chatMessage, setChatMessage] = useState('');

  // Query messages for the selected lead
  const { data: leadMessages = [] } = useQuery({
    queryKey: ['whatsapp-messages', lead?.id],
    queryFn: async () => {
      if (!lead?.id || !business?.id) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('business_id', business.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!lead?.id && !!business?.id,
  });

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !lead) return;
    onSendMessage(lead, chatMessage);
    setChatMessage('');
  };

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Chat com {lead?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col h-[400px]">
          <ScrollArea className="flex-1 p-4 border rounded-lg mb-4">
            {leadMessages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma mensagem ainda
              </p>
            ) : (
              <div className="space-y-3">
                {leadMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.direction === 'outbound'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!chatMessage.trim() || isSending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}