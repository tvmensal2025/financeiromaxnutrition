/**
 * MessagesHeader Component
 * 
 * Feature: project-refactoring
 * Requirements: 6.5
 * 
 * Extracts header section from Messages.tsx:
 * - Includes bulk message, templates, scheduled buttons
 * - Includes info panel toggle
 * - Responsive design for mobile/desktop
 */

import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelRightOpen, Send, FileText, Clock } from 'lucide-react';
import { ToolsMenu } from '@/components/chat/ToolsMenu';

interface MessagesHeaderProps {
  /** Total number of conversations */
  conversationsCount: number;
  /** Whether info panel is shown (desktop only) */
  showInfoPanel: boolean;
  /** Whether a conversation is selected (affects info panel toggle visibility) */
  hasSelectedConversation: boolean;
  /** Whether in mobile view */
  isMobileView: boolean;
  /** Callback to toggle info panel */
  onToggleInfoPanel: () => void;
  /** Callback to open bulk message modal */
  onOpenBulkMessage: () => void;
  /** Callback to open templates modal */
  onOpenTemplates: () => void;
  /** Callback to open scheduled messages modal */
  onOpenScheduled: () => void;
}

/**
 * Header component for Messages page
 * 
 * Displays page title, conversation count, and action buttons.
 * Includes responsive design for mobile and desktop layouts.
 */
export function MessagesHeader({
  conversationsCount,
  showInfoPanel,
  hasSelectedConversation,
  isMobileView,
  onToggleInfoPanel,
  onOpenBulkMessage,
  onOpenTemplates,
  onOpenScheduled,
}: MessagesHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shrink-0">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Mensagens</h1>
        <p className="text-sm text-muted-foreground">
          {conversationsCount} conversa{conversationsCount !== 1 && 's'}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Desktop action buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onOpenBulkMessage}
          >
            <Send className="h-4 w-4 mr-1" />
            Disparo em Massa
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenTemplates}
          >
            <FileText className="h-4 w-4 mr-1" />
            Modelos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenScheduled}
          >
            <Clock className="h-4 w-4 mr-1" />
            Agendadas
          </Button>
          <ToolsMenu />
        </div>
        
        {/* Info panel toggle (desktop only, when conversation is selected) */}
        {!isMobileView && hasSelectedConversation && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleInfoPanel}
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
  );
}