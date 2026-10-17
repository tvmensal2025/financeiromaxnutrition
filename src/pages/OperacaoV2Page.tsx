import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth';
import { repositorioCardsV2DoApp } from '@/integrations/cards-v2/runtime';
import type { CardV2, DetalheCardV2, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';

type Secao = 'execucao' | 'entregas' | 'consumo' | 'cobertura' | 'supervisao';
const secoes: { id: Secao; titulo: string }[] = [
  { id: 'execucao', titulo: 'Execução' }, { id: 'entregas', titulo: 'Entregas' },
  { id: 'consumo', titulo: 'Consumo' }, { id: 'cobertura', titulo: 'Cobertura' },
  { id: 'supervisao', titulo: 'Supervisão' },
];
const emCurso = new Set(['RASCUNHO', 'VALIDANDO_PLANO', 'ESPERANDO_CONFIRMACAO', 'ESPERANDO_FUNDADOR', 'EM_ANDAMENTO']);
const esperando = new Set(['ESPERANDO_CONFIRMACAO', 'ESPERANDO_FUNDADOR']);
const linkCard = (id: string) => `/cards?card=${encodeURIComponent(id)}`;

export default function OperacaoV2Page({ secao, repositorio }: { secao?: Secao; repositorio?: RepositorioCardsV2 }) {
  const { pathname } = useLocation();
  const { user, isFounder } = useAuth();
  const atual = secao ?? secoes.find(item => pathname.endsWith(`/${item.id}`))?.id ?? 'execucao';
  if (!user || !isFounder) return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-semibold">Operação</h1><p className="mt-3">A operação está disponível somente para o fundador.</p></main>;
  return <Operacao key={user.id} secao={atual} repositorio={repositorio} />;
}

function Operacao({ secao, repositorio }: { secao: Secao; repositorio?: RepositorioCardsV2 }) {
  const [cards, setCards] = useState<CardV2[] | null>(null);
  const [erro, setErro] = useState(false);
  const [ciclo, setCiclo] = useState(0);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheCardV2 | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState(false);
  useEffect(() => {
    let vivo = true;
    setCards(null); setErro(false); setSelecionado(null); setDetalhe(null);
    void (async () => {
      try {
        const lista = await (repositorio ?? await repositorioCardsV2DoApp()).listar();
        if (!Array.isArray(lista)) throw new Error('Lista inválida');
        if (vivo) setCards(lista.slice(0, 200));
      } catch { if (vivo) setErro(true); }
    })();
    return () => { vivo = false; };
  }, [repositorio, ciclo]);
  useEffect(() => {
    if (!selecionado) return;
    let vivo = true;
    setDetalhe(null); setErroDetalhe(false);
    void (async () => {
      try { const valor = await (repositorio ?? await repositorioCardsV2DoApp()).detalhar(selecionado); if (vivo) setDetalhe(valor); }
      catch { if (vivo) setErroDetalhe(true); }
    })();
    return () => { vivo = false; };
  }, [selecionado, repositorio, ciclo]);

  const titulo = secoes.find(item => item.id === secao)!.titulo;
  const visiveis = cards?.filter(card => secao === 'entregas' ? ['PRONTO', 'EM_ANDAMENTO', 'ESPERANDO_FUNDADOR'].includes(card.estado) : true) ?? [];
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-8">
    <header className="rounded-3xl bg-emerald-950 p-7 text-white"><p className="text-xs uppercase tracking-widest text-emerald-200">Sistema Helena · cards v2</p><h1 className="mt-2 text-3xl font-semibold">{titulo}</h1><p className="mt-3 max-w-3xl text-emerald-50/90">Leitura dos cards disponíveis para sua conta. Estado do card, revisão de etapa, entrega aprovada e publicação são fatos diferentes.</p></header>
    <nav aria-label="Áreas da operação" className="flex flex-wrap gap-2">{secoes.map(item => <Link key={item.id} to={`/${item.id}`} aria-current={secao === item.id ? 'page' : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${secao === item.id ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-border bg-card'}`}>{item.titulo}</Link>)}</nav>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Fonte: cards v2 consultados nesta sessão. Até 200 registros recentes exibidos; contagens referem-se à amostra.</p><button className="min-h-11 font-semibold underline" onClick={() => setCiclo(n => n + 1)}>Atualizar</button></div>
    {!cards && !erro && <p role="status">Consultando cards…</p>}
    {erro && <p role="alert" className="text-destructive">Não foi possível consultar os cards. Tente atualizar.</p>}
    {cards && <>
      {secao === 'consumo' ? <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Consumo da operação</h2><p className="mt-2 text-sm text-muted-foreground">O repositório de cards informa estados e versões, mas não fornece medição de tokens, chamadas ou custo. Consumo real ainda não está disponível nesta página.</p><p className="mt-3 text-sm">{cards.length} cards na amostra consultada. Esta contagem não representa custo nem uso de modelos.</p></section> : <>
        {(secao === 'supervisao' || secao === 'cobertura') && <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo dos cards"><Resumo titulo="Cards consultados" valor={cards.length}/><Resumo titulo="Em curso" valor={cards.filter(card => emCurso.has(card.estado)).length}/><Resumo titulo="Esperando fundador" valor={cards.filter(card => esperando.has(card.estado)).length}/></section>}
        {secao === 'cobertura' && <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Esta cobertura mostra apenas estados dos cards retornados. Disponibilidade do motor, integrações e medição de consumo não são inferidas desses estados.</p>}
        <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">{secao === 'entregas' ? 'Cards para conferir entregas' : 'Cards da amostra'}</h2>
          {!visiveis.length ? <p className="mt-3 text-sm text-muted-foreground">Nenhum card encontrado nesta consulta.</p> : <ul className="mt-3 divide-y divide-border">{visiveis.map(card => <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><h3 className="font-semibold">{card.titulo}</h3><p className="mt-1 text-sm text-muted-foreground">{card.empresa || 'Empresa não informada'} · {card.estado} · versão {card.versao ?? 'não informada'}</p></div><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => setSelecionado(card.id)} className="min-h-11 font-semibold text-emerald-800 underline dark:text-emerald-400">Ver etapas</button><Link to={linkCard(card.id)} className="inline-flex min-h-11 items-center font-semibold underline">Abrir card</Link></div></li>)}</ul>}
        </section>
        {selecionado && <section className="rounded-xl border border-border bg-card p-5" aria-label="Detalhe do card"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">Etapas e entregas aprovadas</h2><button type="button" className="min-h-11 font-semibold underline" onClick={() => setSelecionado(null)}>Fechar</button></div>
          {!detalhe && !erroDetalhe && <p role="status" className="mt-3">Consultando detalhe…</p>}
          {erroDetalhe && <p role="alert" className="mt-3 text-destructive">Não foi possível consultar este card.</p>}
          {detalhe && <><p className="mt-3 text-sm text-muted-foreground">Apenas entregas de etapas aprovadas/prontas, com portão 1 aprovado, versão atual e entrega fresca são retornadas pelo repositório v2.</p><ul className="mt-3 divide-y divide-border">{detalhe.etapas.map(etapa => <li key={etapa.id} className="py-3"><p className="font-semibold">{etapa.nome} · {etapa.estado}</p><p className="text-sm text-muted-foreground">Autor: {etapa.autor} · versão {etapa.versao} · revisor: {etapa.revisor || etapa.revisores.join(', ') || 'não informado'}</p><p className="mt-1 text-sm">{detalhe.entregas.some(entrega => entrega.etapa_id === etapa.id) ? 'Entrega aprovada disponível no card' : 'Sem entrega aprovada nesta versão'}</p></li>)}</ul><Link to={linkCard(selecionado)} className="mt-3 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline dark:text-emerald-400">Abrir conteúdo e decisões no card</Link></>}
        </section>}
      </>}
    </>}
  </main>;
}

function Resumo({ titulo, valor }: { titulo: string; valor: number }) {
  return <article className="rounded-xl border border-border bg-card p-5"><h2 className="text-sm text-muted-foreground">{titulo}</h2><p className="mt-2 text-3xl font-semibold tabular-nums">{valor}</p></article>;
}
