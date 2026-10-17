/**
 * O que é: os 4 números da Visão geral (cards abertos, esperando você, atrasados e prontos nos últimos 7 dias) e dois
 * ajudantes de leitura (PorLeitura e AvisoAmostra) que os outros blocos da aba também usam.
 * Como mudar: os números vêm de `kpis()` em derivar-visao-geral.ts. Leitura com erro nunca vira zero: mostra o aviso de erro.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Hourglass, Layers } from 'lucide-react';
import { ExecutiveMetricCard } from '@/components/executive/ExecutiveMetricCard';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import type { EstadoLeitura, PropsAba } from '@/integrations/comando-v2/tipos';
import { cardsDaEmpresa, kpis } from '@/integrations/comando-v2/derivar-visao-geral';
import { amostraDe } from '@/integrations/comando-v2/derivar-cards';

export type PropsVisao = Pick<PropsAba, 'dados' | 'empresa'>;

/** Troca o conteúdo por erro ou carregando quando alguma das leituras necessárias não está pronta. */
export function PorLeitura({ estados, oQue, tipo = 'table', linhas = 3, children }: {
  estados: EstadoLeitura[]; oQue: string; tipo?: 'table' | 'cards'; linhas?: number; children: ReactNode;
}) {
  if (estados.includes('erro')) {
    return <ExecutiveErrorState title={`Não foi possível ler ${oQue}`}
      message="A leitura falhou, por isso não mostramos número nenhum aqui (zero seria mentira). Atualize a página para tentar de novo." />;
  }
  if (estados.includes('carregando')) return <ExecutiveLoadingState message={`Carregando ${oQue}`} type={tipo} rows={linhas} />;
  return <>{children}</>;
}

export function AvisoAmostra({ amostra }: { amostra: boolean }) {
  if (!amostra) return null;
  return <p role="status" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
    <span>Estes números vêm de uma amostra, não o total: a leitura foi cortada por limite e pode haver mais registros.</span>
  </p>;
}

export default function KpisComando({ dados, empresa }: PropsVisao) {
  return <section aria-label="Números principais" data-testid="kpis-comando">
    <PorLeitura estados={[dados.estado.cards]} oQue="os cards" tipo="cards" linhas={4}>
      <Quatro dados={dados} empresa={empresa} />
    </PorLeitura>
  </section>;
}

function Quatro({ dados, empresa }: PropsVisao) {
  const cards = cardsDaEmpresa(dados.cards, empresa);
  const k = kpis(cards, dados.agora);
  const nota = amostraDe(dados, ['cards']) ? ' (amostra, não o total)' : '';
  return <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">
    <ExecutiveMetricCard label="Cards abertos" value={k.abertos} icon={Layers}
      subtext={`Ainda não terminaram${nota}`} />
    <ExecutiveMetricCard label="Esperando você" value={k.esperando} icon={Hourglass}
      subtext={k.esperando === 0 ? `Nenhuma decisão pendente${nota}` : `Precisam da sua decisão${nota}`} />
    <ExecutiveMetricCard label="Atrasados" value={k.atrasados} icon={Clock}
      subtext={k.atrasados === 0 ? `Nenhum prazo vencido${nota}` : `Prazo já passou${nota}`} />
    <ExecutiveMetricCard label="Prontos em 7 dias" value={k.prontos7d} icon={CheckCircle2}
      subtext={`Terminaram na última semana${nota}`} />
  </div>;
}
