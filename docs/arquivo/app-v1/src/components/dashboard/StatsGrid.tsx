import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stat {
  label: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color: 'primary' | 'success' | 'warning' | 'destructive';
  description?: string;
}

interface StatsGridProps {
  stats: Stat[];
}

const colorClasses = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    borderTop: 'border-t-primary',
    glow: 'shadow-[0_0_25px_hsl(var(--primary)/0.25)]',
  },
  success: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/20',
    borderTop: 'border-t-emerald-500',
    glow: 'shadow-[0_0_25px_rgba(16,185,129,0.25)]',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/20',
    borderTop: 'border-t-amber-500',
    glow: 'shadow-[0_0_25px_rgba(245,158,11,0.25)]',
  },
  destructive: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    border: 'border-rose-500/20',
    borderTop: 'border-t-rose-500',
    glow: 'shadow-[0_0_25px_rgba(244,63,94,0.25)]',
  },
};

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map((stat, index) => {
        const colors = colorClasses[stat.color];
        const Icon = stat.icon;

        return (
          <div
            key={index}
            className={cn(
              'group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 p-5 transition-all duration-300 hover:-translate-y-1 backdrop-blur-md shadow-sm border-t-4',
              colors.borderTop,
              'hover:' + colors.glow,
              'hover:border-border'
            )}
          >
            {/* Background Subtle Gradient Glow */}
            <div
              className={cn(
                'absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none',
                colors.bg
              )}
            />

            {/* Content */}
            <div className="relative flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  {stat.label}
                </p>
                <p className="text-2xl lg:text-3xl font-black tracking-tight text-foreground truncate">
                  {stat.value}
                </p>

                {stat.change !== undefined && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold',
                        stat.change >= 0
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      )}
                    >
                      {stat.change >= 0 ? '+' : ''}
                      {Number(stat.change.toFixed(1))}%
                    </span>
                    <span className="text-[11px] text-muted-foreground">vs mês anterior</span>
                  </div>
                )}

                {stat.description && (
                  <p className="text-[11px] text-muted-foreground/80 pt-1 leading-snug">
                    {stat.description}
                  </p>
                )}
              </div>

              {/* Icon */}
              <div
                className={cn(
                  'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 shadow-sm',
                  colors.bg
                )}
              >
                <Icon className={cn('h-6 w-6', colors.text)} />
              </div>
            </div>

            {/* Decorative Glow Spot */}
            <div
              className={cn(
                'absolute -bottom-2 -right-2 h-20 w-20 rounded-full opacity-10 blur-xl transition-opacity duration-300 group-hover:opacity-30 pointer-events-none',
                colors.bg
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
