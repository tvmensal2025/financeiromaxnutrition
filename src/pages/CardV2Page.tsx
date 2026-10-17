import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, Loader2, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth';
import { KanbanV2 } from '@/components/cards-v2/KanbanV2';
import { estadoDoPedido } from '@/integrations/cards-v2/repository';
import type { CardV2, DetalheCardV2, PedidoPublicacao, RepositorioCardsV2, ResumoOrdemCardV2, SituacaoPublicacao } from '@/integrations/cards-v2/repository';
import { repositorioCardsV2DoApp } from '@/integrations/cards-v2/runtime';
import { EntradaPedidosV2 } from './EntradaPedidosV2';
import { SolicitarCardReal } from './SolicitarCardReal';
import { AcoesFundadorV2 } from './AcoesFundadorV2';
import { PerguntaFundadorV2 } from './PerguntaFundadorV2';
import { LeituraCardFundadorV2 } from './LeituraCardFundadorV2';
import { alvoAcao, alvoEtapa } from '@/integrations/cards-v2/acoes-fundador';
import { limparToquesDaIdentidade } from '@/integrations/cards-v2/toque-pendente';

type PageProps = { repositorio?: RepositorioCardsV2 };
type Estado<T> = { carregando: boolean; dado: T | null; erro: string | null };
const inicio = <T,>(): Estado<T> => ({ carregando: true, dado: null, erro: null });
const uuidValido = (valor: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);

function dataBrasilia(valor: string | null): string {
  if (!valor) return 'Sem prazo';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 'Data indisponível' : data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
  });
}

function resumoDaOrdem(valor: ResumoOrdemCardV2 | null | undefined): { pedido: string | null; criterios: string[]; restricoes: string[]; fontes: string[] } {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return { pedido: null, criterios: [], restricoes: [], fontes: [] };
  const ordem = valor as Record<string, unknown>;
  const textos = (lista: unknown) => Array.isArray(lista) ? lista.filter((item): item is string => typeof item === 'string') : [];
  const criterios = Array.isArray(ordem.como_e_o_pronto) ? ordem.como_e_o_pronto.map(item =>
    item && typeof item === 'object' && 'texto' in item && typeof item.texto === 'string' ? item.texto : null).filter((item): item is string => item !== null) : [];
  return { pedido: typeof ordem.pedido_original === 'string' ? ordem.pedido_original : null,
    criterios, restricoes: textos(ordem.nao_pode), fontes: textos(ordem.fontes_que_pode_ler) };
}

function linhasDaEntrega(conteudo: unknown): { rotulo: string; valor: string }[] {
  const pendentes = [{ valor: conteudo, caminho: '' }];
  const linhas: { rotulo: string; valor: string }[] = [];
  while (pendentes.length) {
    const { valor, caminho } = pendentes.pop()!;
    if (Array.isArray(valor) && valor.length) {
      for (let i = valor.length - 1; i >= 0; i--) pendentes.push({ valor: valor[i], caminho: `${caminho} ${i + 1}`.trim() });
    } else if (valor && typeof valor === 'object' && Object.keys(valor).length) {
      const campos = Object.entries(valor);
      for (let i = campos.length - 1; i >= 0; i--) {
        const [chave, item] = campos[i];
        pendentes.push({ valor: item, caminho: `${caminho} ${chave.replace(/_/g, ' ')}`.trim() });
      }
    } else {
      linhas.push({ rotulo: caminho || 'Texto', valor: valor === null ? 'nulo' : Array.isArray(valor) || typeof valor === 'object' ? 'vazio' : String(valor) });
    }
  }
  return linhas;
}

