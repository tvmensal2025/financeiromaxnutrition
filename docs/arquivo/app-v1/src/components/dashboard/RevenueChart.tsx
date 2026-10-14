import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface RevenueChartProps {
  data: Array<{ month: string; revenue: number; expenses: number }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  const vazio = data.length === 0;

  return (
    <Card className="premium-card border border-border/60 bg-card/90 backdrop-blur-md">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Entradas vs Saídas de Dinheiro
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparativo do dinheiro que entrou de vendas e do que saiu em custos
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-foreground">Entrou (Vendas)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="text-foreground">Saiu (Custos)</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {vazio ? (
          <p className="flex h-[300px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Sem lançamentos com competência no recorte. Cadastre entradas e saídas no financeiro.
          </p>
        ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `R$ ${value >= 1000 ? Math.round(value / 1000) + 'k' : value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                fontSize: '12px',
                padding: '8px 12px',
              }}
              formatter={(value: number, name: string) => [
                `R$ ${value.toLocaleString('pt-BR')}`,
                name === 'revenue' ? 'Entrou (Vendas)' : 'Saiu (Custos)',
              ]}
              labelFormatter={(label) => `Mês de ${label}`}
            />
            <Area
              type="monotone"
              name="revenue"
              dataKey="revenue"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
            <Area
              type="monotone"
              name="expenses"
              dataKey="expenses"
              stroke="#f43f5e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorExpenses)"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
