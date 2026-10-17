import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, ClipboardList, Layers3, RefreshCw, Settings2, Users } from 'lucide-react';
import { useAuth } from '@/auth';
import { repositorioCardsV2DoApp } from '@/integrations/cards-v2/runtime';
import { ROTULOS_ESTADO_CARD } from '@/integrations/cards-v2/rotulos';
import { repositorioPedidosV2DoApp } from '@/integrations/pedidos-v2/runtime';
import { repositorioConfigV2DoApp } from '@/integrations/config-v2/runtime';
import type { CardV2, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import type { PedidoEntrada, RepositorioPedidosV2 } from '@/integrations/pedidos-v2/repository';
import type { ConfigDetail, RepositorioConfigV2 } from '@/integrations/config-v2/repository';

type Fonte<T> = { estado: 'carregando' | 'pronta' | 'erro'; dados: T | null };
const carregando = <T,>(): Fonte<T> => ({ estado: 'carregando', dados: null });
const LIMITE_CARDS_PAINEL = 200;
const ESTADOS_FUNDADOR = new Set(['ESPERANDO_CONFIRMACAO', 'ESPERANDO_FUNDADOR']);
const ESTADOS_EM_CURSO = new Set(['RASCUNHO', 'VALIDANDO_PLANO', 'ESPERANDO_CONFIRMACAO', 'ESPERANDO_FUNDADOR', 'EM_ANDAMENTO']);
type Catalogo = { revisao: string; empresas: { id: string; nome: string; estado: string }[]; agentes: { id: string; nome: string; estado: string }[] };
type Props = { repositorioCards?: RepositorioCardsV2; repositorioPedidos?: RepositorioPedidosV2; repositorioConfig?: RepositorioConfigV2 };

function registro(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}
function texto(valor: unknown): string { return typeof valor === 'string' ? valor.trim() : ''; }
function rotuloEstado(estado: string): string {
  const rotulos: Record<string, string> = {
    ...ROTULOS_ESTADO_CARD,
    CONFIRMADO: 'confirmado', NAO_CONFIRMADO: 'não confirmado', ESTAGIO: 'estágio', ATIVO: 'ativo', PAUSADO: 'pausado',
  };
  return rotulos[estado] ?? estado.replace(/_/g, ' ').toLowerCase();
}
function catalogoDaRevisao(detalhe: ConfigDetail): Catalogo {
  const organograma = registro(detalhe.conteudo['helena-v2/organograma.yaml']);
  if (!organograma) throw new Error('A revisão ativa não trouxe o organograma.');
  const empresas = registro(organograma.empresas);
  const agentes = organograma.agentes;
  if (!empresas || !Array.isArray(agentes)) throw new Error('A revisão ativa não trouxe empresas e agentes.');
  return {
    revisao: detalhe.nome,
    empresas: Object.entries(empresas).map(([id, dado]) => {
      const linha = registro(dado);
      return { id, nome: texto(linha?.nome) || id, estado: texto(registro(linha?.pacote)?.estado) || 'NÃO INFORMADO' };
    }),
    agentes: agentes.map((dado, indice) => {
      const linha = registro(dado);
      if (!linha) throw new Error(`Agente ${indice + 1} inválido na revisão ativa.`);
      return { id: texto(linha.id) || String(indice), nome: texto(linha.nome) || texto(linha.identidade) || 'Sem nome',
        estado: texto(linha.estado) || 'NÃO INFORMADO' };
    }),
  };
}
function acaoDoCard(card: CardV2): string {
  if (ESTADOS_FUNDADOR.has(card.estado)) return 'Ver decisão pendente';
  if (card.estado === 'PRONTO') return 'Ver resultado aprovado';
  if (card.estado === 'ENCERRADO_COM_FALHA') return 'Ver falha';
  return 'Acompanhar card';
}
function descricaoDoPedido(pedido: PedidoEntrada): string {
  if (pedido.estado === 'RECEBIDO') return 'Recebido para triagem; ainda não virou card.';
  if (pedido.estado === 'PLANO_CONFIRMADO') return 'Plano confirmado; aguardando criação do card.';
  return 'Card criado; acompanhe o andamento no quadro.';
}
function Painel({ repositorioCards, repositorioPedidos, repositorioConfig }: Props) {
  const { isFounder } = useAuth();
  const [cicloCards, setCicloCards] = useState(0);
  const [cicloPedidos, setCicloPedidos] = useState(0);
  const [cicloConfig, setCicloConfig] = useState(0);
  const [cards, setCards] = useState<Fonte<CardV2[]>>(carregando);
  const [pedidos, setPedidos] = useState<Fonte<PedidoEntrada[]>>(carregando);
  const [catalogo, setCatalogo] = useState<Fonte<Catalogo>>(carregando);

  useEffect(() => {
    let atual = true;
    setCards(carregando());
    void (async () => {
      try {
        const repo = repositorioCards ?? await repositorioCardsV2DoApp();
        const lista = await repo.listar();
        if (!Array.isArray(lista)) throw new Error('Lista de cards inválida.');
        if (atual) setCards({ estado: 'pronta', dados: lista.slice(0, LIMITE_CARDS_PAINEL) });
      } catch { if (atual) setCards({ estado: 'erro', dados: null }); }
    })();
    return () => { atual = false; };
  }, [repositorioCards, cicloCards]);

  useEffect(() => {
    if (!isFounder) return;
    let atual = true;
    setPedidos(carregando());
    void (async () => {
      try {
        const repo = repositorioPedidos ?? await repositorioPedidosV2DoApp();
        const lista = await repo.listar();
        if (atual) setPedidos({ estado: 'pronta', dados: lista.itens });
      } catch { if (atual) setPedidos({ estado: 'erro', dados: null }); }
    })();
    return () => { atual = false; };
  }, [isFounder, repositorioPedidos, cicloPedidos]);

  useEffect(() => {
    if (!isFounder) return;
    let atual = true;
    setCatalogo(carregando());
    void (async () => {
      try {
        const repo = repositorioConfig ?? await repositorioConfigV2DoApp();
        const revisoes = await repo.listar();
        const ativas = revisoes.filter(revisao => revisao.ativa);
        if (ativas.length !== 1 || ativas[0].estado !== 'VALIDADA') throw new Error('Revisão ativa não confirmada.');
        const ativa = ativas[0];
        const detalhe = await repo.ler(ativa.id);
        if (detalhe.id !== ativa.id || detalhe.versao !== ativa.versao || !detalhe.ativa || detalhe.estado !== 'VALIDADA') {
          throw new Error('Revisão ativa mudou durante a leitura.');
        }
        const dados = catalogoDaRevisao(detalhe);
        if (atual) setCatalogo({ estado: 'pronta', dados });
      } catch { if (atual) setCatalogo({ estado: 'erro', dados: null }); }
    })();
    return () => { atual = false; };
  }, [isFounder, repositorioConfig, cicloConfig]);

  const listaCards = cards.dados ?? [];
  const esperando = listaCards.filter(card => ESTADOS_FUNDADOR.has(card.estado));
  const emCurso = listaCards.filter(card => ESTADOS_EM_CURSO.has(card.estado));
  const listaPedidos = pedidos.dados ?? [];
  const pedidosEmPreparo = listaPedidos.filter(pedido => pedido.estado !== 'CARD_CRIADO');
  const resumo = (valor: number, fonte: Fonte<unknown>) => fonte.estado === 'pronta' ? String(valor) : '—';
  const painel = 'rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6';
  const link = 'inline-flex min-h-11 items-center gap-2 font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-400';

  return <div className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-8 sm:py-9">
    <header className="grid gap-5 rounded-3xl border border-emerald-800/20 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 p-6 text-white shadow-lg sm:grid-cols-[minmax(0,1.5fr)_minmax(240px,0.8fr)] sm:p-9">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Sistema Helena · central executiva</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Visão geral</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-emerald-50/90">Acompanhe o que entrou, o que está em andamento e onde sua atenção é necessária.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link to="/cards" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-950">Abrir quadro de cards <ArrowRight size={16}/></Link>
          {isFounder && <Link to="/cards" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/50 px-4 py-2 text-sm font-semibold text-white">Fazer um pedido <ArrowRight size={16}/></Link>}</div>
      </div>
      <aside className="rounded-2xl border border-white/20 bg-white/10 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">Próximo passo</p>
        {cards.estado === 'pronta' ? esperando.length > 0 ? <><p className="mt-3 text-lg font-semibold">{esperando.length} {esperando.length === 1 ? 'card aguarda' : 'cards aguardam'} sua atenção</p><Link className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline" to={`/cards?card=${encodeURIComponent(esperando[0].id)}`}>Ver primeiro card <ArrowRight size={16}/></Link></>
          : <><p className="mt-3 text-lg font-semibold">Nenhum dos cards consultados sinaliza espera</p><p className="mt-2 text-sm text-emerald-50/80">Veja o quadro para conferir etapas, ações e novas entregas.</p></>
          : <p className="mt-3 text-sm">{cards.estado === 'erro' ? 'Não foi possível consultar as decisões agora.' : 'Consultando decisões…'}</p>}
      </aside>
    </header>

    <section aria-label="Resumo da operação" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { titulo: 'Cards consultados', valor: resumo(listaCards.length, cards), detalhe: 'Até 200 cards visíveis', icone: Layers3 },
        { titulo: 'Em curso', valor: resumo(emCurso.length, cards), detalhe: 'Inclui preparação e esperas', icone: BriefcaseBusiness },
        { titulo: 'Aguardando atenção', valor: resumo(esperando.length, cards), detalhe: 'Estado atual do card', icone: Users },
        ...(isFounder ? [{ titulo: 'Pedidos em preparo', valor: resumo(pedidosEmPreparo.length, pedidos), detalhe: 'Até 50 pedidos recentes', icone: ClipboardList }] : []),
      ].map(item => <article key={item.titulo} className={painel}><item.icone size={19} className="text-emerald-700 dark:text-emerald-400" aria-hidden="true"/><h2 className="mt-3 text-sm font-medium text-muted-foreground">{item.titulo}</h2><p className="mt-1 text-3xl font-semibold tabular-nums">{item.valor}</p><p className="mt-1 text-xs text-muted-foreground">{item.detalhe}</p></article>)}
    </section>

    <section aria-labelledby="atencao-titulo" className={painel}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Acompanhar e decidir</p><h2 id="atencao-titulo" className="mt-1 text-xl font-semibold">Sua atenção</h2></div><button type="button" onClick={() => setCicloCards(n => n + 1)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline"><RefreshCw size={15}/>Atualizar cards</button></div>
      {cards.estado === 'carregando' && <p role="status" className="mt-4 text-sm text-muted-foreground">Consultando cards…</p>}
      {cards.estado === 'erro' && <p role="alert" className="mt-4 text-sm text-destructive">Não foi possível consultar os cards. Tente atualizar.</p>}
      {cards.estado === 'pronta' && (esperando.length ? <ul className="mt-4 divide-y divide-border">{esperando.slice(0, 5).map(card => <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{card.titulo}</p><p className="mt-1 text-sm text-muted-foreground">{card.empresa || 'Empresa não informada'} · {rotuloEstado(card.estado)}</p></div><Link to={`/cards?card=${encodeURIComponent(card.id)}`} className={link}>{acaoDoCard(card)} <ArrowRight size={15}/></Link></li>)}</ul>
        : <p className="mt-4 text-sm text-muted-foreground">Nenhum dos cards consultados sinaliza espera no estado do card. Etapas e ações têm estados próprios no quadro.</p>)}
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="cards-recentes-titulo" className={painel}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Trabalho em andamento</p><h2 id="cards-recentes-titulo" className="mt-1 text-xl font-semibold">Cards recentes</h2></div><Link to="/cards" className={link}>Ver quadro <ArrowRight size={15}/></Link></div>
        {cards.estado === 'carregando' && <p className="mt-4 text-sm text-muted-foreground">Consultando cards…</p>}
        {cards.estado === 'erro' && <p role="alert" className="mt-4 text-sm text-destructive">Cards indisponíveis no momento.</p>}
        {cards.estado === 'pronta' && (listaCards.length ? <ul className="mt-4 divide-y divide-border">{listaCards.slice(0, 5).map(card => <li key={card.id} className="py-3"><Link className={link} to={`/cards?card=${encodeURIComponent(card.id)}`}>{card.titulo} <ArrowRight size={15}/></Link><p className="text-sm text-muted-foreground">{rotuloEstado(card.estado)} · {card.empresa || 'Empresa não informada'}</p></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">Nenhum card disponível.</p>)}
      </section>
      {isFounder && <section aria-labelledby="pedidos-recentes-titulo" className={painel}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Da ideia ao plano</p><h2 id="pedidos-recentes-titulo" className="mt-1 text-xl font-semibold">Pedidos recentes</h2></div><button type="button" onClick={() => setCicloPedidos(n => n + 1)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline"><RefreshCw size={15}/>Atualizar</button></div>
        {pedidos.estado === 'carregando' && <p role="status" className="mt-4 text-sm text-muted-foreground">Consultando pedidos…</p>}
        {pedidos.estado === 'erro' && <p role="alert" className="mt-4 text-sm text-destructive">Não foi possível consultar pedidos. Tente atualizar.</p>}
        {pedidos.estado === 'pronta' && (listaPedidos.length ? <ul className="mt-4 divide-y divide-border">{listaPedidos.slice(0, 5).map(pedido => <li key={pedido.pedido_id} className="py-3"><p className="line-clamp-2 font-semibold">{pedido.titulo_confirmado || pedido.texto_inicial}</p><p className="mt-1 text-sm text-muted-foreground">{descricaoDoPedido(pedido)}</p>{pedido.card_id ? <Link to={`/cards?card=${encodeURIComponent(pedido.card_id)}`} className={link}>Abrir card <ArrowRight size={15}/></Link> : <Link to={`/cards?pedido=${encodeURIComponent(pedido.request_id)}`} className={link}>Abrir acompanhamento <ArrowRight size={15}/></Link>}</li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">Nenhum pedido recente.</p>)}
        <p className="mt-3 text-xs text-muted-foreground">Mostra até 50 pedidos recentes. O recebimento não comprova execução.</p>
      </section>}
    </div>

    {isFounder && <section aria-labelledby="config-painel-titulo" className={painel}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Organização cadastrada</p><h2 id="config-painel-titulo" className="mt-1 text-xl font-semibold">Empresas e agentes</h2></div><div className="flex items-center gap-3"><button type="button" onClick={() => setCicloConfig(n => n + 1)} className="min-h-11 text-sm font-semibold underline">Atualizar</button><Link to="/configuracoes" className={link}><Settings2 size={15}/>Ver configuração</Link></div></div>
      {catalogo.estado === 'carregando' && <p role="status" className="mt-4 text-sm text-muted-foreground">Consultando revisão ativa…</p>}
      {catalogo.estado === 'erro' && <p role="alert" className="mt-4 text-sm text-destructive">Não foi possível ler empresas e agentes da revisão ativa. Consulte a configuração.</p>}
      {catalogo.dados && <><p className="mt-3 text-sm text-muted-foreground">Revisão ativa: {catalogo.dados.revisao}. Estes são cadastros e estados previstos na configuração; não comprovam operação em andamento.</p><div className="mt-4 grid gap-5 md:grid-cols-2"><div><h3 className="font-semibold">Empresas ({catalogo.dados.empresas.length})</h3><ul className="mt-2 space-y-2">{catalogo.dados.empresas.map(empresa => <li key={empresa.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"><span>{empresa.nome}</span><span className="text-muted-foreground">Pacote: {rotuloEstado(empresa.estado)}</span></li>)}</ul></div><div><h3 className="font-semibold">Agentes cadastrados ({catalogo.dados.agentes.length})</h3><ul className="mt-2 grid gap-2 sm:grid-cols-2">{catalogo.dados.agentes.slice(0, 6).map(agente => <li key={agente.id} className="rounded-lg border border-border px-3 py-2 text-sm">{agente.nome}<span className="block text-xs text-muted-foreground">Configuração: {rotuloEstado(agente.estado)}</span></li>)}</ul>{catalogo.dados.agentes.length > 6 && <p className="mt-2 text-xs text-muted-foreground">Veja os demais na configuração ativa.</p>}</div></div></>}
    </section>}
    <p className="text-xs text-muted-foreground">Resumo de até 200 cards retornados pela consulta e até 50 pedidos recentes. Os números descrevem apenas esta amostra visível, não o total da operação.</p>
  </div>;
}

export default function PainelV2Page(props: Props) {
  const { user, isFounder } = useAuth();
  if (!isFounder) return <section className="mx-auto mt-8 max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Sistema Helena · central executiva</p>
    <h1 className="mt-3 text-3xl font-semibold">Visão geral</h1>
    <p className="mt-3 text-muted-foreground">O acompanhamento de cards, pedidos e configuração está reservado à conta do fundador.</p>
  </section>;
  return <Painel key={`${user?.id ?? 'anon'}:${isFounder ? 'fundador' : 'membro'}`} {...props}/>;
}
