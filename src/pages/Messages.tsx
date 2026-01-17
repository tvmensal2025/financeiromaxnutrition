import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ConversationsList, ConversationStatus } from '@/components/chat/ConversationsList';
import { ChatArea } from '@/components/chat/ChatArea';
import { ContactInfoPanel } from '@/components/chat/ContactInfoPanel';
import { GroupParticipantsPanel } from '@/components/chat/GroupParticipantsPanel';
import { cn } from '@/lib/utils';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { AddCustomerModal } from '@/components/chat/AddCustomerModal';
import { CreateOpportunityModal } from '@/components/chat/CreateOpportunityModal';
import { CreateInvoiceModal } from '@/components/chat/CreateInvoiceModal';
import { ScheduleMessageModal } from '@/components/chat/ScheduleMessageModal';
import { MessageTemplatesModal } from '@/components/chat/MessageTemplatesModal';
import { BulkMessageModal } from '@/components/chat/BulkMessageModal';
import { ExtractContactsModal } from '@/components/chat/ExtractContactsModal';
import { ScheduledMessagesListModal } from '@/components/chat/ScheduledMessagesListModal';

// Import hooks and components
import {
  useConversations,
  useSelectedMessages,
  useContactInfo,
  useCustomerStats,
  useMessagesModals,
  useMessagesMutations,
  useWhatsAppMessages,
  useLeadsData,
  useCustomersData,
  useMessagesRealtime,
  useCustomerInvoices,
  useCustomerOpportunities,
  useScheduledMessages,
  useMessagesHandlers,
} from '@/hooks/messages';
import { MessagesHeader } from '@/components/messages';

