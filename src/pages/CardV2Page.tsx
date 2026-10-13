import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileText } from 'lucide-react';
import { useAuth } from '@/auth';
import type { CardV2, DetalheCardV2, RepositorioCardsV2, SituacaoPublicacao } from '@/integrations/cards-v2/repository';
import { repositorioCardsV2DoApp } from '@/integrations/cards-v2/runtime';

type PageProps = { repositorio?: RepositorioCardsV2 };
type Estado<T> = { carregando: boolean; dado: T | null; erro: string | null };
const inicio = <T,>(): Estado<T> => ({ carregando: true, dado: null, erro: null });

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
  </dl>{linhas.length > limiteInicial && <button type="button" aria-expanded={expandida} onClick={() => setExpandida(v => !v)} className="mt-3 text-sm font-semibold text-emerald-800 underline dark:text-emerald-400">
    {expandida ? 'Mostrar menos' : `Mostrar todas as ${linhas.length} partes da entrega`}
  </button>}</>;
}

export default function CardV2Page({ repositorio }: PageProps) {
  const { isFounder } = useAuth();
  const [repo, setRepo] = useState<RepositorioCardsV2 | null>(repositorio ?? null);
  const [erroInicial, setErroInicial] = useState<string | null>(null);
  const [tentativaConexao, setTentativaConexao] = useState(0);
  const [lista, setLista] = useState<Estado<CardV2[]>>(inicio);
  const [detalhe, setDetalhe] = useState<Estado<DetalheCardV2>>(inicio);
  const [idDoDetalhe, setIdDoDetalhe] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
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
  function atualizarCards() {
    setTentativaLista(n => n + 1);
    if (cardId) {
      setIdDoDetalhe(null);
      setDetalhe(inicio());
      setTentativaDetalhe(n => n + 1);
    }
  }
  function escolherCard(id: string) {
    setIdDoDetalhe(null);
    setDetalhe(inicio());
    if (id === cardId) setTentativaDetalhe(n => n + 1);
    else setCardId(id);
  }
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-8">
    <header className="border-b border-border pb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Sistema Helena / operação v2</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Cards em andamento</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Acompanhe etapas, responsáveis e entregas aprovadas. Os dados vêm do estado atual do card.</p>
    </header>

    {isFounder && <section aria-label="Publicação" className="border-l-2 border-emerald-700 bg-muted/30 px-5 py-4">
      <h2 className="text-base font-semibold">Publicação</h2>
      {publicacao.carregando && <p className="mt-2 text-sm text-muted-foreground">Carregando situação de publicação…</p>}
      {publicacao.erro && <p role="alert" className="mt-2 text-sm text-destructive">{publicacao.erro}</p>}
      {erroPedido && <p role="alert" className="mt-2 text-sm text-destructive">{erroPedido}</p>}
      {publicacao.erro && <button type="button" onClick={() => { setErroPedido(null); setTentativaPublicacao(n => n + 1); }}
        className="mt-2 text-sm font-semibold underline">Consultar novamente</button>}
      {publicacao.dado?.pedido && <p className="mt-2 flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-700" />Pedido de hoje registrado em {dataBrasilia(publicacao.dado.pedido.pedido_em)}.</p>}
      {publicacao.dado?.fundador && !publicacao.dado.pedido && <button type="button" disabled={enviando} onClick={pedirPublicacao}
        className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 active:scale-[0.98] disabled:opacity-50">
        {enviando ? 'Registrando pedido…' : 'Pedir publicação'}
      </button>}
    </section>}

    <div className="grid gap-8 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.6fr)]">
      <section aria-label="Lista de cards" className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cards</h2>
          <button type="button" onClick={atualizarCards} className="text-sm font-semibold text-emerald-800 underline dark:text-emerald-400">Atualizar cards</button></div>
        {(erroInicial || lista.erro) && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          <AlertCircle className="mb-2 h-4 w-4" />{erroInicial || lista.erro}
          {erroInicial && <button type="button" onClick={() => setTentativaConexao(n => n + 1)} className="mt-3 block font-semibold underline">Tentar novamente</button>}
          {lista.erro && <button type="button" onClick={() => setTentativaLista(n => n + 1)} className="mt-3 block font-semibold underline">Tentar novamente</button>}
        </div>}
        {lista.carregando && !erroInicial && <p className="animate-pulse border-b border-border py-5 text-sm text-muted-foreground">Carregando cards…</p>}
        {!lista.carregando && lista.dado?.length === 0 && <p className="border-t border-border py-6 text-sm text-muted-foreground">Nenhum card disponível.</p>}
        <div className="divide-y divide-border border-y border-border">
          {lista.dado?.map(card => <button key={card.id} type="button" onClick={() => escolherCard(card.id)} aria-current={cardId === card.id ? 'true' : undefined}
            className="group flex w-full items-center justify-between gap-3 px-2 py-4 text-left transition hover:bg-muted/50 active:scale-[0.99]">
            <span className="min-w-0"><strong className="block truncate text-sm">{card.titulo}</strong><span className="mt-1 block text-xs text-muted-foreground">{card.estado.replace(/_/g, ' ')} · {card.dono || 'Dono não informado'}</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
          </button>)}
        </div>
      </section>

      <section aria-label="Detalhes do card" className="min-w-0 space-y-5">
        {!cardId && <div className="border-t border-border py-8 text-sm text-muted-foreground">Escolha um card para ver as etapas e entregas.</div>}
        {cardId && <>
          <header className="border-b border-border pb-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Card selecionado</p>
            <h2 className="mt-2 text-xl font-semibold">{selecionado?.titulo || 'Card'}</h2>
            {selecionado && <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span>Dono: {selecionado.dono || 'Não informado'}</span><span>Prazo: {dataBrasilia(selecionado.prazo)}</span></p>}
          </header>
          {detalhe.carregando && <p className="animate-pulse py-4 text-sm text-muted-foreground">Carregando etapas…</p>}
          {detalhe.erro && <div role="alert" className="text-sm text-destructive">{detalhe.erro}<button type="button" onClick={() => setTentativaDetalhe(n => n + 1)} className="ml-3 font-semibold underline">Tentar novamente</button></div>}
          {!detalhe.carregando && detalheVisivel?.etapas.length === 0 && <p className="text-sm text-muted-foreground">Este card ainda não tem etapas.</p>}
          {detalheVisivel?.etapas.map(etapa => <article key={etapa.id} className="border-b border-border pb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{etapa.codigo} · {etapa.nome}</h3><span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{etapa.estado.replace(/_/g, ' ')}</span></div>
            <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2"><p>Autor: {etapa.autor}</p><p>Revisor: {etapa.revisores.join(', ') || 'Não informado'}</p><p>Dono: {etapa.dono || 'Não informado'}</p><p className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Prazo: {dataBrasilia(etapa.prazo_ate)}</p></div>
            {detalheVisivel.entregas.filter(entrega => entrega.etapa_id === etapa.id).map(entrega => <div key={entrega.id} className="mt-5 rounded-xl border border-border bg-card p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />Entrega aprovada · versão {entrega.versao}</h4><Entrega conteudo={entrega.conteudo} />
            </div>)}
          </article>)}
        </>}
      </section>
    </div>
  </main>;
}
