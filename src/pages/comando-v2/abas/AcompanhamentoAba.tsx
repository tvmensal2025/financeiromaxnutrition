/**
 * O que é: aba "Acompanhamento" da Sala de comando v2, com duas sub-abas.
 * "Execuções": etapas em execução ou revisão (autor, revisor, prazo; destaque para atrasadas e para as paradas há mais de 1 h).
 * "Decisões": o que espera você (cards, etapas) e os pedidos recebidos que ainda não viraram card.
 * Como mudar: regras de atraso/parada e filtros ficam em derivar-cards.ts. Lê só `PropsAba` (helena_v2).
 * Honestidade: cada bloco usa as suas próprias fontes; se uma falhou, aquele bloco mostra erro (nunca zero) e a contagem
 * da sub-aba vira "—". Pedidos sem empresa definida só aparecem em "Grupo". Pedido sem card não tem "Abrir card".
 */
import { useId, useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { AvisoAmostra } from '@/components/comando-v2/ListaCards';
import type { CardComando, EtapaComando, PropsAba } from '@/integrations/comando-v2/tipos';
import {
  cardPrecisaDeVoce, cardsDaEmpresa, combinarLeituras, EMPRESA_GRUPO, etapaAtrasada, etapaParada, etapasDaEmpresa, formatarDataHora,
  haQuanto, lerData, mensagemFalha, nomeEmpresa, ordenarCards, pedidosDaEmpresa, pedidosSemCard, prazoDoCard, prazoRelativo,
  revisoresDaEtapa, rotuloEstadoCard, rotuloEstadoEtapa, rotuloMotivo, varianteEstado,
} from '@/integrations/comando-v2/derivar-cards';
import { amostraDe } from '@/integrations/comando-v2/derivar-cards';

type SubAba = 'execucoes' | 'decisoes';

const botaoAbrir = 'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Bloco({ titulo, contagem, children }: { titulo: string; contagem: number | null; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="min-w-0 space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {titulo}
        <ExecutiveBadge variant="neutral" size="md">{contagem === null ? '—' : contagem}</ExecutiveBadge>
      </h3>
      {children}
    </section>
  );
}

function Linha({ titulo, detalhes, badges, cardId, abrirCard, semCard }: {
  titulo: string; detalhes: ReactNode[]; badges: ReactNode; cardId: string | null; abrirCard: (id: string) => void; semCard?: string;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <strong className="min-w-0 break-words text-sm font-semibold text-foreground">{titulo}</strong>
          {badges}
        </div>
        {detalhes.map((detalhe, indice) => <p key={indice} className="break-words text-xs text-muted-foreground">{detalhe}</p>)}
      </div>
      {cardId
        ? <button type="button" onClick={() => abrirCard(cardId)} aria-label={`Abrir card: ${titulo}`} className={botaoAbrir}><ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir card</button>
        : <span className="text-xs text-muted-foreground">{semCard}</span>}
    </li>
  );
}

function Estado({ leitura, falhas, carregando, children }: { leitura: 'erro' | 'carregando' | 'pronta'; falhas: string[]; carregando: string; children: ReactNode }) {
  if (leitura === 'erro') return <ExecutiveErrorState title="Não foi possível ler esta lista" message={mensagemFalha(falhas)} />;
  if (leitura === 'carregando') return <ExecutiveLoadingState message={carregando} rows={2} />;
  return <>{children}</>;
}

