import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  MessageSquare,
  CreditCard,
  CalendarClock,
  ChevronRight,
  Repeat,
  Zap,
  TrendingUp,
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

      {/* Premium Actions */}
      <div className="border-t border-border p-4 space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Ações Rápidas
        </h5>
        
        {/* Primary Action */}
        {(type === 'lead' || type === 'new') && onConvertToCustomer && (
          <Button 
            onClick={onConvertToCustomer} 
            className="w-full h-12 text-left justify-start gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
          >
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {type === 'lead' ? 'Converter para Cliente' : 'Adicionar como Cliente'}
              </p>
              <p className="text-[10px] opacity-80">Promover para cliente ativo</p>
            </div>
            <ChevronRight className="h-4 w-4 opacity-60" />
          </Button>
        )}
        
        {/* Action Cards Grid */}
        <div className="grid grid-cols-2 gap-2">
          {onCreateOpportunity && (
            <Card 
              className="cursor-pointer hover:bg-accent transition-colors border-dashed group"
              onClick={onCreateOpportunity}
            >
              <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Oportunidade</p>
                  <p className="text-[10px] text-muted-foreground">Pipeline vendas</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {onCreateInvoice && (
            <Card 
              className="cursor-pointer hover:bg-accent transition-colors border-dashed group"
              onClick={onCreateInvoice}
            >
              <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Cobrança</p>
                  <p className="text-[10px] text-muted-foreground">Criar fatura</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {onScheduleMessage && (
            <Card 
              className="cursor-pointer hover:bg-accent transition-colors border-dashed group"
              onClick={onScheduleMessage}
            >
              <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CalendarClock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Agendar</p>
                  <p className="text-[10px] text-muted-foreground">Mensagem futura</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card 
            className="cursor-pointer hover:bg-accent transition-colors border-dashed group opacity-60"
          >
            <CardContent className="p-3 flex flex-col items-center text-center gap-2">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Repeat className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Plano</p>
                <p className="text-[10px] text-muted-foreground">Recorrência</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        {type === 'customer' && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total em compras</span>
              <span className="font-semibold text-foreground">R$ 0,00</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-muted-foreground">Faturas pendentes</span>
              <Badge variant="outline" className="text-[10px]">0</Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}