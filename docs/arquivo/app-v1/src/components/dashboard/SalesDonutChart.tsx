import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Package } from 'lucide-react';

interface SalesDonutChartProps {
  data: Array<{ name: string; value: number; color: string }>;
}

export function SalesDonutChart({ data }: SalesDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const vazio = data.length === 0 || total <= 0;

  return (
    <Card className="premium-card border border-border/60 bg-card/90 backdrop-blur-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
          <Package className="h-5 w-5 text-primary" />
          De Onde Vem o Dinheiro
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Divisão das principais fontes de faturamento
        </p>
      </CardHeader>
      <CardContent className="pt-2">
        {vazio ? (
          <p className="flex min-h-[230px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Nenhuma entrada faturada por empresa neste recorte.
          </p>
        ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="w-full sm:w-[50%] h-[230px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString('pt-BR')} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                    'Faturado',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="w-full sm:w-[50%] space-y-3">
            {data.map((item, index) => {
              const perc = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
              return (
                <div key={index} className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-foreground">
                      R$ {item.value.toLocaleString('pt-BR')}
                    </p>
                    <span className="inline-block text-[10px] font-semibold text-primary">
                      {perc}% do total
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
