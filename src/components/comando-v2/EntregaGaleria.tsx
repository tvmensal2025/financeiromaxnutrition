/**
 * O que é: galeria das entregas aprovadas (mesma regra do card: etapa aprovada, portão 1 passou, entrega fresca, versão atual) da Sala de comando v2. Lista, busca e agrupa; ao abrir uma
 * entrega, carrega o texto SOB DEMANDA do card dela, mostra em linhas legíveis e oferece "Copiar texto" e "Abrir card".
 * Como mudar: `carregarDetalhe` (opcional) troca a fonte do texto, útil em testes; sem ela usa o repositório de cards da v2
 * (import dinâmico de '@/integrations/cards-v2/runtime'). Só leitura: nada aqui altera o banco.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, FileText, Loader2, RefreshCw, Search } from 'lucide-react';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { dataHoraSP, entregasAprovadas, nomeAgente, nomeEmpresa } from '@/integrations/comando-v2/derivar-execucao';
import { copiarTexto, linhasDaEntrega, textoParaCopiar, type LinhaEntrega } from '@/integrations/comando-v2/linhas-da-entrega';
import type { CardComando, CatalogoComando, DadosComando, EntregaResumo, EtapaComando } from '@/integrations/comando-v2/tipos';
import type { DetalheCardV2 } from '@/integrations/cards-v2/repository';

type Agrupar = 'empresa' | 'agente' | 'etapa' | 'nenhum';
type Detalhe = { fase: 'carregando' } | { fase: 'pronto'; linhas: LinhaEntrega[] } | { fase: 'erro'; mensagem: string };
type Aviso = { id: string; ok: boolean };
export type CarregarDetalhe = (cardId: string) => Promise<DetalheCardV2>;
type Props = {
  dados: DadosComando;
  empresa: string;
  abrirCard: (id: string) => void;
  carregarDetalhe?: CarregarDetalhe;
};

const PASSO = 30;
const LIMITE_LINHAS = 120;

async function carregarDetalheDoApp(cardId: string): Promise<DetalheCardV2> {
  const { repositorioCardsV2DoApp } = await import('@/integrations/cards-v2/runtime');
  const repo = await repositorioCardsV2DoApp();
  return repo.detalhar(cardId);
}

function descreverEntrega(e: EntregaResumo, cardsPorId: Map<string, CardComando>, etapasPorId: Map<string, EtapaComando>, catalogo: CatalogoComando) {
  const card = cardsPorId.get(e.card_id);
  const etapa = etapasPorId.get(e.etapa_id);
  return {
    titulo: card?.titulo ?? 'Card fora da amostra lida',
    empresa: card ? nomeEmpresa(catalogo, card.empresa) : 'Empresa não confirmada',
    autor: nomeAgente(catalogo, e.autor) ?? 'Autor não informado',
    etapa: e.etapa_codigo ? (etapa?.nome ? `${e.etapa_codigo} · ${etapa.nome}` : e.etapa_codigo) : 'Etapa não informada',
  };
}

const normalizar = (valor: string) => valor.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function EntregaGaleria({ dados, empresa, abrirCard, carregarDetalhe }: Props) {
  const idBusca = useId();
  const [busca, setBusca] = useState('');
  const [agrupar, setAgrupar] = useState<Agrupar>('empresa');
  const [mostrar, setMostrar] = useState(PASSO);
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  const [detalhes, setDetalhes] = useState<Record<string, Detalhe>>({});
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // Um card pode ter várias entregas: o detalhe é pedido uma vez por card e guardado; falha não fica guardada.
  const cache = useRef(new Map<string, Promise<DetalheCardV2>>());
  const { catalogo, estado } = dados;

  const cardsPorId = useMemo(() => new Map(dados.cards.map(c => [c.id, c])), [dados.cards]);
  const etapasPorId = useMemo(() => new Map(dados.etapas.map(e => [e.id, e])), [dados.etapas]);
  const { itens, ocultas } = useMemo(() => entregasAprovadas(dados, empresa), [dados, empresa]);

  const descrever = (e: EntregaResumo) => descreverEntrega(e, cardsPorId, etapasPorId, catalogo);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return itens;
    return itens.filter(e => {
      const d = descreverEntrega(e, cardsPorId, etapasPorId, catalogo);
      return normalizar([d.titulo, d.empresa, d.autor, d.etapa, e.parecer ?? ''].join(' ')).includes(termo);
    });
  }, [itens, busca, cardsPorId, etapasPorId, catalogo]);

  const visiveis = useMemo(() => filtradas.slice(0, mostrar), [filtradas, mostrar]);
  const grupos = useMemo(() => {
    const mapa = new Map<string, EntregaResumo[]>();
    for (const e of visiveis) {
      const d = descreverEntrega(e, cardsPorId, etapasPorId, catalogo);
      const chave = agrupar === 'empresa' ? d.empresa : agrupar === 'agente' ? d.autor : agrupar === 'etapa' ? d.etapa : '';
      mapa.set(chave, [...(mapa.get(chave) ?? []), e]);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [visiveis, agrupar, cardsPorId, etapasPorId, catalogo]);

  async function carregar(e: EntregaResumo) {
    setDetalhes(d => ({ ...d, [e.id]: { fase: 'carregando' } }));
    let promessa = cache.current.get(e.card_id);
    if (!promessa) {
      try { promessa = (carregarDetalhe ?? carregarDetalheDoApp)(e.card_id); } catch (erro) { promessa = Promise.reject(erro); }
      cache.current.set(e.card_id, promessa);
    }
    try {
      const detalhe = await promessa;
      const entregas = Array.isArray(detalhe?.entregas) ? detalhe.entregas : [];
      // Casa primeiro pelo id da entrega; só na falta dele usa etapa + versão.
      const achada = entregas.find(x => String(x.id) === e.id) ?? entregas.find(x => x.etapa_id === e.etapa_id && x.versao === e.versao);
      if (!achada) {
        // Não é falha de rede: o card não devolveu esta entrega (já não vale como aprovada). Guardar o detalhe não ajuda.
        cache.current.delete(e.card_id);
        setDetalhes(d => ({ ...d, [e.id]: { fase: 'erro', mensagem: 'Esta entrega não consta mais como aprovada no card (pode ter sido substituída por uma versão mais nova). Atualize a página para ver a lista corrente.' } }));
        return;
      }
      setDetalhes(d => ({ ...d, [e.id]: { fase: 'pronto', linhas: linhasDaEntrega(achada.conteudo) } }));
    } catch (erro) {
      cache.current.delete(e.card_id);
      const causa = erro instanceof Error && erro.message.trim() ? ` Motivo: ${erro.message.trim()}` : '';
      setDetalhes(d => ({ ...d, [e.id]: { fase: 'erro', mensagem: `Não foi possível carregar o texto desta entrega.${causa}` } }));
    }
  }

  function alternar(e: EntregaResumo) {
    const abrir = !abertas[e.id];
    setAbertas(a => ({ ...a, [e.id]: abrir }));
    if (abrir && detalhes[e.id]?.fase !== 'pronto' && detalhes[e.id]?.fase !== 'carregando') void carregar(e);
  }

  async function copiar(e: EntregaResumo, linhas: LinhaEntrega[]) {
    const ok = await copiarTexto(textoParaCopiar(linhas));
    setAviso({ id: e.id, ok });
  }

  if (estado.entregas === 'carregando' || estado.etapas === 'carregando') return <ExecutiveLoadingState message="Carregando entregas aprovadas" rows={4} />;
  if (estado.entregas === 'erro') {
    return <ExecutiveErrorState title="Não foi possível ler as entregas"
      message="A leitura das entregas falhou, então nenhum número é mostrado. Isto não significa que não há entregas." />;
  }
  if (estado.etapas === 'erro') {
    return <ExecutiveErrorState title="Não foi possível confirmar as entregas aprovadas"
      message="Uma entrega só vale como aprovada quando a etapa dela está aprovada, e a leitura das etapas falhou. Nenhum número é mostrado; isto não significa que não há entregas." />;
  }
  if (empresa !== 'GRUPO' && estado.cards === 'erro') {
    return <ExecutiveErrorState title="Não foi possível separar as entregas por empresa"
      message="As entregas só trazem a empresa pelo card, e a leitura dos cards falhou. Escolha 'Grupo' ou tente de novo mais tarde." />;
  }

  const semCards = estado.cards === 'erro';
  const total = filtradas.length;

  return (
    <div className="space-y-4" data-galeria="entregas">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor={idBusca} className="text-xs font-medium text-muted-foreground">Buscar entrega</label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input id={idBusca} type="search" value={busca} onChange={ev => { setBusca(ev.target.value); setMostrar(PASSO); }}
              placeholder="Título do card, empresa, agente ou etapa"
              className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
        <div role="group" aria-label="Agrupar entregas por" className="flex flex-wrap gap-1.5">
          {([['empresa', 'Empresa'], ['agente', 'Agente'], ['etapa', 'Etapa'], ['nenhum', 'Sem grupos']] as [Agrupar, string][]).map(([valor, rotulo]) => (
            <button key={valor} type="button" aria-pressed={agrupar === valor} onClick={() => setAgrupar(valor)}
              className={`min-h-11 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${agrupar === valor ? 'border-primary bg-primary/10 text-foreground' : 'border-input bg-background text-muted-foreground hover:bg-accent'}`}>
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {dados.amostra && (
        <p role="note" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          Amostra: a leitura foi cortada por limite, então entregas mais antigas podem não aparecer.
        </p>
      )}
      {semCards && (
        <p role="note" className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Não foi possível ler os cards: os títulos e as empresas das entregas não estão disponíveis.
        </p>
      )}
      {ocultas > 0 && (
        <p role="note" className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {ocultas} {ocultas === 1 ? 'entrega aprovada não pôde' : 'entregas aprovadas não puderam'} ser ligada{ocultas === 1 ? '' : 's'} a uma empresa porque o card não está na leitura; {ocultas === 1 ? 'ela fica' : 'elas ficam'} fora deste filtro.
        </p>
      )}

      <p className="text-sm text-muted-foreground" role="status">
        {total === 0 ? 'Nenhuma entrega' : `${total} ${total === 1 ? 'entrega aprovada' : 'entregas aprovadas'}`}
        {busca.trim() && itens.length !== total ? ` (de ${itens.length})` : ''}
      </p>

      {total === 0 ? (
        <ExecutiveEmptyState icon={FileText}
          title={busca.trim() ? 'Nenhuma entrega combina com a busca' : 'Ainda não há entregas aprovadas'}
          description={busca.trim() ? 'Tente outras palavras ou limpe a busca.' : 'Entregas aparecem aqui depois de passar no portão 1. Nesta leitura não há nenhuma.'} />
      ) : (
        <div className="space-y-5">
          {grupos.map(([nomeGrupo, lista]) => (
            <section key={nomeGrupo || 'todas'} aria-label={nomeGrupo || 'Todas as entregas'}>
              {nomeGrupo && (
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  {nomeGrupo}<ExecutiveBadge variant="neutral">{lista.length}</ExecutiveBadge>
                </h3>
              )}
              <ul className="space-y-2">
                {lista.map(e => {
                  const d = descrever(e);
                  const aberta = !!abertas[e.id];
                  const det = detalhes[e.id];
                  const painel = `entrega-${e.id}-painel`;
                  return (
                    <li key={e.id} className="rounded-xl border border-border bg-card">
                      <button type="button" aria-expanded={aberta} aria-controls={painel} onClick={() => alternar(e)}
                        className="flex min-h-11 w-full items-start gap-3 rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-medium text-foreground">{d.titulo}</span>
                          <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{d.empresa}</span><span>{d.etapa}</span><span>Versão {e.versao}</span><span>{d.autor}</span><span>{dataHoraSP(e.criada_em)}</span>
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-xs font-semibold text-primary">{aberta ? 'Fechar' : 'Abrir'}</span>
                      </button>
                      {aberta && (
                        <div id={painel} className="border-t border-border/60 p-3 sm:p-4">
                          {(e.parecer || e.usou_internet !== null) && (
                            <p className="mb-3 break-words text-xs text-muted-foreground">
                              {e.parecer && <>Parecer: {e.parecer}</>}
                              {e.parecer && e.usou_internet !== null ? ' · ' : ''}
                              {e.usou_internet !== null && <>{e.usou_internet ? 'Consultou a internet' : 'Não consultou a internet'}</>}
                            </p>
                          )}
                          {(!det || det.fase === 'carregando') && (
                            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Carregando o texto da entrega...
                            </p>
                          )}
                          {det?.fase === 'erro' && (
                            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
                              <span className="min-w-0 flex-1">{det.mensagem}</span>
                              <button type="button" onClick={() => void carregar(e)}
                                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar de novo
                              </button>
                            </div>
                          )}
                          {det?.fase === 'pronto' && (
                            det.linhas.length === 0
                              ? <p className="text-sm text-muted-foreground">A entrega aprovada não contém texto para exibir.</p>
                              : <>
                                  <dl className="divide-y divide-border/60">
                                    {(expandidas[e.id] ? det.linhas : det.linhas.slice(0, LIMITE_LINHAS)).map((linha, i) => (
                                      <div key={i} className="grid gap-1 py-2 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
                                        <dt className="font-medium capitalize text-muted-foreground">{linha.rotulo}</dt>
                                        <dd className="min-w-0 whitespace-pre-wrap break-words text-foreground">{linha.valor}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                  {det.linhas.length > LIMITE_LINHAS && (
                                    <button type="button" aria-expanded={!!expandidas[e.id]} onClick={() => setExpandidas(x => ({ ...x, [e.id]: !x[e.id] }))}
                                      className="mt-2 min-h-11 rounded-md px-1 text-sm font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                      {expandidas[e.id] ? 'Mostrar menos' : `Mostrar todas as ${det.linhas.length} partes da entrega`}
                                    </button>
                                  )}
                                </>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {det?.fase === 'pronto' && det.linhas.length > 0 && (
                              <button type="button" onClick={() => void copiar(e, det.linhas)}
                                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                <Copy className="h-4 w-4" aria-hidden="true" />Copiar texto
                              </button>
                            )}
                            <button type="button" onClick={() => abrirCard(e.card_id)} aria-label={`Abrir card: ${d.titulo}`}
                              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir card
                            </button>
                            {aviso?.id === e.id && (
                              <span role="status" className={`text-sm ${aviso.ok ? 'text-success' : 'text-destructive'}`}>
                                {aviso.ok ? 'Texto copiado.' : 'Não foi possível copiar. Selecione o texto e copie manualmente.'}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {filtradas.length > mostrar && (
            <button type="button" onClick={() => setMostrar(m => m + PASSO)}
              className="min-h-11 w-full rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Mostrar mais ({filtradas.length - mostrar} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
