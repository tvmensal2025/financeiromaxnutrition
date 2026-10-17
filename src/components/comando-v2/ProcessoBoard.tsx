/**
 * O que é: quadro do Processo. Uma coluna por estado de ETAPA (aguardando, na fila, executando, validação, revisão,
 * esperando você, em resolução, aprovada, pronta) com a contagem e a lista das etapas, cada uma com o card, autor, revisor e prazo.
 * Como mudar: as colunas vêm de ESTADOS_ETAPA_PROCESSO (derivar-cards.ts). Não reaproveita o KanbanV2 porque ele agrupa
 * por estado do CARD; aqui o agrupamento é por estado da ETAPA.
 * Layout: colunas empilhadas no celular (sem rolagem horizontal), 2 colunas no tablet e 4 no computador.
 */
import { useState } from 'react';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import type { CardComando, CatalogoComando, EtapaComando } from '@/integrations/comando-v2/tipos';
import {
  agruparEtapasPorEstado, etapaAtrasada, ESTADOS_ETAPA_PROCESSO, nomeEmpresa, ordenarEtapas, prazoRelativo, revisoresDaEtapa,
  rotuloEstadoEtapa, varianteEstado,
} from '@/integrations/comando-v2/derivar-cards';

type Props = {
  etapas: EtapaComando[];
  cards: CardComando[];
  catalogo: CatalogoComando;
  agora: Date;
  onAbrirCard: (cardId: string) => void;
  /** Quantas etapas aparecem por coluna antes de "Ver mais". */
  porColuna?: number;
};

export function ProcessoBoard({ etapas, cards, catalogo, agora, onAbrirCard, porColuna = 5 }: Props) {
  const [expandidas, setExpandidas] = useState<string[]>([]);
  const cardPorId = new Map(cards.map(card => [card.id, card]));
  const grupos = agruparEtapasPorEstado(etapas);
  return (
    <section aria-label="Quadro do processo por estado da etapa" className="min-w-0">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ESTADOS_ETAPA_PROCESSO.map(estado => {
          const itens = ordenarEtapas(grupos[estado], agora);
          const aberta = expandidas.includes(estado);
          const mostradas = aberta ? itens : itens.slice(0, porColuna);
          const rotulo = rotuloEstadoEtapa(estado);
          return (
            <section
              key={estado}
              aria-label={`${rotulo}: ${itens.length} ${itens.length === 1 ? 'etapa' : 'etapas'}`}
              className="min-w-0 rounded-xl border border-border bg-muted/30 p-3"
            >
              <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-foreground">{rotulo}</h3>
                <ExecutiveBadge variant={varianteEstado(estado)} size="md">{itens.length}</ExecutiveBadge>
              </div>
              <ul className="mt-3 space-y-2">
                {itens.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">Nenhuma etapa aqui.</li>}
                {mostradas.map(etapa => {
                  const card = cardPorId.get(etapa.card_id);
                  const atrasada = etapaAtrasada(etapa, agora);
                  return (
                    <li key={etapa.id}>
                      <button
                        type="button"
                        onClick={() => onAbrirCard(etapa.card_id)}
                        aria-label={`Abrir o card da etapa ${etapa.codigo} ${etapa.nome}`}
                        className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <strong className="block break-words text-sm font-semibold leading-snug text-foreground">{etapa.codigo} · {etapa.nome}</strong>
                        <span className="mt-1 block break-words text-xs text-muted-foreground">
                          {card ? `${card.titulo} · ${nomeEmpresa(catalogo, card.empresa)}` : 'Card fora da amostra lida'}
                        </span>
                        <span className="mt-1 block break-words text-xs text-muted-foreground">
                          Autor: {etapa.autor || 'Não informado'} · Revisor: {revisoresDaEtapa(etapa)}
                        </span>
                        <span className={`mt-1 flex flex-wrap items-center gap-1.5 text-xs ${atrasada ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                          {prazoRelativo(etapa.prazo_ate, agora)}
                          {atrasada && <ExecutiveBadge variant="danger">Atrasada</ExecutiveBadge>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {itens.length > porColuna && (
                <button
                  type="button"
                  onClick={() => setExpandidas(antigas => (aberta ? antigas.filter(item => item !== estado) : [...antigas, estado]))}
                  aria-expanded={aberta}
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {aberta ? 'Mostrar menos' : `Ver mais ${itens.length - porColuna}`}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
