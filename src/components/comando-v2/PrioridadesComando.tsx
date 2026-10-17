/**
 * O que é: a lista "O que decidir agora" da Visão geral: primeiro o que espera o fundador, depois prazo vencido, depois
 * encerrados com falha. Mostra até 8, com motivo em português simples, há quanto tempo e o botão "Abrir card".
 * Como mudar: a ordem e os motivos vêm de `prioridades()` em derivar-visao-geral.ts. O botão chama `abrirCard(id)`.
 */
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import {
  cardsDaEmpresa, dataCurtaSP, ID_PRIORIDADES, instantePrazo, prioridades, type GrupoPrioridade,
} from '@/integrations/comando-v2/derivar-visao-geral';
import type { PropsAba } from '@/integrations/comando-v2/tipos';
import { PorLeitura } from './KpisComando';
import { amostraDe } from '@/integrations/comando-v2/derivar-cards';

export const LIMITE_PRIORIDADES = 8;
const ROTULO_GRUPO: Record<GrupoPrioridade, { texto: string; variante: 'warning' | 'danger' }> = {
  decidir: { texto: 'Espera você', variante: 'warning' },
  atrasado: { texto: 'Atrasado', variante: 'danger' },
  falha: { texto: 'Encerrado com falha', variante: 'danger' },
};

export default function PrioridadesComando({ dados, empresa, abrirCard }: PropsAba) {
  const nomes = new Map(dados.catalogo.empresas.map(e => [e.id, e.nome]));
  const nomeEmpresa = (id: string | null) => (id ? nomes.get(id) ?? id : 'Sem empresa');
  return <section id={ID_PRIORIDADES} tabIndex={-1} aria-labelledby="prioridades-titulo"
    className="scroll-mt-4 rounded-xl border border-border bg-card p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5">
    <h2 id="prioridades-titulo" className="text-base font-semibold tracking-tight text-foreground">O que decidir agora</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">Primeiro o que espera você, depois prazos vencidos e cards que terminaram com falha.</p>
    <div className="mt-4">
      <PorLeitura estados={[dados.estado.cards]} oQue="o que decidir" linhas={3}>
        <Lista dados={dados} empresa={empresa} abrirCard={abrirCard} nomeEmpresa={nomeEmpresa} />
      </PorLeitura>
    </div>
  </section>;
}

function Lista({ dados, empresa, abrirCard, nomeEmpresa }: PropsAba & { nomeEmpresa: (id: string | null) => string }) {
  const todas = prioridades(cardsDaEmpresa(dados.cards, empresa), dados.agora);
  if (todas.length === 0) {
    return <ExecutiveEmptyState title="Nada para decidir agora"
      description={amostraDe(dados, ['cards']) ? 'Nada esperando você nesta amostra de cards. Pode haver mais registros fora dela.'
        : 'Nenhum card espera você, está com prazo vencido ou terminou com falha.'} />;
  }
  const mostradas = todas.slice(0, LIMITE_PRIORIDADES);
  return <>
    <ol className="space-y-2" aria-label="Cards que pedem atenção">
      {mostradas.map(p => {
        const grupo = ROTULO_GRUPO[p.grupo];
        const prazo = instantePrazo(p.card) !== null ? dataCurtaSP(p.card.prazo_ate ?? p.card.prazo) : '';
        return <li key={p.card.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background/50 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <ExecutiveBadge variant={grupo.variante} dot>{grupo.texto}</ExecutiveBadge>
              {p.atrasado && p.grupo !== 'atrasado' && <ExecutiveBadge variant="danger">Atrasado</ExecutiveBadge>}
              <span className="text-[11px] text-muted-foreground">{nomeEmpresa(p.card.empresa)}</span>
            </div>
            <strong className="mt-1 block break-words text-sm leading-snug text-foreground">{p.card.titulo}</strong>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.motivo}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {p.grupo === 'falha' ? 'Atualizado' : 'Parado'} {p.haQuanto}{prazo ? ` · prazo ${prazo}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => abrirCard(p.card.id)} aria-label={`Abrir card ${p.card.titulo}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Abrir card <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </li>;
      })}
    </ol>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        {todas.length > LIMITE_PRIORIDADES ? `Mostrando ${LIMITE_PRIORIDADES} de ${todas.length}.` : `${todas.length} no total.`}
        {amostraDe(dados, ['cards']) ? ' Amostra, não o total.' : ''}
      </p>
      <Link to="/comando?aba=cards" aria-label="Ver todos os cards"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Ver todos <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  </>;
}
