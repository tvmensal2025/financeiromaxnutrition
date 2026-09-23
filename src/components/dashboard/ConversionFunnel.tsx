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
  const vazio = stages.length === 0 || stages.every((s) => s.value <= 0);

  return (
    <Card className="premium-card border border-border/60 bg-card/90 backdrop-blur-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Filter className="h-5 w-5 text-primary" />
              Como os Contatos Viram Clientes (Funil de Vendas)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Etapas desde a primeira descoberta até o contrato assinado
            </p>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/30 self-start sm:self-auto">
            Conversão Passo a Passo
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {vazio ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma oportunidade no CRM para montar o funil. Cadastre leads no pipeline.
          </p>
        ) : (
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const percentage = Math.max(8, (stage.value / maxValue) * 100);
            const conversionRate = index > 0 
              ? ((stage.value / stages[index - 1].value) * 100).toFixed(1)
              : '100.0';

            return (
              <div key={index} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{stage.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-muted-foreground">
                      {stage.value.toLocaleString('pt-BR')} oportunidade(s)
                    </span>
                    {index > 0 && (
                      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {conversionRate}% avançaram
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-10 rounded-xl overflow-hidden bg-muted/40 border border-border/20 p-1">
                  <div
                    className="h-full rounded-lg transition-all duration-700 flex items-center justify-between px-3 shadow-sm"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${stage.color} 0%, ${stage.color}ee 100%)`,
                    }}
                  >
                    <span className="text-[11px] font-bold text-white drop-shadow-sm">
                      {((stage.value / maxValue) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
