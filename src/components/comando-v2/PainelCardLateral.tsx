/**
 * O que é: painel lateral com o resumo de um card (estado, motivo, empresa, dono, prazo, etapas e entregas aprovadas),
 * navegação anterior/próximo dentro da lista filtrada e o botão "Abrir card completo".
 * Como mudar: ele só apresenta os dados que recebe; quem decide o card aberto e a lista é a CardsAba.
 * Honestidade: etapas e entregas com leitura em erro mostram erro (nunca "0 etapas"); em carregamento, esqueleto.
 */
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import { ExecutiveDrawer } from '@/components/executive/ExecutiveDrawer';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import type { CardComando, CatalogoComando, EntregaResumo, EstadoLeitura, EtapaComando } from '@/integrations/comando-v2/tipos';
import {
  etapaAtrasada, formatarDataHora, nomeEmpresa, prazoDoCard, prazoRelativo, revisoresDaEtapa, rotuloEstadoCard,
  rotuloEstadoEtapa, rotuloMotivo, varianteEstado,
} from '@/integrations/comando-v2/derivar-cards';

type Props = {
  card: CardComando | null;
  etapas: EtapaComando[];
  entregas: EntregaResumo[];
  estadoEtapas: EstadoLeitura;
  estadoEntregas: EstadoLeitura;
  catalogo: CatalogoComando;
  agora: Date;
  /** Posição do card na lista filtrada (1 = primeiro). `null` quando o card saiu da lista por causa do filtro. */
  posicao: { indice: number; total: number } | null;
  onAnterior?: () => void;
  onProximo?: () => void;
  onFechar: () => void;
  abrirCard: (id: string) => void;
};

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

const botaoNav = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

export function PainelCardLateral({
  card, etapas, entregas, estadoEtapas, estadoEntregas, catalogo, agora, posicao, onAnterior, onProximo, onFechar, abrirCard,
}: Props) {
  const aprovadas = entregas.filter(entrega => entrega.portao1 === 'PASSOU').length;
  const motivo = card ? rotuloMotivo(card.motivo) : null;
  return (
    <ExecutiveDrawer
      open={!!card}
      onOpenChange={aberto => { if (!aberto) onFechar(); }}
      title={card?.titulo ?? 'Card'}
      description={posicao ? `Card ${posicao.indice} de ${posicao.total} na lista atual.` : 'Resumo do card.'}
      badge={card ? <ExecutiveBadge variant={varianteEstado(card.estado)} dot>{rotuloEstadoCard(card.estado)}</ExecutiveBadge> : undefined}
      width="wide"
      footer={card ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" className={botaoNav} onClick={onAnterior} disabled={!onAnterior} aria-label="Card anterior">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Anterior
            </button>
            <button type="button" className={botaoNav} onClick={onProximo} disabled={!onProximo} aria-label="Próximo card">
              Próximo <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => abrirCard(card.id)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir card completo
          </button>
        </div>
      ) : undefined}
    >
      {card && (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo rotulo="Estado">{rotuloEstadoCard(card.estado)}</Campo>
            <Campo rotulo="Motivo">{motivo ?? 'Nenhum motivo de espera.'}</Campo>
            <Campo rotulo="Empresa">{nomeEmpresa(catalogo, card.empresa)}</Campo>
            <Campo rotulo="Dono">{card.dono || 'Sem dono'}</Campo>
            <Campo rotulo="Prazo">
              {prazoDoCard(card) ? <>{formatarDataHora(prazoDoCard(card))} <span className="text-muted-foreground">({prazoRelativo(prazoDoCard(card), agora)})</span></> : 'Sem prazo'}
            </Campo>
            <Campo rotulo="Criado em">{formatarDataHora(card.criado_em)}</Campo>
          </dl>

          <section aria-label="Entregas aprovadas" className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Entregas aprovadas</h3>
            {estadoEntregas === 'erro' && <ExecutiveErrorState title="Não foi possível ler as entregas" message="A contagem não é mostrada para não parecer zero." />}
            {estadoEntregas === 'carregando' && <ExecutiveLoadingState message="Carregando entregas" rows={1} />}
            {estadoEntregas === 'pronta' && (
              <p className="text-sm text-muted-foreground">
                {entregas.length === 0
                  ? 'Nenhuma entrega registrada ainda.'
                  : <><strong className="text-foreground">{aprovadas}</strong> {aprovadas === 1 ? 'entrega aprovada' : 'entregas aprovadas'} no primeiro portão, de {entregas.length} {entregas.length === 1 ? 'registrada' : 'registradas'}.</>}
              </p>
            )}
          </section>

          <section aria-label="Etapas do card" className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Etapas</h3>
            {estadoEtapas === 'erro' && <ExecutiveErrorState title="Não foi possível ler as etapas" message="A lista não é mostrada para não parecer vazia." />}
            {estadoEtapas === 'carregando' && <ExecutiveLoadingState message="Carregando etapas" rows={2} />}
            {estadoEtapas === 'pronta' && etapas.length === 0 && (
              <p className="text-sm text-muted-foreground">Este card ainda não tem etapas. Elas aparecem depois que o plano é validado.</p>
            )}
            {estadoEtapas === 'pronta' && etapas.length > 0 && (
              <ol className="space-y-2">
                {etapas.map(etapa => (
                  <li key={etapa.id} className="min-w-0 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <strong className="min-w-0 break-words text-sm font-semibold">{etapa.codigo} · {etapa.nome}</strong>
                      <ExecutiveBadge variant={varianteEstado(etapa.estado)}>{rotuloEstadoEtapa(etapa.estado)}</ExecutiveBadge>
                    </div>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      Autor: {etapa.autor || 'Não informado'} · Revisor: {revisoresDaEtapa(etapa)}
                    </p>
                    <p className={`mt-0.5 text-xs ${etapaAtrasada(etapa, agora) ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                      Prazo: {etapa.prazo_ate ? `${formatarDataHora(etapa.prazo_ate)} (${prazoRelativo(etapa.prazo_ate, agora)})` : 'Sem prazo'}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </ExecutiveDrawer>
  );
}
