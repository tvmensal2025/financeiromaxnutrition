import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ConversationsList, Conversation } from '@/components/chat/ConversationsList';
import { ChatArea } from '@/components/chat/ChatArea';
import { ContactInfoPanel } from '@/components/chat/ContactInfoPanel';
import { Message } from '@/components/chat/ChatMessage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  sender_name: string | null;
  lead_id: string | null;
  customer_id: string | null;
  business_id: string;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  source: string | null;
  temperature: 'cold' | 'warm' | 'hot' | null;
  status: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  created_at: string;
}

export default function Messages() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Check screen size
  useEffect(() => {
    const checkSize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Fetch all WhatsApp messages
  const { data: allMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['whatsapp-messages', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!business?.id,
  });

  // Fetch leads and customers for contact info
  const { data: leads = [] } = useQuery({
    queryKey: ['leads', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('business_id', business.id);
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!business?.id,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business.id);
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!business?.id,
  });

  // Real-time subscription
  useEffect(() => {
    if (!business?.id) return;

    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `business_id=eq.${business.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', business.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business?.id, queryClient]);

  // Build conversations list
  const conversations: Conversation[] = useMemo(() => {
    const phoneMap = new Map<string, Conversation>();

    allMessages.forEach((msg) => {
      const existing = phoneMap.get(msg.phone);
      
      if (!existing || new Date(msg.created_at) > new Date(existing.last_message_at)) {
        const unreadCount = allMessages.filter(
          (m) => m.phone === msg.phone && m.direction === 'inbound' && m.status === 'pending'
        ).length;

        phoneMap.set(msg.phone, {
          phone: msg.phone,
          sender_name: msg.sender_name,
          lead_id: msg.lead_id,
          customer_id: msg.customer_id,
          last_message: msg.message,
          last_message_at: msg.created_at,
          unread_count: unreadCount,
          direction: msg.direction,
        });
      }
    });

    return Array.from(phoneMap.values()).sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
  }, [allMessages]);

  // Get messages for selected conversation
  const selectedMessages: Message[] = useMemo(() => {
    if (!selectedPhone) return [];
    return allMessages
      .filter((m) => m.phone === selectedPhone)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((m) => ({
        id: m.id,
        message: m.message,
        direction: m.direction,
        status: m.status,
        created_at: m.created_at,
        media_url: m.media_url,
        media_type: m.media_type,
        sender_name: m.sender_name,
      }));
  }, [allMessages, selectedPhone]);

  // Get selected conversation info
  const selectedConversation = conversations.find((c) => c.phone === selectedPhone);
  
  // Contact info
  const contactInfo = useMemo(() => {
    if (!selectedConversation) return null;

    if (selectedConversation.customer_id) {
      const customer = customers.find((c) => c.id === selectedConversation.customer_id);
      if (customer) {
        return {
          name: customer.name,
          phone: selectedPhone!,
          email: customer.email,
          createdAt: customer.created_at,
        };
      }
    }

    if (selectedConversation.lead_id) {
      const lead = leads.find((l) => l.id === selectedConversation.lead_id);
      if (lead) {
        return {
          name: lead.name,
          phone: selectedPhone!,
          email: lead.email,
          company: lead.company,
          source: lead.source,
          temperature: lead.temperature,
          status: lead.status,
          createdAt: lead.created_at,
        };
      }
    }

    return {
      name: selectedConversation.sender_name,
      phone: selectedPhone!,
      createdAt: selectedConversation.last_message_at,
    };
  }, [selectedConversation, selectedPhone, customers, leads]);

  const contactType: 'lead' | 'customer' | 'new' = selectedConversation?.customer_id
    ? 'customer'
    : selectedConversation?.lead_id
    ? 'lead'
    : 'new';

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedPhone || !business?.id) throw new Error('Missing data');

      const { data, error } = await supabase.functions.invoke('send-evolution-message', {
        body: {
          phone: selectedPhone,
          message,
          business_id: business.id,
          lead_id: selectedConversation?.lead_id,
          customer_id: selectedConversation?.customer_id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', business?.id] });
    },
    onError: (error) => {
      console.error('Send message error:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a mensagem. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleSelectConversation = (phone: string) => {
    setSelectedPhone(phone);
    if (isMobileView) {
      setShowChat(true);
    }
  };

  const handleBack = () => {
    setShowChat(false);
    setSelectedPhone(null);
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Mensagens</h1>
            <p className="text-sm text-muted-foreground">
              {conversations.length} conversa{conversations.length !== 1 && 's'}
            </p>
          </div>
          {!isMobileView && selectedPhone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfoPanel(!showInfoPanel)}
            >
              {showInfoPanel ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Conversations sidebar */}
          <div
            className={cn(
              'shrink-0 overflow-hidden transition-all',
              isMobileView
                ? showChat
                  ? 'w-0'
                  : 'w-full'
                : 'w-80'
            )}
          >
            <ConversationsList
              conversations={conversations}
              selectedPhone={selectedPhone}
              onSelectConversation={handleSelectConversation}
              isLoading={messagesLoading}
            />
          </div>

          {/* Chat area */}
          <div
            className={cn(
              'flex-1 overflow-hidden',
              isMobileView && !showChat && 'hidden'
            )}
          >
            <ChatArea
              phone={selectedPhone}
              contactName={contactInfo?.name || null}
              contactType={contactType}
              messages={selectedMessages}
              isLoading={messagesLoading && !!selectedPhone}
              isSending={sendMutation.isPending}
              onSend={(msg) => sendMutation.mutate(msg)}
              onBack={handleBack}
              showBack={isMobileView}
            />
          </div>

          {/* Info panel - desktop only */}
          {!isMobileView && showInfoPanel && selectedPhone && (
            <div className="w-72 shrink-0 overflow-hidden">
              <ContactInfoPanel
                contact={contactInfo}
                type={contactType}
                onClose={() => setShowInfoPanel(false)}
              />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}