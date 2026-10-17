/**
 * O que é: funções puras que transformam o contrato `DadosComando` (esquema helena_v2) nos números da aba "Visão geral"
 * da Sala de comando v2: contagem por estado e por empresa, etapas por agente, série diária, prioridades e atrasados.
 * Como mudar: mantenha tudo puro (sem rede, sem relógio escondido: o "agora" vem sempre por parâmetro) e atualize os testes
 * ao lado. Datas sempre no fuso America/Sao_Paulo. Não depende de nenhum outro pedaço da Sala de comando.
 * Premissas conferidas no repositório: entrega aprovada = portao1 'PASSOU'; etapa final = APROVADA/PRONTA/CANCELADA/encerrada com falha.
 */
import {
  ESTADOS_ESPERA_FUNDADOR, ESTADOS_FINAIS,
  type CardComando, type CatalogoComando, type DadosComando, type EntregaResumo, type EstadoLeitura, type EtapaComando,
} from './tipos';
import type { PedidoEntrada } from '@/integrations/pedidos-v2/repository';

export const GRUPO = 'GRUPO';
export const FUSO = 'America/Sao_Paulo';
export const SEM_EMPRESA = 'SEM-EMPRESA';

/** Rótulos simples dos estados de card. */
export const ROTULO_ESTADO: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  ESPERANDO_CONFIRMACAO: 'Esperando confirmação',
  VALIDANDO_PLANO: 'Validando o plano',
  ESPERANDO_FUNDADOR: 'Esperando você',
  EM_ANDAMENTO: 'Em andamento',
  PRONTO: 'Pronto',
  CANCELADO: 'Cancelado',
  ENCERRADO_COM_FALHA: 'Encerrado com falha',
};

/** Cor de cada estado, só com tokens do tema (nunca hex). */
export const COR_ESTADO: Record<string, string> = {
  RASCUNHO: 'hsl(var(--muted-foreground) / 0.45)',
  ESPERANDO_CONFIRMACAO: 'hsl(var(--warning) / 0.65)',
  VALIDANDO_PLANO: 'hsl(var(--foreground) / 0.45)',
  ESPERANDO_FUNDADOR: 'hsl(var(--warning))',
  EM_ANDAMENTO: 'hsl(var(--primary))',
  PRONTO: 'hsl(var(--success) / 0.55)',
  CANCELADO: 'hsl(var(--border))',
  ENCERRADO_COM_FALHA: 'hsl(var(--destructive))',
};
const COR_ESTADO_DESCONHECIDO = 'hsl(var(--muted-foreground) / 0.3)';
const ORDEM_ESTADOS = Object.keys(ROTULO_ESTADO);

/** Colunas do quadro de cards (mesmas do Kanban), para o processo compacto. */
export const COLUNAS_PROCESSO = [
  { id: 'preparacao', titulo: 'Preparação', estados: ['RASCUNHO', 'ESPERANDO_CONFIRMACAO', 'VALIDANDO_PLANO'] },
  { id: 'fundador', titulo: 'Aguardando você', estados: ['ESPERANDO_FUNDADOR'] },
  { id: 'trabalho', titulo: 'Em trabalho', estados: ['EM_ANDAMENTO'] },
  { id: 'pronto', titulo: 'Pronto', estados: ['PRONTO'] },
  { id: 'encerrado', titulo: 'Encerrado', estados: ['CANCELADO', 'ENCERRADO_COM_FALHA'] },
] as const;

const ETAPAS_FINAIS = ['APROVADA', 'PRONTA', 'CANCELADA', 'CANCELADO', 'ENCERRADA_COM_FALHA', 'ENCERRADO_COM_FALHA'];
const DIA_MS = 24 * 60 * 60 * 1000;

export const ehEstadoFinal = (estado: string) => (ESTADOS_FINAIS as readonly string[]).includes(estado);
export const ehEspera = (estado: string) => (ESTADOS_ESPERA_FUNDADOR as readonly string[]).includes(estado);
export const ehAberto = (card: Pick<CardComando, 'estado'>) => !ehEstadoFinal(card.estado);