function Entrega({ conteudo }: { conteudo: unknown }) {
  const [expandida, setExpandida] = useState(false);
  const linhas = linhasDaEntrega(conteudo);
  const limiteInicial = 120;
  if (!linhas.length) return <p className="text-sm text-muted-foreground">A entrega aprovada não contém texto para exibir.</p>;
  return <><dl className="divide-y divide-border/60">
    {(expandida ? linhas : linhas.slice(0, limiteInicial)).map((linha, i) => <div key={i} className="grid gap-1 py-2 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="font-medium capitalize text-muted-foreground">{linha.rotulo}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-foreground">{linha.valor}</dd>
    </div>)}
  </dl>{linhas.length > limiteInicial && <button type="button" aria-expanded={expandida} onClick={() => setExpandida(v => !v)} className="min-h-11 mt-3 text-sm font-semibold text-emerald-800 underline dark:text-emerald-400">
    {expandida ? 'Mostrar menos' : `Mostrar todas as ${linhas.length} partes da entrega`}
  </button>}</>;
}

// Texto verdadeiro por estado do pedido (migration 0018). "No ar" só aparece em PUBLICADA; pedido aceito nunca vira "no ar" aqui.
function SituacaoDoPedido({ pedido }: { pedido: PedidoPublicacao }) {
  const estado = estadoDoPedido(pedido);
  const quando = (valor?: string | null) => valor ? dataBrasilia(valor) : null;
  const versao = pedido.versao_publicada?.trim() || null;
  const destino = pedido.destino?.trim() || null;
  const icone = 'h-4 w-4 shrink-0';
  let titulo: string;
  let detalhes: (string | null)[];
  let marca: JSX.Element;
  switch (estado) {
    case 'PEDIDA':
      titulo = 'Pedido registrado';
      detalhes = [`Feito em ${dataBrasilia(pedido.pedido_em)}. Aguardando execução; ainda não foi publicado.`];
      marca = <Clock3 className={`${icone} text-muted-foreground`} aria-hidden="true" />;
      break;
    case 'EM_EXECUCAO':
      titulo = 'Publicando…';
      detalhes = [quando(pedido.iniciada_em) ? `Começou em ${quando(pedido.iniciada_em)}. Ainda não terminou.` : 'Ainda não terminou.'];
      marca = <Loader2 className={`${icone} animate-spin text-amber-600`} aria-hidden="true" />;
      break;
    case 'PUBLICADA':
      titulo = `No ar (versão ${versao ?? 'não informada'})`;
      detalhes = [quando(pedido.concluida_em) ? `Publicado em ${quando(pedido.concluida_em)}.` : null, destino ? `Destino: ${destino}` : null];
      marca = <CheckCircle2 className={`${icone} text-emerald-700`} aria-hidden="true" />;
      break;
    case 'FALHOU':
      titulo = `Falhou: ${pedido.erro?.trim() || 'motivo não informado'}`;
      detalhes = [quando(pedido.falhou_em) ? `Falhou em ${quando(pedido.falhou_em)}.` : null, 'Este pedido não consta como publicado.'];
      marca = <AlertCircle className={`${icone} text-destructive`} aria-hidden="true" />;
      break;
    case 'REVERTIDA':
      titulo = 'Revertida';
      detalhes = [quando(pedido.revertida_em) ? `Revertida em ${quando(pedido.revertida_em)}.` : null, versao ? `A versão ${versao} foi revertida.` : null];
      marca = <RotateCcw className={`${icone} text-muted-foreground`} aria-hidden="true" />;
      break;
    default:
      titulo = 'Situação do pedido não reconhecida';
      detalhes = ['Não trate este pedido como publicado.'];
      marca = <AlertCircle className={`${icone} text-destructive`} aria-hidden="true" />;
  }
  return <div data-estado-publicacao={estado} className="mt-2 text-sm">
    <p className="flex items-start gap-2 font-medium">{marca}<span className="min-w-0 break-words">{titulo}</span></p>
    {detalhes.filter((linha): linha is string => !!linha).map((linha, i) => <p key={i} className="mt-1 break-words pl-6 text-muted-foreground">{linha}</p>)}
  </div>;
}

