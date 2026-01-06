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
        <div className="p-4 space-y-4">
          {/* Avatar and name - compact */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {getInitials(contact.name, contact.phone)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-foreground truncate">
                {contact.name || 'Sem nome'}
              </h4>
              <span
                className={
                  type === 'customer'
                    ? 'text-success text-xs'
                    : type === 'lead'
                    ? 'text-warning text-xs'
                    : 'text-muted-foreground text-xs'
                }
              >
                {type === 'customer' ? 'Cliente' : type === 'lead' ? 'Lead' : 'Novo contato'}
              </span>
            </div>
          </div>

          {/* Premium Actions - NO TOPO */}
          <div className="space-y-3">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ações Rápidas
            </h5>
            
            {/* Primary Action */}
            {(type === 'lead' || type === 'new') && onConvertToCustomer && (
              <Button 
                onClick={onConvertToCustomer} 
                className="w-full h-11 text-left justify-start gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
              >
                <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <UserPlus className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {type === 'lead' ? 'Converter para Cliente' : 'Adicionar como Cliente'}
                  </p>
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
                  <CardContent className="p-2.5 flex flex-col items-center text-center gap-1.5">
                    <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Target className="h-4 w-4 text-warning" />
                    </div>
                    <p className="text-[11px] font-medium text-foreground">Oportunidade</p>
                  </CardContent>
                </Card>
              )}
              
              {onCreateInvoice && (
                <Card 
                  className="cursor-pointer hover:bg-accent transition-colors border-dashed group"
                  onClick={onCreateInvoice}
                >
                  <CardContent className="p-2.5 flex flex-col items-center text-center gap-1.5">
                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="h-4 w-4 text-success" />
                    </div>
                    <p className="text-[11px] font-medium text-foreground">Cobrança</p>
                  </CardContent>
                </Card>
              )}
              
              {onScheduleMessage && (
                <Card 
                  className="cursor-pointer hover:bg-accent transition-colors border-dashed group"
                  onClick={onScheduleMessage}
                >
                  <CardContent className="p-2.5 flex flex-col items-center text-center gap-1.5">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CalendarClock className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[11px] font-medium text-foreground">Agendar</p>
                  </CardContent>
                </Card>
              )}
              
              <Card 
                className="cursor-pointer hover:bg-accent transition-colors border-dashed group opacity-60"
              >
                <CardContent className="p-2.5 flex flex-col items-center text-center gap-1.5">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-[11px] font-medium text-foreground">Plano</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Contact details */}
          <div className="space-y-2.5">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Contato
            </h5>
            
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground text-xs">{contact.phone}</span>
            </div>

            {contact.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground text-xs truncate">{contact.email}</span>
              </div>
            )}

            {contact.company && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground text-xs">{contact.company}</span>
              </div>
            )}
          </div>

          {type === 'lead' && (
            <>
              <Separator />
              
              <div className="space-y-2.5">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lead Info
                </h5>

                {contact.source && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground text-xs">Origem: {contact.source}</span>
                  </div>
                )}

                {tempInfo && (
                  <div className="flex items-center gap-3 text-sm">
                    <Thermometer className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className={`text-xs ${tempInfo.className}`}>{tempInfo.label}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2.5">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Histórico
            </h5>
            
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground text-xs">
                Desde {format(new Date(contact.createdAt), "d 'de' MMM, yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          {type === 'customer' && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total em compras</span>
                  <span className="font-semibold text-foreground">R$ 0,00</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Faturas pendentes</span>
                  <Badge variant="outline" className="text-[10px]">0</Badge>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}