function tempo(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const t = Date.parse(valor);
  return Number.isFinite(t) ? t : null;
}

/** Filtro de empresa: GRUPO = tudo; senão card.empresa === empresa. */
export function cardsDaEmpresa(cards: CardComando[], empresa: string): CardComando[] {
  return empresa === GRUPO ? cards : cards.filter(c => c.empresa === empresa);
}

/** Recorte de todo o conjunto de dados por empresa (etapas/entregas pelos cards; pedidos pela empresa ou pelo card). */
export function recortarPorEmpresa(dados: Pick<DadosComando, 'cards' | 'etapas' | 'entregas' | 'pedidos'>, empresa: string) {
  if (empresa === GRUPO) return { cards: dados.cards, etapas: dados.etapas, entregas: dados.entregas, pedidos: dados.pedidos };
  const cards = cardsDaEmpresa(dados.cards, empresa);
  const ids = new Set(cards.map(c => c.id));
  return {
    cards,
    etapas: dados.etapas.filter(e => ids.has(e.card_id)),
    entregas: dados.entregas.filter(e => ids.has(e.card_id)),
    pedidos: dados.pedidos.filter(p => p.empresa_id === empresa || (p.card_id != null && ids.has(p.card_id))),
  };
}

/** Data do prazo. Prazo só com dia (AAAA-MM-DD) vale até o fim daquele dia em São Paulo. */
export function instantePrazo(card: Pick<CardComando, 'prazo' | 'prazo_ate'>): number | null {
  const bruto = card.prazo_ate ?? card.prazo;
  if (!bruto) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return tempo(`${bruto}T23:59:59-03:00`);
  return tempo(bruto);
}

/** Cards abertos (não finais) com prazo anterior a `agora`. */
export function atrasados(cards: CardComando[], agora: Date): CardComando[] {
  const t = agora.getTime();
  return cards.filter(c => {
    const prazo = instantePrazo(c);
    return ehAberto(c) && prazo !== null && prazo < t;
  });
}

export type FatiaEstado = { estado: string; rotulo: string; quantidade: number; cor: string };

/** Quantidade de cards por estado, na ordem do fluxo; estados fora da lista aparecem ao final com o próprio código. */
export function porEstado(cards: CardComando[]): FatiaEstado[] {
  const contagem = new Map<string, number>();
  for (const c of cards) contagem.set(c.estado, (contagem.get(c.estado) ?? 0) + 1);
  const conhecidos = ORDEM_ESTADOS.filter(e => contagem.has(e));
  const outros = [...contagem.keys()].filter(e => !ORDEM_ESTADOS.includes(e)).sort();
  return [...conhecidos, ...outros].map(estado => ({
    estado, rotulo: ROTULO_ESTADO[estado] ?? estado, quantidade: contagem.get(estado) ?? 0,
    cor: COR_ESTADO[estado] ?? COR_ESTADO_DESCONHECIDO,
  }));
}

export type LinhaEmpresa = {
  id: string; nome: string;
  /** Todos os cards não finais da empresa (inclui os que esperam você). */
  abertos: number;
  /** Subconjunto dos abertos que espera uma decisão sua. */
  esperando: number;
  /** abertos - esperando (para o gráfico empilhado não contar duas vezes). */
  outrosAbertos: number;
  prontos: number;
  /** Entregas que passaram no portão 1 (aprovadas). */
  entregas: number;
};

