# 🎨 Guia de Design Premium

## Visão Geral

Este documento descreve os componentes e estilos premium implementados para melhorar a experiência visual do projeto.

## 📊 Componentes de Gráficos

### 1. RevenueChart
Gráfico de área para visualizar receita vs despesas ao longo do tempo.

```tsx
import { RevenueChart } from '@/components/dashboard/RevenueChart';

<RevenueChart 
  data={[
    { month: 'Jan', revenue: 45000, expenses: 32000 },
    { month: 'Fev', revenue: 52000, expenses: 35000 },
    // ...
  ]} 
/>
```

**Características:**
- Gradientes suaves
- Tooltips customizados
- Animações fluidas
- Responsivo

### 2. SalesDonutChart
Gráfico de rosca para distribuição de vendas por categoria.

```tsx
import { SalesDonutChart } from '@/components/dashboard/SalesDonutChart';

<SalesDonutChart 
  data={[
    { name: 'Produtos', value: 45000, color: 'hsl(221, 83%, 53%)' },
    { name: 'Serviços', value: 32000, color: 'hsl(142, 76%, 36%)' },
    // ...
  ]} 
/>
```

**Características:**
- Legenda lateral com percentuais
- Cores customizáveis
- Tooltips informativos

### 3. ConversionFunnel
Funil de conversão visual com taxas de conversão entre etapas.

```tsx
import { ConversionFunnel } from '@/components/dashboard/ConversionFunnel';

<ConversionFunnel 
  stages={[
    { name: 'Visitantes', value: 5000, color: 'hsl(221, 83%, 53%)' },
    { name: 'Leads', value: 1200, color: 'hsl(262, 83%, 58%)' },
    // ...
  ]} 
/>
```

**Características:**
- Cálculo automático de taxas de conversão
- Barras com gradientes
- Animações de transição

## 📈 Componentes de Estatísticas

### StatsGrid
Grid de estatísticas com ícones e indicadores de mudança.

```tsx
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { DollarSign, Users } from 'lucide-react';

<StatsGrid 
  stats={[
    {
      label: 'Receita Total',
      value: 'R$ 125.430',
      change: 12.5,
      icon: DollarSign,
      color: 'success',
    },
    // ...
  ]} 
/>
```

**Características:**
- 4 variantes de cor: primary, success, warning, destructive
- Efeito hover com glow
- Indicadores de mudança percentual
- Ícones animados

## 🎯 Componentes Kanban Premium

### PremiumKanbanColumn
Coluna do kanban com header informativo e barra de progresso.

```tsx
import { PremiumKanbanColumn } from '@/components/pipeline/PremiumKanbanColumn';
import { Eye } from 'lucide-react';

<PremiumKanbanColumn
  title="Prospecção"
  count={12}
  totalValue={45000}
  color="#3b82f6"
  icon={Eye}
>
  {/* Cards aqui */}
</PremiumKanbanColumn>
```

### PremiumKanbanCard
Card de oportunidade com informações detalhadas.

```tsx
import { PremiumKanbanCard } from '@/components/pipeline/PremiumKanbanCard';

<PremiumKanbanCard
  title="Venda Empresa X"
  value={25000}
  probability={75}
  customerName="João Silva"
  expectedCloseDate="2026-02-15"
  onClick={() => handleEdit(opportunity)}
/>
```

**Características:**
- Badge de probabilidade com cores dinâmicas
- Avatar do cliente
- Hover effects suaves
- Animação de elevação

## 🎨 Classes CSS Utilitárias

### Cards Premium

```tsx
// Card básico premium
<div className="premium-card">
  {/* Conteúdo */}
</div>

// Card com efeito glass
<div className="glass-card">
  {/* Conteúdo */}
</div>

// Card com gradiente
<div className="gradient-card">
  {/* Conteúdo */}
</div>
```

### Efeitos Especiais

```tsx
// Efeito shimmer (loading)
<div className="shimmer">
  {/* Conteúdo */}
</div>

// Pulse glow
<div className="pulse-glow">
  {/* Conteúdo */}
</div>

// Scrollbar fina
<div className="scrollbar-thin overflow-y-auto">
  {/* Conteúdo */}
</div>
```

### Animações

```tsx
// Fade in
<div className="animate-fade-in">

// Slide up
<div className="animate-slide-up">

// Scale in
<div className="animate-scale-in">

// Bounce sutil
<div className="animate-bounce-subtle">
```

## 🎯 Páginas de Exemplo

### DashboardPremium
Dashboard completo com todos os componentes premium integrados.

**Localização:** `src/pages/DashboardPremium.tsx`

**Inclui:**
- StatsGrid com 4 métricas
- RevenueChart
- SalesDonutChart
- ConversionFunnel
- Quick Actions Card

### PipelinePremium
Pipeline kanban com design premium e estatísticas.

**Localização:** `src/pages/PipelinePremium.tsx`

**Inclui:**
- StatsGrid com métricas do pipeline
- Kanban board com 6 colunas
- Cards premium para oportunidades
- Gradientes nas bordas para scroll

## 🎨 Paleta de Cores

### Cores Principais
- **Primary:** `hsl(221, 83%, 53%)` - Azul vibrante
- **Success:** `hsl(142, 76%, 36%)` - Verde
- **Warning:** `hsl(38, 92%, 50%)` - Amarelo/Laranja
- **Destructive:** `hsl(0, 84%, 60%)` - Vermelho

### Cores Secundárias
- **Purple:** `hsl(262, 83%, 58%)` - Roxo
- **Orange:** `hsl(25, 95%, 53%)` - Laranja

## 📱 Responsividade

Todos os componentes são totalmente responsivos:

- **Mobile:** Grid de 1 coluna
- **Tablet:** Grid de 2 colunas
- **Desktop:** Grid de 3-4 colunas
- **Kanban:** Scroll horizontal em telas menores

## 🚀 Como Usar

### 1. Substituir Dashboard Atual

```tsx
// Em src/App.tsx ou seu router
import DashboardPremium from '@/pages/DashboardPremium';

// Substitua a rota
<Route path="/dashboard" element={<DashboardPremium />} />
```

### 2. Substituir Pipeline Atual

```tsx
import PipelinePremium from '@/pages/PipelinePremium';

<Route path="/pipeline" element={<PipelinePremium />} />
```

### 3. Usar Componentes Individualmente

```tsx
// Importe apenas o que precisa
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RevenueChart } from '@/components/dashboard/RevenueChart';

// Use em qualquer página
<StatsGrid stats={myStats} />
<RevenueChart data={myData} />
```

## 🎯 Próximos Passos

1. **Integrar com dados reais** - Substituir dados mockados por queries do Supabase
2. **Adicionar drag & drop** - Implementar biblioteca como `@dnd-kit/core` para arrastar cards
3. **Adicionar filtros** - Filtros por data, valor, probabilidade
4. **Exportar relatórios** - Gerar PDFs dos gráficos
5. **Temas customizados** - Permitir usuário escolher cores

## 💡 Dicas de Performance

- Use `React.memo()` para componentes de gráficos
- Implemente virtualização para listas longas
- Use `useMemo()` para cálculos pesados
- Lazy load de gráficos complexos

## 🐛 Troubleshooting

### Gráficos não aparecem
- Verifique se `recharts` está instalado
- Confirme que os dados estão no formato correto

### Animações travando
- Reduza o número de elementos animados simultaneamente
- Use `will-change` CSS com moderação

### Cores não aplicando
- Verifique se as variáveis CSS estão definidas em `index.css`
- Confirme que o tema (light/dark) está configurado
