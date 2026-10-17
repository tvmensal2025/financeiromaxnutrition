import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface PremiumKanbanColumnProps {
  title: string;
  count: number;
  totalValue: number | null;
  color: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export function PremiumKanbanColumn({
  title,
  count,
  totalValue,
  color,
  icon: Icon,
  children,
}: PremiumKanbanColumnProps) {
  return (
    <div className="flex flex-col w-80 shrink-0">
      {/* Column Header */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <Badge variant="secondary" className="font-semibold">
            {count}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-bold" style={{ color }}>
            {totalValue === null ? 'Não informado' : totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min((count / 10) * 100, 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>

      {/* Cards Container */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
        {children}
      </div>
    </div>
  );
}
