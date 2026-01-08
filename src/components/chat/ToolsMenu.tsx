import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Wrench, 
  Link2, 
  Phone, 
  Upload, 
  Download, 
  Bell,
  Webhook,
  Radio,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ValidateNumberModal } from './ValidateNumberModal';
import { WhatsAppLinkGenerator } from './WhatsAppLinkGenerator';
import { ImportContactsModal } from './ImportContactsModal';
import { ExportContactsModal } from './ExportContactsModal';
import { RemindersModal } from './RemindersModal';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useNavigate } from 'react-router-dom';

export function ToolsMenu() {
  const navigate = useNavigate();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const [showValidator, setShowValidator] = useState(false);
  const [showLinkGenerator, setShowLinkGenerator] = useState(false);
  const [showImportLeads, setShowImportLeads] = useState(false);
  const [showImportCustomers, setShowImportCustomers] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showReminders, setShowReminders] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Wrench className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Ferramentas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowValidator(true)}>
            <Phone className="h-4 w-4 mr-2" />
            Validar Números WhatsApp
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowLinkGenerator(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Gerador de Link wa.me
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowReminders(true)}>
            <Bell className="h-4 w-4 mr-2" />
            Meus Lembretes
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Importar/Exportar</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => setShowImportLeads(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Leads
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowImportCustomers(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Clientes
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowExport(true)}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Contatos
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Integrações</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => navigate('/webhooks')}>
            <Webhook className="h-4 w-4 mr-2" />
            Gerenciar Webhooks
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => navigate('/broadcasts')}>
            <Radio className="h-4 w-4 mr-2" />
            Transmissões em Massa
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={togglePrivacyMode}>
            {isPrivacyMode ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Desativar Modo Privacidade
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Ativar Modo Privacidade
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ValidateNumberModal open={showValidator} onOpenChange={setShowValidator} />
      <WhatsAppLinkGenerator open={showLinkGenerator} onOpenChange={setShowLinkGenerator} />
      <ImportContactsModal open={showImportLeads} onOpenChange={setShowImportLeads} type="leads" />
      <ImportContactsModal open={showImportCustomers} onOpenChange={setShowImportCustomers} type="customers" />
      <ExportContactsModal open={showExport} onOpenChange={setShowExport} />
      <RemindersModal open={showReminders} onOpenChange={setShowReminders} />
    </>
  );
}
