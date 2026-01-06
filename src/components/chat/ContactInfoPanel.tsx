import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  UserPlus,
  Building2,
  Thermometer,
  X,
  Target,
  FileText,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactInfo {
  name: string | null;
  phone: string;
  email?: string | null;
  company?: string | null;
  source?: string | null;
  temperature?: 'cold' | 'warm' | 'hot' | null;
  status?: string;
  createdAt: string;
}

interface ContactInfoPanelProps {
  contact: ContactInfo | null;
  type: 'lead' | 'customer' | 'new';
  onConvertToCustomer?: () => void;
  onCreateOpportunity?: () => void;
  onCreateInvoice?: () => void;
  onScheduleMessage?: () => void;
  onClose?: () => void;
}

export function ContactInfoPanel({
  contact,
  type,
  onConvertToCustomer,
  onCreateOpportunity,
  onCreateInvoice,
  onScheduleMessage,
  onClose,
}: ContactInfoPanelProps) {
  if (!contact) return null;

  const getInitials = (name: string | null, phone: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return phone.slice(-2);
  };

  const getTemperatureInfo = (temp: string | null | undefined) => {
    switch (temp) {
      case 'hot':
        return { label: 'Quente', className: 'text-destructive' };
      case 'warm':
        return { label: 'Morno', className: 'text-warning' };
      case 'cold':
        return { label: 'Frio', className: 'text-primary' };
      default:
        return null;
    }
  };

  const tempInfo = getTemperatureInfo(contact.temperature);

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="font-medium text-foreground">Informações</h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Avatar and name */}
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-3">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                {getInitials(contact.name, contact.phone)}
              </AvatarFallback>
            </Avatar>
            <h4 className="text-lg font-medium text-foreground">
              {contact.name || 'Sem nome'}
            </h4>
            <span
              className={
                type === 'customer'
                  ? 'text-success text-sm'
                  : type === 'lead'
                  ? 'text-warning text-sm'
                  : 'text-muted-foreground text-sm'
              }
            >
              {type === 'customer' ? 'Cliente' : type === 'lead' ? 'Lead' : 'Novo contato'}
            </span>
          </div>

          <Separator />

          {/* Contact details */}
          <div className="space-y-3">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Contato
            </h5>
            
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{contact.phone}</span>
            </div>

            {contact.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground truncate">{contact.email}</span>
              </div>
            )}

            {contact.company && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{contact.company}</span>
              </div>
            )}
          </div>

          {type === 'lead' && (
            <>
              <Separator />
              
              <div className="space-y-3">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lead Info
                </h5>

                {contact.source && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground">Origem: {contact.source}</span>
                  </div>
                )}

                {tempInfo && (
                  <div className="flex items-center gap-3 text-sm">
                    <Thermometer className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className={tempInfo.className}>{tempInfo.label}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Histórico
            </h5>
            
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">
                Desde {format(new Date(contact.createdAt), "d 'de' MMM, yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="border-t border-border p-4 space-y-2">
        {(type === 'lead' || type === 'new') && onConvertToCustomer && (
          <Button onClick={onConvertToCustomer} className="w-full">
            <UserPlus className="h-4 w-4 mr-2" />
            {type === 'lead' ? 'Converter para Cliente' : 'Adicionar como Cliente'}
          </Button>
        )}
        
        {onCreateOpportunity && (
          <Button onClick={onCreateOpportunity} variant="outline" className="w-full">
            <Target className="h-4 w-4 mr-2" />
            Criar Oportunidade
          </Button>
        )}
        
        {onCreateInvoice && (
          <Button onClick={onCreateInvoice} variant="outline" className="w-full">
            <FileText className="h-4 w-4 mr-2" />
            Criar Cobrança
          </Button>
        )}
        
        {onScheduleMessage && (
          <Button onClick={onScheduleMessage} variant="outline" className="w-full">
            <Clock className="h-4 w-4 mr-2" />
            Agendar Mensagem
          </Button>
        )}
      </div>
    </div>
  );
}