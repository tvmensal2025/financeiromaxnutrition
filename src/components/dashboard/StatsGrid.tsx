import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stat {
  label: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color: 'primary' | 'success' | 'warning' | 'destructive';
}

interface StatsGridProps {
  stats: Stat[];
}

const colorClasses = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    glow: 'shadow-[0_0_20px_hsl(var(--primary)/0.2)]',
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    glow: 'shadow-[0_0_20px_hsl(var(--success)/0.2)]',
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    glow: 'shadow-[0_0_20px_hsl(var(--warning)/0.2)]',
  },
  destructive: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
    glow: 'shadow-[0_0_20px_hsl(var(--destructive)/0.2)]',
  },
};

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const colors = colorClasses[stat.color];
        const Icon = stat.icon;
        
        return (
          <div
            key={index}
            className={cn(
              'group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1',
              colors.border,
              'hover:' + colors.glow
            )}
          >
            {/* Background Gradient */}
            <div
              className={cn(
                'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                colors.bg
              )}
            />

            {/* Content */}
            <div className="relative flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold tracking-tight">
                  {stat.value}
                </p>
                {stat.change !== undefined && (
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        stat.change >= 0 ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {stat.change >= 0 ? '+' : ''}
                      {stat.change}%
                    </span>
                    <span className="text-xs text-muted-foreground">vs mês anterior</span>
                  </div>
                )}
              </div>

              {/* Icon */}
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
                  colors.bg
                )}
              >
                <Icon className={cn('h-7 w-7', colors.text)} />
              </div>
            </div>

            {/* Decorative Element */}
            <div
              className={cn(
                'absolute -bottom-1 -right-1 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20',
                colors.bg
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
