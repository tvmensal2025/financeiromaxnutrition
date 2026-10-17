/**
 * O que é: a aba "Visão geral" da Sala de comando v2: boas-vindas, 4 números, o que decidir agora, processo em miniatura,
 * gráficos, linha do tempo, entregas por empresa e o atalho do Financeiro. Lê só `PropsAba` (dados helena_v2).
 * Como mudar: cada bloco é um componente em src/components/comando-v2; os cálculos ficam em
 * src/integrations/comando-v2/derivar-visao-geral.ts. Não há leitura de dados aqui.
 */
import { ArrowRight, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PropsAba } from '@/integrations/comando-v2/tipos';
import BoasVindas from '@/components/comando-v2/BoasVindas';
import KpisComando, { AvisoAmostra } from '@/components/comando-v2/KpisComando';
import PrioridadesComando from '@/components/comando-v2/PrioridadesComando';
import ProcessoCompacto from '@/components/comando-v2/ProcessoCompacto';
import GraficosComando from '@/components/comando-v2/GraficosComando';
import LinhaDoTempo from '@/components/comando-v2/LinhaDoTempo';
import EntregasPorEmpresa from '@/components/comando-v2/EntregasPorEmpresa';

export default function VisaoGeralAba({ dados, empresa, abrirCard }: PropsAba) {
  return <div className="min-w-0 space-y-4" data-testid="visao-geral-aba">
    <AvisoAmostra amostra={dados.amostra} />
    <BoasVindas dados={dados} empresa={empresa} />
    <KpisComando dados={dados} empresa={empresa} />
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <PrioridadesComando dados={dados} empresa={empresa} abrirCard={abrirCard} />
      <div className="space-y-4">
        <ProcessoCompacto dados={dados} empresa={empresa} />
        <Link to="/financeiro" aria-label="Abrir o Financeiro. Vem do módulo de negócio, separado dos cards da Helena"
          className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground"><Wallet className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-foreground">Financeiro</strong>
            <span className="block text-xs text-muted-foreground">Vem do módulo de negócio, separado dos cards da Helena.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </div>
    </div>
    <GraficosComando dados={dados} empresa={empresa} />
    <LinhaDoTempo dados={dados} empresa={empresa} />
    <EntregasPorEmpresa dados={dados} empresa={empresa} />
  </div>;
}