export default function CardV2Page({ repositorio }: PageProps) {
  const { user, isFounder } = useAuth();
  const anterior = useRef<{ id: string | null; fundador: boolean }>({ id: null, fundador: false });
  useEffect(() => {
    const antes = anterior.current;
    if (antes.id && antes.fundador && (!isFounder || user?.id !== antes.id)) {
      try { limparToquesDaIdentidade(antes.id); } catch { /* A sessão do navegador pode não oferecer armazenamento. */ }
    }
    anterior.current = { id: user?.id ?? null, fundador: isFounder };
  }, [user?.id, isFounder]);
  return <ConteudoCardV2 key={`${user?.id ?? 'anon'}:${isFounder ? 'fundador' : 'membro'}`} repositorio={repositorio} />;
}

function ConteudoCardV2({ repositorio }: PageProps) {
  const { isFounder, user } = useAuth();
  const [busca, setBusca] = useSearchParams();
  const cardNaUrl = busca.get('card');
  const temCardNaUrl = busca.has('card');
  const cardUnicoNaUrl = busca.getAll('card').length === 1;
  const [repo, setRepo] = useState<RepositorioCardsV2 | null>(repositorio ?? null);
  const [erroInicial, setErroInicial] = useState<string | null>(null);
  const [tentativaConexao, setTentativaConexao] = useState(0);
  const [lista, setLista] = useState<Estado<CardV2[]>>(inicio);
  const [detalhe, setDetalhe] = useState<Estado<DetalheCardV2>>(inicio);
  const [idDoDetalhe, setIdDoDetalhe] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [erroSelecao, setErroSelecao] = useState<string | null>(null);
  const [tentativaLista, setTentativaLista] = useState(0);
  const [tentativaDetalhe, setTentativaDetalhe] = useState(0);
  const [publicacao, setPublicacao] = useState<Estado<SituacaoPublicacao>>(inicio);
  const [tentativaPublicacao, setTentativaPublicacao] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erroPedido, setErroPedido] = useState<string | null>(null);

  useEffect(() => {
    if (repositorio) { setRepo(repositorio); return; }
    let ativo = true;
    setErroInicial(null);
    repositorioCardsV2DoApp().then(r => { if (ativo) setRepo(r); }).catch(() => {
      if (ativo) setErroInicial('Não foi possível abrir os cards v2.');
    });
    return () => { ativo = false; };
  }, [repositorio, tentativaConexao]);

  useEffect(() => {
    if (!repo) return;
    let ativo = true;
    setLista(inicio());
    repo.listar().then(dado => { if (ativo) setLista({ carregando: false, dado, erro: null }); })
      .catch(() => { if (ativo) setLista({ carregando: false, dado: null, erro: 'Não foi possível carregar os cards.' }); });
    return () => { ativo = false; };
  }, [repo, tentativaLista]);

  useEffect(() => {
    if (lista.carregando || !lista.dado) return;
    if (temCardNaUrl) {
      const encontrado = cardUnicoNaUrl && cardNaUrl && uuidValido(cardNaUrl.toLowerCase())
        ? lista.dado.find(card => card.id.toLowerCase() === cardNaUrl.toLowerCase()) : null;
      if (encontrado) {
        setCardId(encontrado.id);
        setErroSelecao(null);
      } else {
        setCardId(null);
        setErroSelecao('O card indicado na URL não está disponível para esta conta. Escolha um card do quadro.');
        const proxima = new URLSearchParams(busca);
        proxima.delete('card');
        setBusca(proxima, { replace: true });
      }
    } else {
      setCardId(atual => atual && uuidValido(atual.toLowerCase()) ? null : atual);
    }
  }, [cardNaUrl, cardUnicoNaUrl, temCardNaUrl, lista.carregando, lista.dado, busca, setBusca]);

  useEffect(() => {
    if (!repo || !cardId) return;
    let ativo = true;
    setDetalhe(inicio());
    repo.detalhar(cardId).then(dado => { if (ativo) { setIdDoDetalhe(cardId); setDetalhe({ carregando: false, dado, erro: null }); } })
      .catch(() => { if (ativo) setDetalhe({ carregando: false, dado: null, erro: 'Não foi possível carregar o card.' }); });
    return () => { ativo = false; };
  }, [repo, cardId, tentativaDetalhe]);

  useEffect(() => {
    if (!repo || !isFounder) { setPublicacao({ carregando: false, dado: null, erro: null }); return; }
    let ativo = true;
    setPublicacao(inicio());
    repo.situacaoPublicacao().then(dado => { if (ativo) setPublicacao({ carregando: false, dado, erro: null }); })
      .catch(() => { if (ativo) setPublicacao({ carregando: false, dado: null, erro: 'Não foi possível consultar a publicação.' }); });
    return () => { ativo = false; };
  }, [repo, isFounder, tentativaPublicacao]);

  async function pedirPublicacao() {
    if (!repo || !isFounder || !publicacao.dado?.fundador || publicacao.dado.pedido || enviando) return;
    setEnviando(true);
    setErroPedido(null);
    try {
      await repo.pedirPublicacao();
      const atual = await repo.situacaoPublicacao();
      if (!atual.pedido) throw new Error('Pedido não confirmado pelo banco.');
      setPublicacao({ carregando: false, dado: atual, erro: null });
    } catch {
      setErroPedido('Não foi possível confirmar o pedido de publicação. Consulte a situação antes de tentar novamente.');
      setPublicacao({ carregando: false, dado: null, erro: 'Não foi possível consultar a publicação.' });
    } finally { setEnviando(false); }
  }

  const selecionado = lista.dado?.find(c => c.id === cardId);
  const detalheVisivel = idDoDetalhe === cardId ? detalhe.dado : null;
  const ordemVisivel = resumoDaOrdem(detalheVisivel?.ordem);
  const etapasPendentes = detalheVisivel?.etapas.filter(etapa => etapa.estado === 'ESPERANDO_FUNDADOR') ?? [];
  const acoesPendentes = detalheVisivel?.acoes?.filter(acao => ['PROPOSTA', 'INCERTA'].includes(acao.estado)) ?? [];
  function atualizarCards() {
    setTentativaLista(n => n + 1);
    if (cardId) {
      setIdDoDetalhe(null);
      setDetalhe(inicio());
      setTentativaDetalhe(n => n + 1);
    }
  }
  async function relerDepoisEvento(id: string) {
    if (!repo) throw new Error('Banco indisponível.');
    const [cards, dados] = await Promise.all([repo.listar(), repo.detalhar(id)]);
    setLista({ carregando: false, dado: cards, erro: null });
    if (cardId === id) {
      setIdDoDetalhe(id);
      setDetalhe({ carregando: false, dado: dados, erro: null });
    }
  }
  function escolherCard(id: string) {
    setIdDoDetalhe(null);
    setDetalhe(inicio());
    setErroSelecao(null);
    if (id === cardId) setTentativaDetalhe(n => n + 1);
    else setCardId(id);
    const proxima = new URLSearchParams(busca);
    if (uuidValido(id.toLowerCase())) proxima.set('card', id);
    else proxima.delete('card');
    if (proxima.toString() !== busca.toString()) setBusca(proxima);
  }
  return <div className="he-v2-card-page mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-8">
    <header className="border-b border-border pb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Sistema Helena / operação v2</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Quadro de cards</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Acompanhe pedidos, esperas, etapas e entregas aprovadas. As colunas refletem o estado atual de cada card no banco.</p>
    </header>

    {isFounder && <section aria-label="Publicação" className="border-l-2 border-emerald-700 bg-muted/30 px-5 py-4">
      <h2 className="text-base font-semibold">Publicação</h2>
      {publicacao.carregando && <p className="mt-2 text-sm text-muted-foreground">Carregando situação de publicação…</p>}
      {publicacao.erro && <p role="alert" className="mt-2 text-sm text-destructive">{publicacao.erro}</p>}
      {erroPedido && <p role="alert" className="mt-2 text-sm text-destructive">{erroPedido}</p>}
      {publicacao.erro && <button type="button" onClick={() => { setErroPedido(null); setTentativaPublicacao(n => n + 1); }}
        className="min-h-11 mt-2 text-sm font-semibold underline">Consultar novamente</button>}
      {publicacao.dado?.pedido && <SituacaoDoPedido pedido={publicacao.dado.pedido} />}
      {publicacao.dado?.pedido && <button type="button" onClick={() => { setErroPedido(null); setTentativaPublicacao(n => n + 1); }}
        className="min-h-11 mt-2 text-sm font-semibold text-emerald-800 underline dark:text-emerald-400">Atualizar situação</button>}
      {publicacao.dado?.fundador && !publicacao.dado.pedido && <button type="button" disabled={enviando} onClick={pedirPublicacao}
        className="min-h-11 mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 active:scale-[0.98] disabled:opacity-50">
        {enviando ? 'Registrando pedido…' : 'Pedir publicação'}
      </button>}
    </section>}

    {isFounder && user?.id && <EntradaPedidosV2 identidade={user.id} />}
    {isFounder && <SolicitarCardReal repositorio={repo} identidade={user?.id ?? null} onCardCriado={atualizarCards} />}

    <div className="space-y-8">
      <section aria-label="Cards" className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kanban</h2>
          <button type="button" onClick={atualizarCards} className="min-h-11 text-sm font-semibold text-emerald-800 underline dark:text-emerald-400">Atualizar cards</button></div>
        {(erroInicial || lista.erro) && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          <AlertCircle className="mb-2 h-4 w-4" />{erroInicial || lista.erro}
          {erroInicial && <button type="button" onClick={() => setTentativaConexao(n => n + 1)} className="min-h-11 mt-3 block font-semibold underline">Tentar novamente</button>}
          {lista.erro && <button type="button" onClick={() => setTentativaLista(n => n + 1)} className="min-h-11 mt-3 block font-semibold underline">Tentar novamente</button>}
        </div>}
        {lista.carregando && !erroInicial && <p className="animate-pulse border-b border-border py-5 text-sm text-muted-foreground">Carregando cards…</p>}
        {!lista.carregando && lista.dado?.length === 0 && <p className="border-t border-border py-6 text-sm text-muted-foreground">Nenhum card disponível.</p>}
        {erroSelecao && <p role="alert" className="text-sm text-destructive">{erroSelecao}</p>}
        {lista.dado && lista.dado.length > 0 && <KanbanV2 cards={lista.dado} selecionado={cardId} onSelecionar={escolherCard} formatarPrazo={dataBrasilia} />}
      </section>

      <section aria-label="Detalhes do card" className="min-w-0 space-y-5">
        {!cardId && <div className="border-t border-border py-8 text-sm text-muted-foreground">Escolha um card para ver as etapas e entregas.</div>}
        {cardId && <>
          <header className="border-b border-border pb-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Card selecionado</p>
            <h2 className="mt-2 text-xl font-semibold">{selecionado?.titulo || 'Card'}</h2>
            {selecionado && <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span>Dono: {selecionado.dono || 'Não informado'}</span><span>Prazo: {dataBrasilia(selecionado.prazo)}</span></p>}
          </header>
          {(etapasPendentes.length > 0 || acoesPendentes.length > 0) && <section aria-label="Decisões pendentes do fundador" className="rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <h3 className="font-semibold">Sua decisão é necessária neste card</h3>
            {etapasPendentes.map(etapa => <p key={etapa.id} className="mt-2">Etapa {etapa.codigo}: ESPERANDO_FUNDADOR{etapa.motivo ? ` · motivo ${etapa.motivo}` : ''}</p>)}
            {acoesPendentes.map(acao => <p key={acao.id} className="mt-2">Ação externa {acao.codigo}: {acao.estado}</p>)}
          </section>}
          {selecionado && (ordemVisivel.pedido || ordemVisivel.criterios.length > 0 || ordemVisivel.restricoes.length > 0 || ordemVisivel.fontes.length > 0) && <section aria-label="Pedido confirmado do card" className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
            <h3 className="font-semibold">Pedido registrado</h3>
            {ordemVisivel.pedido && <p className="mt-2 whitespace-pre-wrap break-words">{ordemVisivel.pedido}</p>}
            {ordemVisivel.criterios.length > 0 && <div className="mt-3"><h4 className="font-medium">Critérios de pronto</h4><ul className="list-disc pl-5">{ordemVisivel.criterios.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
            {ordemVisivel.restricoes.length > 0 && <div className="mt-3"><h4 className="font-medium">Restrições</h4><ul className="list-disc pl-5">{ordemVisivel.restricoes.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
            {ordemVisivel.fontes.length > 0 && <div className="mt-3"><h4 className="font-medium">Fontes autorizadas</h4><ul className="list-disc break-words pl-5">{ordemVisivel.fontes.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
          </section>}
          {isFounder && user?.id && repo && selecionado && detalheVisivel && <LeituraCardFundadorV2 key={`card-${selecionado.id}-${selecionado.versao}-${selecionado.estado}-${selecionado.motivo}-${ordemVisivel.pedido ? 'pedido' : 'sem-pedido'}`} card={selecionado} identidade={user.id} pedidoOriginalDisponivel={!!ordemVisivel.pedido?.trim()} repositorio={repo} onAtualizar={() => relerDepoisEvento(selecionado.id)} />}
          {detalhe.carregando && <p className="animate-pulse py-4 text-sm text-muted-foreground">Carregando etapas…</p>}
          {detalhe.erro && <div role="alert" className="text-sm text-destructive">{detalhe.erro}<button type="button" onClick={() => setTentativaDetalhe(n => n + 1)} className="min-h-11 ml-3 font-semibold underline">Tentar novamente</button></div>}
          {!detalhe.carregando && detalheVisivel?.etapas.length === 0 && <p className="text-sm text-muted-foreground">Este card ainda não tem etapas.</p>}
          {detalheVisivel?.etapas.map(etapa => <article key={etapa.id} className="border-b border-border pb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{etapa.codigo} · {etapa.nome}</h3><span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{etapa.estado.replace(/_/g, ' ')}</span></div>
            <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2"><p>Autor: {etapa.autor}</p><p>Revisor: {etapa.revisores.join(', ') || 'Não informado'}</p><p>Dono: {etapa.dono || 'Não informado'}</p><p className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Prazo: {dataBrasilia(etapa.prazo_ate)}</p></div>
            {detalheVisivel.entregas.filter(entrega => entrega.etapa_id === etapa.id).map(entrega => <div key={entrega.id} className="mt-5 rounded-xl border border-border bg-card p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />Entrega aprovada · versão {entrega.versao}</h4><Entrega conteudo={entrega.conteudo} />
            </div>)}
            {isFounder && user?.id && repo && etapa.motivo !== 'PERGUNTA' && <AcoesFundadorV2 key={`etapa-${etapa.id}-${etapa.versao}`} alvo={alvoEtapa(etapa)} identidade={user.id} cardId={cardId} repositorio={repo} onAtualizar={() => relerDepoisEvento(cardId)} />}
            {isFounder && user?.id && repo && etapa.estado === 'ESPERANDO_FUNDADOR' && etapa.motivo === 'PERGUNTA' && <PerguntaFundadorV2 key={`pergunta-${etapa.id}-${etapa.versao}`} etapa={etapa} identidade={user.id} cardId={cardId} repositorio={repo} onAtualizar={() => relerDepoisEvento(cardId)} />}
          </article>)}
          {detalheVisivel?.acoes && detalheVisivel.acoes.length > 0 && <section aria-label="Ações externas do card" className="space-y-4 border-t border-border pt-5">
            <h3 className="font-semibold">Ações externas</h3>
            {detalheVisivel.acoes.map(acao => <article key={acao.id} className="rounded-lg border border-border p-4 text-sm">
              <h4 className="font-semibold">{acao.codigo} · {acao.etapa_codigo}</h4>
              <p className="mt-1 text-muted-foreground">Estado: {acao.estado.replace(/_/g, ' ')} · Tipo: {acao.tipo.replace(/_/g, ' ')}</p>
              {isFounder && user?.id && repo && <AcoesFundadorV2 key={`acao-${acao.id}-${acao.versao}`} alvo={alvoAcao(acao)} identidade={user.id} cardId={cardId} repositorio={repo} onAtualizar={() => relerDepoisEvento(cardId)} />}
            </article>)}
          </section>}
        </>}
      </section>
    </div>
  </div>;
}
