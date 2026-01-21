import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter } from 'lucide-react';

interface FunnelStage {
  name: string;
  value: number;
  color: string;
}

interface ConversionFunnelProps {
  stages: FunnelStage[];
}

export function ConversionFunnel({ stages }: ConversionFunnelProps) {
  const maxValue = stages[0]?.value || 1;

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const percentage = (stage.value / maxValue) * 100;
            const conversionRate = index > 0 
              ? ((stage.value / stages[index - 1].value) * 100).toFixed(1)
              : '100.0';

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{stage.value} leads</span>
                    {index > 0 && (
                      <span className="text-xs font-semibold text-success">
                        {conversionRate}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-12 rounded-lg overflow-hidden bg-muted/30">
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500 flex items-center justify-center"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${stage.color} 0%, ${stage.color}dd 100%)`,
                    }}
                  >
                    <span className="text-sm font-bold text-white drop-shadow-md">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