export default function Messages() {
  const { business, user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [phoneFromUrl, setPhoneFromUrl] = useState<string | null>(null);

  // Check for phone parameter in URL (from LeadsExternos)
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    if (phoneParam) {
      setPhoneFromUrl(phoneParam);
    }
  }, [searchParams]);
  
  // Use new modal management hook
  const {
    showAddCustomerModal,
    showOpportunityModal,
    showInvoiceModal,
    showScheduleModal,
    showTemplatesModal,
    showBulkMessageModal,
    showExtractContactsModal,
    showScheduledListModal,
    openModal,
    closeModal,
  } = useMessagesModals();

  // Check screen size
  useEffect(() => {
    const checkSize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Fetch data using hooks
  const { data: allMessages = [], isLoading: messagesLoading } = useWhatsAppMessages(user?.id);
  const { data: leads = [] } = useLeadsData(business?.id);
  const { data: customers = [] } = useCustomersData(business?.id);

  // Set up real-time subscription
  useMessagesRealtime(user?.id);

  // Use conversation hooks
  const conversations = useConversations(allMessages);
  const selectedMessages = useSelectedMessages(allMessages, selectedPhone);
  const selectedConversation = conversations.find((c) => c.phone === selectedPhone);
  const { contactInfo, contactType } = useContactInfo(selectedConversation, selectedPhone, customers, leads);

  // Fetch contact-related data
  const { data: customerInvoices = [] } = useCustomerInvoices(business?.id, selectedConversation?.customer_id);
  const { data: customerOpportunities = [] } = useCustomerOpportunities(business?.id, selectedConversation?.customer_id);
  const { data: scheduledMessages = [] } = useScheduledMessages(business?.id, selectedConversation, selectedPhone);

  // Use customer stats hook
  const customerStats = useCustomerStats(selectedConversation, customers, customerInvoices, customerOpportunities);

  // Use mutations hook
  const mutations = useMessagesMutations(user?.id, business?.id);

  // Use handlers hook
  const handlers = useMessagesHandlers({
    mutations,
    selectedPhone,
    selectedConversation,
    businessId: business?.id,
    isMobileView,
    setSelectedPhone,
    setShowChat,
  });

  // Auto-select conversation when phone comes from URL
  useEffect(() => {
    if (phoneFromUrl && conversations.length > 0 && !selectedPhone) {
      // Find conversation matching the phone (with or without country code)
      const matchingConversation = conversations.find(c => 
        c.phone.includes(phoneFromUrl) || phoneFromUrl.includes(c.phone.replace(/\D/g, ''))
      );
      if (matchingConversation) {
        setSelectedPhone(matchingConversation.phone);
        setShowChat(true);
      }
    }
  }, [phoneFromUrl, conversations, selectedPhone]);

  const commonChatProps = {
    phone: selectedPhone,
    contactName: contactInfo?.name || null,
    contactType,
    conversationStatus: selectedConversation?.conversation_status,
    messages: selectedMessages,
    isLoading: messagesLoading && !!selectedPhone,
    isSending: mutations.sendMessage.isPending,
    onSend: handlers.handleSendMessage,
    onBack: handlers.handleBack,
    onViewParticipants: selectedConversation?.is_group ? () => setShowInfoPanel(true) : undefined,
    onUpdateConversationStatus: (status: ConversationStatus) =>
      selectedPhone && handlers.handleUpdateStatus(selectedPhone, status),
    leadId: selectedConversation?.lead_id,
    customerId: selectedConversation?.customer_id,
    email: contactInfo?.email,
  };

  const commonConversationsProps = {
    conversations,
    selectedPhone,
    onSelectConversation: handlers.handleSelectConversation,
    onApproveConversation: handlers.handleApproveConversation,
    onRejectConversation: handlers.handleRejectConversation,
    onUpdateStatus: handlers.handleUpdateStatus,
    isLoading: messagesLoading,
    showTitle: false,
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header using new component */}
        <MessagesHeader
          conversationsCount={conversations.length}
          showInfoPanel={showInfoPanel}
          hasSelectedConversation={!!selectedPhone}
          isMobileView={isMobileView}
          onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
          onOpenBulkMessage={() => openModal('showBulkMessageModal')}
          onOpenTemplates={() => openModal('showTemplatesModal')}
          onOpenScheduled={() => openModal('showScheduledListModal')}
        />

        {/* Main content */}
        {isMobileView ? (
          <div className="flex flex-1 overflow-hidden">
            <div className={cn('w-full overflow-hidden', showChat && 'hidden')}>
              <ConversationsList {...commonConversationsProps} />
            </div>
            <div className={cn('flex-1 overflow-hidden', !showChat && 'hidden')}>
              <ChatArea {...commonChatProps} showBack={true} />
            </div>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <ConversationsList {...commonConversationsProps} />
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={showInfoPanel && selectedPhone ? 50 : 75} minSize={30}>
              <ChatArea {...commonChatProps} showBack={false} />
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
                      onExtractContacts={() => openModal('showExtractContactsModal')}
                    />
                  ) : (
                    <ContactInfoPanel
                      contact={contactInfo}
                      type={contactType}
                      scheduledMessages={scheduledMessages}
                      customerStats={customerStats}
                      onConvertToCustomer={() => openModal('showAddCustomerModal')}
                      onCreateOpportunity={() => openModal('showOpportunityModal')}
                      onCreateInvoice={() => openModal('showInvoiceModal')}
                      onScheduleMessage={() => openModal('showScheduleModal')}
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
            onOpenChange={(open) => open ? openModal('showAddCustomerModal') : closeModal('showAddCustomerModal')}
            phone={selectedPhone}
            name={contactInfo?.name}
            email={contactInfo?.email}
            leadId={selectedConversation?.lead_id}
          />

          <CreateOpportunityModal
            open={showOpportunityModal}
            onOpenChange={(open) => open ? openModal('showOpportunityModal') : closeModal('showOpportunityModal')}
            leadId={selectedConversation?.lead_id}
            customerId={selectedConversation?.customer_id}
            contactName={contactInfo?.name}
          />

          <CreateInvoiceModal
            open={showInvoiceModal}
            onOpenChange={(open) => open ? openModal('showInvoiceModal') : closeModal('showInvoiceModal')}
            customerId={selectedConversation?.customer_id}
            contactName={contactInfo?.name}
            onNeedCustomer={() => openModal('showAddCustomerModal')}
          />

          <ScheduleMessageModal
            open={showScheduleModal}
            onOpenChange={(open) => open ? openModal('showScheduleModal') : closeModal('showScheduleModal')}
            phone={selectedPhone}
            leadId={selectedConversation?.lead_id}
            customerId={selectedConversation?.customer_id}
            contactName={contactInfo?.name}
          />
        </>
      )}

      {/* Global modals */}
      <MessageTemplatesModal
        open={showTemplatesModal}
        onOpenChange={(open) => open ? openModal('showTemplatesModal') : closeModal('showTemplatesModal')}
      />

      <BulkMessageModal
        open={showBulkMessageModal}
        onOpenChange={(open) => open ? openModal('showBulkMessageModal') : closeModal('showBulkMessageModal')}
        conversations={conversations}
        onOpenTemplates={() => openModal('showTemplatesModal')}
      />

      {selectedConversation?.is_group && (
        <ExtractContactsModal
          open={showExtractContactsModal}
          onOpenChange={(open) => open ? openModal('showExtractContactsModal') : closeModal('showExtractContactsModal')}
          groupPhone={selectedPhone || ''}
          groupName={selectedConversation?.group_name || null}
          businessId={business?.id}
        />
      )}

      <ScheduledMessagesListModal
        open={showScheduledListModal}
        onOpenChange={(open) => open ? openModal('showScheduledListModal') : closeModal('showScheduledListModal')}
      />
    </MainLayout>
  );
}