/** Uma linha por empresa do catálogo (mesmo sem cards) mais as que só aparecem nos cards. Respeita o filtro. */
export function porEmpresa(
  cards: CardComando[], entregas: EntregaResumo[], catalogo: Pick<CatalogoComando, 'empresas'>, empresa: string = GRUPO,
): LinhaEmpresa[] {
  const nomes = new Map<string, string>(catalogo.empresas.map(e => [e.id, e.nome]));
  const ordem = catalogo.empresas.map(e => e.id);
  const linhas = new Map<string, LinhaEmpresa>();
  const garantir = (id: string) => {
    let l = linhas.get(id);
    if (!l) {
      l = { id, nome: nomes.get(id) ?? (id === SEM_EMPRESA ? 'Sem empresa' : id), abertos: 0, esperando: 0, outrosAbertos: 0, prontos: 0, entregas: 0 };
      linhas.set(id, l);
    }
    return l;
  };
  if (empresa === GRUPO) ordem.forEach(garantir); else garantir(empresa);
  const dono = new Map<string, string>();
  for (const c of cards) {
    const id = c.empresa || SEM_EMPRESA;
    dono.set(c.id, id);
    if (empresa !== GRUPO && id !== empresa) continue;
    const l = garantir(id);
    if (c.estado === 'PRONTO') l.prontos += 1;
    if (ehAberto(c)) {
      l.abertos += 1;
      if (ehEspera(c.estado)) l.esperando += 1;
    }
  }
  for (const e of entregas) {
    const id = dono.get(e.card_id);
    if (!id || e.portao1 !== 'PASSOU') continue;
    if (empresa !== GRUPO && id !== empresa) continue;
    garantir(id).entregas += 1;
  }
  const lista = [...linhas.values()];
  lista.forEach(l => { l.outrosAbertos = l.abertos - l.esperando; });
  const posicao = (id: string) => { const i = ordem.indexOf(id); return i < 0 ? ordem.length : i; };
  return lista.sort((a, b) => posicao(a.id) - posicao(b.id) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export type LinhaAgente = { chave: string; nome: string; etapas: number; naoCadastrado: boolean };

/** Etapas abertas por agente. `etapa.autor` casa com `agentes[].identidade` (sem diferenciar maiúsculas); sem casar, vale o texto. */
export function etapasPorAgente(
  etapas: EtapaComando[], catalogo: Pick<CatalogoComando, 'agentes'>, cards?: Pick<CardComando, 'id' | 'estado'>[],
): LinhaAgente[] {
  const porIdentidade = new Map(catalogo.agentes.map(a => [a.identidade.trim().toUpperCase(), a]));
  const estadoCard = cards ? new Map(cards.map(c => [c.id, c.estado])) : null;
  const contagem = new Map<string, LinhaAgente>();
  for (const e of etapas) {
    if (ETAPAS_FINAIS.includes(e.estado)) continue;
    const doCard = estadoCard?.get(e.card_id);
    if (doCard !== undefined && ehEstadoFinal(doCard)) continue; // etapa solta de card já encerrado
    const texto = (e.autor ?? '').trim();
    const agente = porIdentidade.get(texto.toUpperCase());
    const chave = agente ? agente.id : (texto || 'SEM-AUTOR').toUpperCase();
    const linha = contagem.get(chave) ?? {
      chave, nome: agente ? agente.nome : (texto || 'Sem autor'), etapas: 0, naoCadastrado: !agente,
    };
    linha.etapas += 1;
    contagem.set(chave, linha);
  }
  return [...contagem.values()].sort((a, b) => b.etapas - a.etapas || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Dia civil (AAAA-MM-DD) de um instante, em São Paulo. */
export function diaSaoPaulo(valor: Date | string | number): string | null {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export type PontoDia = { dia: string; rotulo: string; cards: number; pedidos: number; entregas: number };

/** Últimos `dias` dias (o último é hoje em São Paulo): cards criados, pedidos recebidos e entregas aprovadas por dia. */
export function serieDiaria(
  dados: { cards: Pick<CardComando, 'criado_em'>[]; pedidos: Pick<PedidoEntrada, 'criado_em'>[]; entregas: EntregaResumo[] },
  agora: Date, dias = 14,
): PontoDia[] {
  const hoje = diaSaoPaulo(agora);
  if (!hoje) return [];
  const [a, m, d] = hoje.split('-').map(Number);
  const pontos: PontoDia[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(a, m - 1, d - i));
    const dia = dt.toISOString().slice(0, 10);
    pontos.push({ dia, rotulo: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`, cards: 0, pedidos: 0, entregas: 0 });
  }
  const indice = new Map(pontos.map((p, i) => [p.dia, i]));
  const somar = (valor: string, campo: 'cards' | 'pedidos' | 'entregas') => {
    const dia = diaSaoPaulo(valor);
    const i = dia ? indice.get(dia) : undefined;
    if (i !== undefined) pontos[i][campo] += 1;
  };
  dados.cards.forEach(c => somar(c.criado_em, 'cards'));
  dados.pedidos.forEach(p => somar(p.criado_em, 'pedidos'));
  dados.entregas.filter(e => e.portao1 === 'PASSOU').forEach(e => somar(e.criada_em, 'entregas'));
  return pontos;
}

/** Cards que passaram a PRONTO nos últimos `dias` dias. Usa atualizado_em (momento da última mudança) e, sem ele, criado_em. */
export function prontosRecentes(cards: CardComando[], agora: Date, dias = 7): number {
  const limite = agora.getTime() - dias * DIA_MS;
  return cards.filter(c => {
    const t = tempo(c.atualizado_em) ?? tempo(c.criado_em);
    return c.estado === 'PRONTO' && t !== null && t >= limite && t <= agora.getTime() + DIA_MS;
  }).length;
}

export type GrupoPrioridade = 'decidir' | 'atrasado' | 'falha';
export type Prioridade = {
  card: CardComando; grupo: GrupoPrioridade; atrasado: boolean;
  /** Motivo em português simples. */
  motivo: string;
  /** Desde quando o card está nesse ponto (atualizado_em, senão criado_em). */
  desde: string | null;
  /** "há 3 dias", "há 2 horas"… */
  haQuanto: string;
};

const MOTIVOS: Record<string, string> = {
  HELENA_FALHOU: 'A Helena não conseguiu ler o pedido. Confira você mesmo.',
  PLANO_INVALIDO: 'O plano não passou na checagem e precisa ser refeito ou cancelado.',
  VALIDADOR_FALHOU: 'A checagem do plano falhou. Tente de novo.',
  DEPENDENCIA: 'Depende de algo que ainda não ficou pronto.',
  NAO_PODE: 'O pedido bate em algo que o sistema não pode fazer.',
};
const MOTIVO_PADRAO: Record<GrupoPrioridade, string> = {
  decidir: 'Espera uma decisão sua.',
  atrasado: 'O prazo já passou e o card ainda não terminou.',
  falha: 'Terminou com falha. Veja o que aconteceu.',
};

export function motivoEmPortugues(motivo: string | undefined | null, grupo: GrupoPrioridade): string {
  const chave = (motivo ?? '').trim().toUpperCase();
  return MOTIVOS[chave] ?? MOTIVO_PADRAO[grupo];
}

/** "há 3 dias", "há 2 horas", "há 5 minutos" ou "agora há pouco". */
export function haQuantoTempo(valor: string | null | undefined, agora: Date): string {
  const t = tempo(valor);
  if (t === null) return 'sem data';
  const ms = agora.getTime() - t;
  if (ms < 60_000) return 'agora há pouco';
  const un = (n: number, s: string, p: string) => `há ${n} ${n === 1 ? s : p}`;
  if (ms < 3_600_000) return un(Math.floor(ms / 60_000), 'minuto', 'minutos');
  if (ms < DIA_MS) return un(Math.floor(ms / 3_600_000), 'hora', 'horas');
  return un(Math.floor(ms / DIA_MS), 'dia', 'dias');
}

const PESO_GRUPO: Record<GrupoPrioridade, number> = { decidir: 0, atrasado: 1, falha: 2 };

/**
 * Lista "O que decidir agora": 1) esperando você (ESPERANDO_FUNDADOR/ESPERANDO_CONFIRMACAO), 2) prazo vencido,
 * 3) encerrados com falha. Dentro de cada grupo, o que espera há mais tempo vem primeiro. Cada card aparece uma vez.
 */
export function prioridades(cards: CardComando[], agora: Date): Prioridade[] {
  const vencidos = new Set(atrasados(cards, agora).map(c => c.id));
  const itens: Prioridade[] = [];
  for (const card of cards) {
    const grupo: GrupoPrioridade | null = ehEspera(card.estado) ? 'decidir'
      : vencidos.has(card.id) ? 'atrasado'
        : card.estado === 'ENCERRADO_COM_FALHA' ? 'falha' : null;
    if (!grupo) continue;
    const desde = card.atualizado_em ?? card.criado_em ?? null;
    itens.push({
      card, grupo, atrasado: vencidos.has(card.id), motivo: motivoEmPortugues(card.motivo, grupo),
      desde, haQuanto: haQuantoTempo(desde, agora),
    });
  }
  const chave = (p: Prioridade) => (p.grupo === 'atrasado' ? instantePrazo(p.card) : tempo(p.desde)) ?? Number.MAX_SAFE_INTEGER;
  return itens.sort((a, b) => PESO_GRUPO[a.grupo] - PESO_GRUPO[b.grupo] || chave(a) - chave(b) || a.card.id.localeCompare(b.card.id));
}

/** Contagem por coluna do quadro. */
export function contagemPorColuna(cards: CardComando[]) {
  return COLUNAS_PROCESSO.map(col => ({
    id: col.id, titulo: col.titulo,
    quantidade: cards.filter(c => (col.estados as readonly string[]).includes(c.estado)).length,
  }));
}

/** "Bom dia" (5h às 11h59), "Boa tarde" (12h às 17h59) ou "Boa noite", pela hora de São Paulo. */
export function saudacaoPorHora(agora: Date): string {
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', hourCycle: 'h23' }).format(agora));
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "17/10" no fuso de São Paulo; texto vazio se a data for inválida. */
export function dataCurtaSP(valor: string | null | undefined): string {
  const t = tempo(valor);
  if (t === null) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' }).format(new Date(t));
}

export type Kpis = { abertos: number; esperando: number; atrasados: number; prontos7d: number };
export function kpis(cards: CardComando[], agora: Date): Kpis {
  return {
    abertos: cards.filter(ehAberto).length,
    esperando: cards.filter(c => ehEspera(c.estado)).length,
    atrasados: atrasados(cards, agora).length,
    prontos7d: prontosRecentes(cards, agora, 7),
  };
}

/** Âncora da lista "O que decidir agora" (a saudação rola até ela). */
export const ID_PRIORIDADES = 'prioridades-comando';

/** Estilo dos gráficos, só com tokens do tema. */
export const ESTILO_TOOLTIP = {
  background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8,
  color: 'hsl(var(--card-foreground))', fontSize: 12,
};
export const TIQUE_EIXO = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };

/** Primeiro nome (do cadastro) ou a parte do e-mail antes do @; vazio se não houver nada. */
export function nomeDeExibicao(user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null): string {
  const meta = user?.user_metadata ?? {};
  const bruto = [meta.full_name, meta.name, meta.nome].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  if (bruto) return bruto.trim().split(/\s+/)[0];
  return (user?.email ?? '').split('@')[0].trim();
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A frase das boas-vindas: quantos cards esperam o fundador e quantos estão atrasados. */
export function fraseBoasVindas(estado: EstadoLeitura, esperando: number, atrasados: number, amostra: boolean): string {
  if (estado === 'erro') return 'Não consegui ler os cards agora, então não sei dizer o que espera você.';
  if (estado === 'carregando') return 'Estou lendo os cards…';
  const nota = amostra ? ' (na amostra lida, não no total)' : '';
  if (esperando === 0 && atrasados === 0) return `Nada espera você agora e nenhum card está atrasado${nota}.`;
  const a = esperando === 0 ? 'Nenhum card espera você' : `${plural(esperando, 'card espera', 'cards esperam')} você`;
  const b = atrasados === 0 ? 'nenhum está atrasado' : plural(atrasados, 'está atrasado', 'estão atrasados');
  return `${a} e ${b}${nota}.`;
}