export default function AcompanhamentoAba({ dados, empresa, abrirCard }: PropsAba) {
  const [sub, setSub] = useState<SubAba>('execucoes');
  const base = useId();
  const { agora, catalogo } = dados;
  const tituloDoCard = (cardId: string, cards: CardComando[]) => cards.find(card => card.id === cardId);

  const leituraEtapas = combinarLeituras(dados.estado, ['cards', 'etapas']);
  const leituraCards = combinarLeituras(dados.estado, ['cards']);
  const leituraPedidos = combinarLeituras(dados.estado, ['pedidos']);

  const cards = cardsDaEmpresa(dados.cards, empresa);
  const etapas = etapasDaEmpresa(dados.etapas, dados.cards, empresa);

  const execucoes: EtapaComando[] = etapas
    .filter(etapa => etapa.estado === 'EXECUTANDO' || etapa.estado === 'REVISAO')
    .sort((a, b) =>
      Number(etapaAtrasada(b, agora)) - Number(etapaAtrasada(a, agora))
      || Number(etapaParada(b, agora)) - Number(etapaParada(a, agora))
      || (lerData(a.prazo_ate)?.getTime() ?? Infinity) - (lerData(b.prazo_ate)?.getTime() ?? Infinity));
  const cardsEsperando = ordenarCards(cards.filter(cardPrecisaDeVoce), 'prioridade', agora); // maior prioridade = mais urgente (igual ao motor)
  const etapasEsperando = etapas.filter(etapa => etapa.estado === 'ESPERANDO_FUNDADOR');
  const pedidos = pedidosSemCard(pedidosDaEmpresa(dados.pedidos, empresa));

  const contagemExecucoes = leituraEtapas.estado === 'pronta' ? execucoes.length : null;
  const contagemDecisoes = leituraCards.estado === 'pronta' && leituraEtapas.estado === 'pronta' && leituraPedidos.estado === 'pronta'
    ? cardsEsperando.length + etapasEsperando.length + pedidos.length : null;
  const abas: { id: SubAba; rotulo: string; contagem: number | null }[] = [
    { id: 'execucoes', rotulo: 'Execuções', contagem: contagemExecucoes },
    { id: 'decisoes', rotulo: 'Decisões', contagem: contagemDecisoes },
  ];

  const execucoesUi = (
    <Estado leitura={leituraEtapas.estado} falhas={leituraEtapas.falhas} carregando="Carregando execuções">
      {execucoes.length === 0 ? (
        <ExecutiveEmptyState title="Nada em execução agora" description="Nenhuma etapa está sendo executada ou revisada neste momento." />
      ) : (
        <ul className="space-y-2">
          {execucoes.map(etapa => {
            const card = tituloDoCard(etapa.card_id, dados.cards);
            const atrasada = etapaAtrasada(etapa, agora);
            const parada = etapaParada(etapa, agora);
            return (
              <Linha
                key={etapa.id}
                titulo={`${etapa.codigo} · ${etapa.nome}`}
                cardId={etapa.card_id}
                abrirCard={abrirCard}
                badges={<>
                  <ExecutiveBadge variant={varianteEstado(etapa.estado)} dot>{rotuloEstadoEtapa(etapa.estado)}</ExecutiveBadge>
                  {atrasada && <ExecutiveBadge variant="danger">Atrasada</ExecutiveBadge>}
                  {parada && <ExecutiveBadge variant="warning">Parada {haQuanto(etapa.atualizado_em, agora)}</ExecutiveBadge>}
                </>}
                detalhes={[
                  card ? `Card: ${card.titulo} · ${nomeEmpresa(catalogo, card.empresa)}` : 'Card fora da amostra lida',
                  `Autor: ${etapa.autor || 'Não informado'} · Revisor: ${revisoresDaEtapa(etapa)}`,
                  <span key="prazo" className={atrasada ? 'font-semibold text-destructive' : undefined}>Prazo: {prazoRelativo(etapa.prazo_ate, agora)}</span>,
                ]}
              />
            );
          })}
        </ul>
      )}
    </Estado>
  );

  const decisoesUi = (
    <div className="space-y-6">
      <Bloco titulo="Cards esperando você" contagem={leituraCards.estado === 'pronta' ? cardsEsperando.length : null}>
        <Estado leitura={leituraCards.estado} falhas={leituraCards.falhas} carregando="Carregando cards">
          {cardsEsperando.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum card esperando uma decisão sua.</p> : (
            <ul className="space-y-2">
              {cardsEsperando.map(card => (
                <Linha
                  key={card.id}
                  titulo={card.titulo}
                  cardId={card.id}
                  abrirCard={abrirCard}
                  badges={<ExecutiveBadge variant={varianteEstado(card.estado)} dot>{rotuloEstadoCard(card.estado)}</ExecutiveBadge>}
                  detalhes={[
                    `Motivo: ${rotuloMotivo(card.motivo) ?? 'Aguardando a sua decisão.'}`,
                    `${nomeEmpresa(catalogo, card.empresa)} · Dono: ${card.dono || 'Sem dono'} · ${prazoDoCard(card) ? prazoRelativo(prazoDoCard(card), agora) : 'Sem prazo'}`,
                  ]}
                />
              ))}
            </ul>
          )}
        </Estado>
      </Bloco>

      <Bloco titulo="Etapas esperando você" contagem={leituraEtapas.estado === 'pronta' ? etapasEsperando.length : null}>
        <Estado leitura={leituraEtapas.estado} falhas={leituraEtapas.falhas} carregando="Carregando etapas">
          {etapasEsperando.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma etapa esperando uma decisão sua.</p> : (
            <ul className="space-y-2">
              {etapasEsperando.map(etapa => {
                const card = tituloDoCard(etapa.card_id, dados.cards);
                return (
                  <Linha
                    key={etapa.id}
                    titulo={`${etapa.codigo} · ${etapa.nome}`}
                    cardId={etapa.card_id}
                    abrirCard={abrirCard}
                    badges={<ExecutiveBadge variant="warning" dot>{rotuloEstadoEtapa(etapa.estado)}</ExecutiveBadge>}
                    detalhes={[
                      `Motivo: ${rotuloMotivo(etapa.motivo) ?? 'Aguardando a sua decisão.'}`,
                      card ? `Card: ${card.titulo} · ${nomeEmpresa(catalogo, card.empresa)}` : 'Card fora da amostra lida',
                    ]}
                  />
                );
              })}
            </ul>
          )}
        </Estado>
      </Bloco>

      <Bloco titulo="Pedidos que ainda não viraram card" contagem={leituraPedidos.estado === 'pronta' ? pedidos.length : null}>
        <Estado leitura={leituraPedidos.estado} falhas={leituraPedidos.falhas} carregando="Carregando pedidos">
          {pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum pedido esperando virar card{empresa === EMPRESA_GRUPO ? '.' : '. Pedidos ainda sem empresa definida só aparecem em Grupo.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {pedidos.map(pedido => (
                <Linha
                  key={pedido.pedido_id}
                  titulo={pedido.titulo_confirmado || pedido.texto_inicial}
                  cardId={pedido.card_id ?? null}
                  abrirCard={abrirCard}
                  semCard="Ainda não virou card"
                  badges={<ExecutiveBadge variant="warning" dot>{pedido.estado === 'RECEBIDO' ? 'Recebido' : 'Plano confirmado'}</ExecutiveBadge>}
                  detalhes={[
                    pedido.estado === 'RECEBIDO'
                      ? 'Recebido para triagem; a Helena ainda vai devolver a leitura.'
                      : 'Você já confirmou o plano; o card ainda não foi criado.',
                    `Chegou em ${formatarDataHora(pedido.criado_em)} · ${pedido.origem_inicial === 'TELEGRAM' ? 'Telegram' : pedido.origem_inicial === 'SITE' ? 'Site' : 'Codex'}`,
                  ]}
                />
              ))}
            </ul>
          )}
        </Estado>
      </Bloco>
    </div>
  );

  return (
    <div className="min-w-0 space-y-4">
      {amostraDe(dados, ['cards', 'etapas', 'pedidos']) && <AvisoAmostra />}
      <div role="tablist" aria-label="Acompanhamento" className="flex gap-2">
        {abas.map(aba => {
          const ativo = sub === aba.id;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`${base}-${aba.id}`}
              aria-selected={ativo}
              aria-controls={`${base}-painel-${aba.id}`}
              onClick={() => setSub(aba.id)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none ${ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'}`}
            >
              {aba.rotulo}
              <span className={`rounded-full px-1.5 text-xs ${ativo ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'}`}>{aba.contagem === null ? '—' : aba.contagem}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-painel-${sub}`} aria-labelledby={`${base}-${sub}`} className="min-w-0">
        {sub === 'execucoes' ? execucoesUi : decisoesUi}
      </div>
    </div>
  );
}
