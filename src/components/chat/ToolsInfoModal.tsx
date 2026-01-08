import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Phone, 
  Link2, 
  Bell, 
  Upload, 
  Download, 
  Webhook, 
  Radio, 
  EyeOff,
  Users,
  CheckCircle2,
  Info
} from 'lucide-react';

interface ToolsInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tools = [
  {
    id: 'validator',
    label: 'Validar Números WhatsApp',
    description: 'Verifique se números de telefone possuem WhatsApp ativo. Cole até 100 números e valide instantaneamente.',
    icon: Phone,
    status: 'ready',
  },
  {
    id: 'link-generator',
    label: 'Gerador de Link wa.me',
    description: 'Crie links diretos para WhatsApp com mensagem pré-definida. Ideal para compartilhar em redes sociais e sites.',
    icon: Link2,
    status: 'ready',
  },
  {
    id: 'reminders',
    label: 'Meus Lembretes',
    description: 'Crie lembretes para acompanhamento de clientes e leads. Receba notificações no horário agendado.',
    icon: Bell,
    status: 'ready',
  },
  {
    id: 'import-leads',
    label: 'Importar Leads',
    description: 'Importe leads de planilhas Excel ou CSV. Mapeie colunas automaticamente para os campos do sistema.',
    icon: Upload,
    status: 'ready',
  },
  {
    id: 'import-customers',
    label: 'Importar Clientes',
    description: 'Importe clientes existentes de planilhas. Suporta Excel (.xlsx) e CSV com mapeamento flexível.',
    icon: Upload,
    status: 'ready',
  },
  {
    id: 'export-contacts',
    label: 'Exportar Contatos',
    description: 'Exporte leads e clientes para planilha. Escolha quais campos incluir na exportação.',
    icon: Download,
    status: 'ready',
  },
  {
    id: 'extract-groups',
    label: 'Extrair Contatos de Grupos',
    description: 'Extraia participantes de grupos do WhatsApp. Salve como leads, clientes ou exporte para CSV.',
    icon: Users,
    status: 'ready',
  },
  {
    id: 'webhooks',
    label: 'Gerenciar Webhooks',
    description: 'Configure webhooks para integrar com sistemas externos. Receba notificações de eventos em tempo real.',
    icon: Webhook,
    status: 'ready',
  },
  {
    id: 'broadcasts',
    label: 'Transmissões em Massa',
    description: 'Envie mensagens em massa para múltiplos contatos. Agende campanhas e acompanhe resultados.',
    icon: Radio,
    status: 'ready',
  },
  {
    id: 'privacy',
    label: 'Modo Privacidade',
    description: 'Oculte informações sensíveis na tela. Ideal para demonstrações ou uso em locais públicos.',
    icon: EyeOff,
    status: 'ready',
  },
];

export function ToolsInfoModal({ open, onOpenChange }: ToolsInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Ferramentas Disponíveis
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-3">
            {tools.map((tool) => (
              <div 
                key={tool.id}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <tool.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{tool.label}</h4>
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Pronto
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
