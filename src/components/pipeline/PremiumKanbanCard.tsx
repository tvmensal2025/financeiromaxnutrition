import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DollarSign, Calendar, TrendingUp, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PremiumKanbanCardProps {
  title: string;
  value: number | null;
  probability: number | null;
  customerName?: string;
  expectedCloseDate?: string;
  nextActionDate?: string;
  onClick: () => void;
}

export function PremiumKanbanCard({
  title,
  value,
  probability,
  customerName,
  expectedCloseDate,
  nextActionDate,
  onClick,
}: PremiumKanbanCardProps) {
  const dateLabel = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const canonicalDate = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(canonicalDate.getTime()) || canonicalDate.toISOString().slice(0, 10) !== value
      ? null : format(new Date(`${value}T12:00:00`), 'dd MMM', { locale: ptBR });
  };
  const nextAction = dateLabel(nextActionDate);
  const expectedClose = dateLabel(expectedCloseDate);
  const getProbabilityColor = (prob: number | null) => {
    if (prob === null || !Number.isFinite(prob)) return 'text-muted-foreground bg-muted';
    if (prob >= 75) return 'text-success bg-success/10';
    if (prob >= 50) return 'text-warning bg-warning/10';
    return 'text-muted-foreground bg-muted';
  };

  return (
    <Card
      className="group cursor-pointer border border-border/50 bg-card p-4 transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-sm line-clamp-2 flex-1 pr-2 group-hover:text-primary transition-colors">
          {title}
        </h4>
        <Badge className={`${getProbabilityColor(probability)} text-xs font-bold shrink-0`}>
          {probability !== null && Number.isFinite(probability) ? `${probability}%` : '—'}
        </Badge>
      </div>

      {/* Customer */}
      {customerName && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
              {customerName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{customerName}</span>
        </div>
      )}

      {/* Value */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-success/10">
          <DollarSign className="h-3.5 w-3.5 text-success" />
        </div>
        <span className="text-base font-bold text-success">
          {value === null ? 'Não informado' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        {nextAction || expectedClose ? (
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {nextAction && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Próx.: {nextAction}</span>
              </div>
            )}
            {expectedClose && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 opacity-60" />
                <span>Fecha: {expectedClose}</span>
              </div>
            )}
          </div>
        ) : (
          <div />
        )}
        
        <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Ver detalhes</span>
          <TrendingUp className="h-3 w-3" />
        </div>
      </div>
    </Card>
  );
}
