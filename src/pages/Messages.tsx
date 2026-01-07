import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ConversationsList, Conversation, ConversationStatus } from '@/components/chat/ConversationsList';
import { ChatArea } from '@/components/chat/ChatArea';
import { ContactInfoPanel } from '@/components/chat/ContactInfoPanel';
import { GroupParticipantsPanel } from '@/components/chat/GroupParticipantsPanel';
import { Message } from '@/components/chat/ChatMessage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelRightOpen, TestTube, Clock, Send, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { AddCustomerModal } from '@/components/chat/AddCustomerModal';
import { CreateOpportunityModal } from '@/components/chat/CreateOpportunityModal';
import { CreateInvoiceModal } from '@/components/chat/CreateInvoiceModal';
import { ScheduleMessageModal } from '@/components/chat/ScheduleMessageModal';
import { MessageTemplatesModal } from '@/components/chat/MessageTemplatesModal';
import { BulkMessageModal } from '@/components/chat/BulkMessageModal';
import { ExtractContactsModal } from '@/components/chat/ExtractContactsModal';

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
  is_group?: boolean;
  group_name?: string | null;
  participant_phone?: string | null;
  sender_avatar_url?: string | null;
  participant_count?: number;
  conversation_status?: ConversationStatus;
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
  
  // Modal states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showBulkMessageModal, setShowBulkMessageModal] = useState(false);
  const [showExtractContactsModal, setShowExtractContactsModal] = useState(false);

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

      // Paginação para não perder mensagens (o backend limita o nº de linhas por request)
      const pageSize = 1000;
      let from = 0;
      const results: WhatsAppMessage[] = [];

      while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (!data || data.length === 0) break;

        results.push(...(data as WhatsAppMessage[]));

        if (data.length < pageSize) break;
        from += pageSize;
      }

      return results;
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
    const unreadCountByPhone = new Map<string, number>();

    for (const m of allMessages) {
      if (m.direction === 'inbound' && m.status === 'pending') {
        unreadCountByPhone.set(m.phone, (unreadCountByPhone.get(m.phone) || 0) + 1);
      }
    }

    const phoneMap = new Map<string, Conversation>();

    // allMessages vem em ordem desc (mais recente primeiro)
    for (const msg of allMessages) {
      const isGroup = msg.phone.startsWith('group:') || msg.is_group;
      const existing = phoneMap.get(msg.phone);

      // Primeiro registro do phone é a última mensagem (por causa do order desc)
      if (!existing) {
        phoneMap.set(msg.phone, {
          phone: msg.phone,
          sender_name: msg.sender_name,
          lead_id: msg.lead_id,
          customer_id: msg.customer_id,
          last_message: msg.message,
          last_message_at: msg.created_at,
          unread_count: unreadCountByPhone.get(msg.phone) || 0,
          direction: msg.direction,
          is_group: isGroup,
          group_name: msg.group_name,
          participant_count: msg.participant_count || 0,
          avatar_url: msg.sender_avatar_url,
          conversation_status: msg.conversation_status || 'pending',
        });
        continue;
      }

      // Completar dados faltantes (principalmente em grupos)
      if (isGroup) {
        if (!existing.group_name && msg.group_name) existing.group_name = msg.group_name;
        if ((msg.participant_count || 0) > (existing.participant_count || 0)) {
          existing.participant_count = msg.participant_count || existing.participant_count || 0;
        }
      }

      if (!existing.sender_name && msg.sender_name) existing.sender_name = msg.sender_name;
      if (!existing.lead_id && msg.lead_id) existing.lead_id = msg.lead_id;
      if (!existing.customer_id && msg.customer_id) existing.customer_id = msg.customer_id;
      if (!existing.avatar_url && msg.sender_avatar_url) existing.avatar_url = msg.sender_avatar_url;
    }

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

  // Fetch scheduled messages for selected contact
  const { data: scheduledMessages = [] } = useQuery({
    queryKey: ['scheduled-messages', selectedConversation?.lead_id, selectedConversation?.customer_id, selectedPhone],
    queryFn: async () => {
      if (!business?.id) return [];
      
      let query = supabase
        .from('scheduled_messages')
        .select('*')
        .eq('business_id', business.id)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });

      if (selectedConversation?.customer_id) {
        query = query.eq('customer_id', selectedConversation.customer_id);
      } else if (selectedConversation?.lead_id) {
        query = query.eq('lead_id', selectedConversation.lead_id);
      } else if (selectedPhone) {
        query = query.eq('phone', selectedPhone);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id && !!selectedPhone,
  });
  
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
    mutationFn: async ({ message, media }: { message: string; media?: { file: File; type: string } }) => {
      if (!selectedPhone || !business?.id) throw new Error('Missing data');

      let mediaBase64: string | undefined;
      let mediaType: string | undefined;
      let mediaFilename: string | undefined;

      if (media) {
        // Convert file to base64
        const buffer = await media.file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        mediaBase64 = btoa(binary);
        mediaType = media.type;
        mediaFilename = media.file.name;
      }

      const { data, error } = await supabase.functions.invoke('send-evolution-message', {
        body: {
          phone: selectedPhone,
          message,
          business_id: business.id,
          lead_id: selectedConversation?.lead_id,
          customer_id: selectedConversation?.customer_id,
          media_base64: mediaBase64,
          media_type: mediaType,
          media_filename: mediaFilename,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', business?.id] });
        return;
      }

      toast({
        title: 'Erro ao enviar',
        description:
          data?.user_message || 'Não foi possível enviar a mensagem. Tente novamente.',
        variant: 'destructive',
      });
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

  // Test webhook mutation
  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error('Business not found');

      const testPayload = {
        event: 'messages.upsert',
        instance: 'test',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
            id: `test-${Date.now()}`,
          },
          pushName: 'Teste Manual',
          message: {
            conversation: `Mensagem de teste - ${new Date().toLocaleTimeString('pt-BR')}`,
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      };

      const { data, error } = await supabase.functions.invoke('whatsapp-webhook', {
        body: testPayload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Webhook testado!',
        description: 'Mensagem de teste inserida com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', business?.id] });
    },
    onError: (error) => {
      console.error('Test webhook error:', error);
      toast({
        title: 'Erro no teste',
        description: error instanceof Error ? error.message : 'Falha ao testar webhook',
        variant: 'destructive',
      });
    },
  });

  // Process scheduled messages mutation
  const processScheduledMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-scheduled-messages');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Agendamentos processados!',
        description: `${data?.results?.length || 0} mensagem(ns) processada(s).`,
      });
    },
    onError: (error) => {
      console.error('Process scheduled error:', error);
      toast({
        title: 'Erro ao processar',
        description: 'Falha ao processar mensagens agendadas.',
        variant: 'destructive',
      });
    },
  });

  // Update conversation status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ phone, status }: { phone: string; status: ConversationStatus }) => {
      if (!business?.id) throw new Error('Business not found');

      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ conversation_status: status })
        .eq('business_id', business.id)
        .eq('phone', phone);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', business?.id] });
    },
    onError: (error) => {
      console.error('Update status error:', error);
      toast({
        title: 'Erro ao atualizar status',
        description: 'Não foi possível atualizar o status da conversa.',
        variant: 'destructive',
      });
    },
  });

  const handleApproveConversation = (phone: string) => {
    updateStatusMutation.mutate({ phone, status: 'inbox' });
    toast({
      title: 'Conversa aprovada!',
      description: 'A conversa foi movida para Entrada.',
    });
  };

  const handleUpdateStatus = (phone: string, status: ConversationStatus) => {
    updateStatusMutation.mutate({ phone, status });
  };

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
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowBulkMessageModal(true)}
              >
                <Send className="h-4 w-4 mr-1" />
                Disparo em Massa
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplatesModal(true)}
              >
                <FileText className="h-4 w-4 mr-1" />
                Modelos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => processScheduledMutation.mutate()}
                disabled={processScheduledMutation.isPending}
              >
                <Clock className="h-4 w-4 mr-1" />
                {processScheduledMutation.isPending ? 'Processando...' : 'Agendadas'}
              </Button>
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
        </div>

        {/* Main content */}
        {isMobileView ? (
          // Mobile: no resizable panels
          <div className="flex flex-1 overflow-hidden">
            <div className={cn('w-full overflow-hidden', showChat && 'hidden')}>
              <ConversationsList
                conversations={conversations}
                selectedPhone={selectedPhone}
                onSelectConversation={handleSelectConversation}
                onApproveConversation={handleApproveConversation}
                onUpdateStatus={handleUpdateStatus}
                isLoading={messagesLoading}
                showTitle={false}
              />
            </div>
            <div className={cn('flex-1 overflow-hidden', !showChat && 'hidden')}>
              <ChatArea
                phone={selectedPhone}
                contactName={contactInfo?.name || null}
                contactType={contactType}
                conversationStatus={selectedConversation?.conversation_status}
                messages={selectedMessages}
                isLoading={messagesLoading && !!selectedPhone}
                isSending={sendMutation.isPending}
                onSend={(msg, media) => sendMutation.mutate({ message: msg, media })}
                onBack={handleBack}
                showBack={isMobileView}
                onViewParticipants={selectedConversation?.is_group ? () => setShowInfoPanel(true) : undefined}
                onUpdateConversationStatus={(status) => selectedPhone && handleUpdateStatus(selectedPhone, status)}
                leadId={selectedConversation?.lead_id}
                customerId={selectedConversation?.customer_id}
                email={contactInfo?.email}
              />
            </div>
          </div>
        ) : (
          // Desktop: resizable panels
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <ConversationsList
                conversations={conversations}
                selectedPhone={selectedPhone}
                onSelectConversation={handleSelectConversation}
                onApproveConversation={handleApproveConversation}
                onUpdateStatus={handleUpdateStatus}
                isLoading={messagesLoading}
                showTitle={false}
              />
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={showInfoPanel && selectedPhone ? 50 : 75} minSize={30}>
              <ChatArea
                phone={selectedPhone}
                contactName={contactInfo?.name || null}
                contactType={contactType}
                conversationStatus={selectedConversation?.conversation_status}
                messages={selectedMessages}
                isLoading={messagesLoading && !!selectedPhone}
                isSending={sendMutation.isPending}
                onSend={(msg, media) => sendMutation.mutate({ message: msg, media })}
                onBack={handleBack}
                showBack={false}
                onViewParticipants={selectedConversation?.is_group ? () => setShowInfoPanel(true) : undefined}
                onUpdateConversationStatus={(status) => selectedPhone && handleUpdateStatus(selectedPhone, status)}
                leadId={selectedConversation?.lead_id}
                customerId={selectedConversation?.customer_id}
                email={contactInfo?.email}
              />
            </ResizablePanel>

            {showInfoPanel && selectedPhone && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
                  {selectedConversation?.is_group ? (
                    <GroupParticipantsPanel
                      groupPhone={selectedPhone}
                      groupName={selectedConversation?.group_name || null}
                      businessId={business?.id}
                      onClose={() => setShowInfoPanel(false)}
                      onExtractContacts={() => setShowExtractContactsModal(true)}
                    />
                  ) : (
                    <ContactInfoPanel
                      contact={contactInfo}
                      type={contactType}
                      scheduledMessages={scheduledMessages}
                      onConvertToCustomer={() => setShowAddCustomerModal(true)}
                      onCreateOpportunity={() => setShowOpportunityModal(true)}
                      onCreateInvoice={() => setShowInvoiceModal(true)}
                      onScheduleMessage={() => setShowScheduleModal(true)}
                      onClose={() => setShowInfoPanel(false)}
                    />
                  )}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>

      {/* Modals */}
      {selectedPhone && (
        <>
          <AddCustomerModal
            open={showAddCustomerModal}
            onOpenChange={setShowAddCustomerModal}
            phone={selectedPhone}
            name={contactInfo?.name}
            email={contactInfo?.email}
            leadId={selectedConversation?.lead_id}
          />

          <CreateOpportunityModal
            open={showOpportunityModal}
            onOpenChange={setShowOpportunityModal}
            leadId={selectedConversation?.lead_id}
            customerId={selectedConversation?.customer_id}
            contactName={contactInfo?.name}
          />

          <CreateInvoiceModal
            open={showInvoiceModal}
            onOpenChange={setShowInvoiceModal}
            customerId={selectedConversation?.customer_id}
            contactName={contactInfo?.name}
            onNeedCustomer={() => setShowAddCustomerModal(true)}
          />

          <ScheduleMessageModal
            open={showScheduleModal}
            onOpenChange={setShowScheduleModal}
            phone={selectedPhone}
            leadId={selectedConversation?.lead_id}
            customerId={selectedConversation?.customer_id}
            contactName={contactInfo?.name}
          />
        </>
      )}

      {/* Modais globais */}
      <MessageTemplatesModal
        open={showTemplatesModal}
        onOpenChange={setShowTemplatesModal}
      />

      <BulkMessageModal
        open={showBulkMessageModal}
        onOpenChange={setShowBulkMessageModal}
        conversations={conversations}
        onOpenTemplates={() => setShowTemplatesModal(true)}
      />

      {selectedConversation?.is_group && (
        <ExtractContactsModal
          open={showExtractContactsModal}
          onOpenChange={setShowExtractContactsModal}
          groupPhone={selectedPhone || ''}
          groupName={selectedConversation?.group_name || null}
          businessId={business?.id}
        />
      )}
    </MainLayout>
  );
}