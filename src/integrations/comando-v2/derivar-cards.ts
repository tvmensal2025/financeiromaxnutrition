/**
 * O que é: funções puras (sem React, sem banco) que as abas Cards, Processo e Acompanhamento da Sala de comando v2 usam
 * para filtrar, ordenar, rotular estados em português e calcular prazos. Lê só o contrato `DadosComando` (esquema helena_v2).
 * Como mudar: acrescente funções novas aqui e teste em derivar-cards.test.ts; nunca importe a v1 nem o cliente do banco.
 * Datas: sempre no fuso America/Sao_Paulo. "Agora" vem de `dados.agora`, nunca de `new Date()` dentro destas funções.
 */
import {
  ESTADOS_ESPERA_FUNDADOR, ESTADOS_FINAIS,
  type CardComando, type CatalogoComando, type DadosComando, type EstadoLeitura, type EtapaComando,
} from './tipos';
import type { PedidoEntrada } from '@/integrations/pedidos-v2/repository';

export const FUSO = 'America/Sao_Paulo';
export const EMPRESA_GRUPO = 'GRUPO';
/** Uma etapa em execução/revisão sem sinal de vida há mais que isto é destacada como parada. */
export const LIMITE_PARADA_MS = 60 * 60 * 1000;

export type VarianteEstado = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
export type FiltroCards = 'todos' | 'precisa' | 'vencido' | 'andamento' | 'prontos';
export type OrdemCards = 'prioridade' | 'prazo' | 'recentes';

/** Colunas do quadro de Processo, na ordem do ciclo de vida de uma etapa. */
export const ESTADOS_ETAPA_PROCESSO = [
  'AGUARDANDO_ANTERIORES', 'NA_FILA', 'EXECUTANDO', 'VALIDACAO', 'REVISAO', 'ESPERANDO_FUNDADOR', 'EM_RESOLUCAO', 'APROVADA', 'PRONTA',
] as const;
export const ESTADOS_ETAPA_FINAIS = ['PRONTA', 'CANCELADA', 'ENCERRADA_COM_FALHA'] as const;

const ROTULOS_CARD: Record<string, string> = {
  RASCUNHO: 'Rascunho', ESPERANDO_CONFIRMACAO: 'Esperando sua confirmação', VALIDANDO_PLANO: 'Validando o plano',
  EM_ANDAMENTO: 'Em andamento', ESPERANDO_FUNDADOR: 'Esperando você', PRONTO: 'Pronto',
  CANCELADO: 'Cancelado', ENCERRADO_COM_FALHA: 'Encerrado com falha',
};
const ROTULOS_ETAPA: Record<string, string> = {
  AGUARDANDO_ANTERIORES: 'Aguardando etapas anteriores', NA_FILA: 'Na fila', EXECUTANDO: 'Em execução',
  VALIDACAO: 'Em validação', REVISAO: 'Em revisão', ESPERANDO_FUNDADOR: 'Esperando você', EM_RESOLUCAO: 'Em resolução',
  APROVADA: 'Aprovada', PRONTA: 'Pronta', CANCELADA: 'Cancelada', ENCERRADA_COM_FALHA: 'Encerrada com falha',
};
const ROTULOS_MOTIVO: Record<string, string> = {
  HELENA_FALHOU: 'A Helena não conseguiu montar o plano.',
  PLANO_INVALIDO: 'O plano não passou na validação.',
  VALIDADOR_FALHOU: 'A validação do plano falhou.',
  DEPENDENCIA: 'Uma etapa da qual esta depende falhou.',
  NAO_PODE: 'Uma peça foi julgada como proibida e não pode seguir.',
  PERGUNTA: 'Há uma pergunta esperando a sua resposta.',
  REVISAO: 'A revisão pediu a sua decisão.',
  RESOLUCAO: 'A etapa está sendo resolvida de outro jeito.',
  INFRA: 'Problema técnico no ambiente; a etapa será retomada.',
  CAPACIDADE: 'Sem capacidade agora (cota, login ou agente pausado).',
  PRAZO_INVALIDO: 'O prazo informado não era válido.',
  FALHOU: 'A execução falhou.',
};

const textoOuNulo = (valor: unknown): string | null => (typeof valor === 'string' && valor.trim() ? valor.trim() : null);
const semRotulo = (estado: string) => estado.replace(/_/g, ' ').toLowerCase().replace(/^./, letra => letra.toUpperCase());

export function rotuloEstadoCard(estado: string): string { return ROTULOS_CARD[estado] ?? semRotulo(estado); }
export function rotuloEstadoEtapa(estado: string): string { return ROTULOS_ETAPA[estado] ?? semRotulo(estado); }
/** Motivo em linguagem simples; `null` quando não há nada a dizer (NENHUM, NORMAL ou vazio). */
export function rotuloMotivo(motivo: string | null | undefined): string | null {
  const valor = textoOuNulo(motivo);
  if (!valor || valor === 'NENHUM' || valor === 'NORMAL') return null;
  return ROTULOS_MOTIVO[valor] ?? semRotulo(valor);
}

export function varianteEstado(estado: string): VarianteEstado {
  if (['ESPERANDO_FUNDADOR', 'ESPERANDO_CONFIRMACAO', 'EM_RESOLUCAO'].includes(estado)) return 'warning';
  if (['EM_ANDAMENTO', 'EXECUTANDO', 'REVISAO'].includes(estado)) return 'info';
  if (['VALIDANDO_PLANO', 'VALIDACAO'].includes(estado)) return 'purple';
  if (['PRONTO', 'PRONTA', 'APROVADA'].includes(estado)) return 'success';
  if (estado === 'ENCERRADO_COM_FALHA' || estado === 'ENCERRADA_COM_FALHA') return 'danger';
  return 'neutral';
}

// ---------- datas ----------

export function lerData(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** "17/10/2026 09:30", no fuso de São Paulo. */
export function formatarDataHora(valor: string | null | undefined): string {
  const data = lerData(valor);
  if (!data) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(data);
}

const plural = (n: number, singular: string, pluralTxt: string) => (n === 1 ? singular : pluralTxt);
function duracaoCurta(ms: number): string {
  const minutos = Math.max(1, Math.round(Math.abs(ms) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return `${dias} ${plural(dias, 'dia', 'dias')}`;
}

/** "vence em 2 dias" / "venceu há 3 h" / "Sem prazo". */
export function prazoRelativo(prazo: string | null | undefined, agora: Date): string {
  const data = lerData(prazo);
  if (!data) return 'Sem prazo';
  const diferenca = data.getTime() - agora.getTime();
  return diferenca >= 0 ? `vence em ${duracaoCurta(diferenca)}` : `venceu há ${duracaoCurta(diferenca)}`;
}

/** "há 3 h" (para o que está parado desde `desde`). */
export function haQuanto(desde: string | null | undefined, agora: Date): string {
  const data = lerData(desde);
  if (!data) return 'sem registro de hora';
  return `há ${duracaoCurta(agora.getTime() - data.getTime())}`;
}

// ---------- empresa ----------

export function nomeEmpresa(catalogo: CatalogoComando, codigo: string | null | undefined): string {
  if (!codigo) return 'Sem empresa';
  return catalogo.empresas.find(e => e.id === codigo)?.nome ?? codigo;
}

export function cardsDaEmpresa(cards: CardComando[], empresa: string): CardComando[] {
  return empresa === EMPRESA_GRUPO ? cards : cards.filter(card => card.empresa === empresa);
}

/** Etapas dos cards da empresa. Em GRUPO devolve tudo, inclusive etapas cujo card não veio na amostra. */
export function etapasDaEmpresa(etapas: EtapaComando[], cards: CardComando[], empresa: string): EtapaComando[] {
  if (empresa === EMPRESA_GRUPO) return etapas;
  const ids = new Set(cards.filter(card => card.empresa === empresa).map(card => card.id));
  return etapas.filter(etapa => ids.has(etapa.card_id));
}

export function pedidosDaEmpresa(pedidos: PedidoEntrada[], empresa: string): PedidoEntrada[] {
  return empresa === EMPRESA_GRUPO ? pedidos : pedidos.filter(pedido => pedido.empresa_id === empresa);
}

/** Pedidos que ainda não viraram card (RECEBIDO ou PLANO_CONFIRMADO, sem card_id), mais antigos primeiro. */
export function pedidosSemCard(pedidos: PedidoEntrada[]): PedidoEntrada[] {
  return pedidos
    .filter(pedido => (pedido.estado === 'RECEBIDO' || pedido.estado === 'PLANO_CONFIRMADO') && !pedido.card_id)
    .sort((a, b) => (lerData(a.criado_em)?.getTime() ?? 0) - (lerData(b.criado_em)?.getTime() ?? 0));
}

/** Título curto do pedido para listas e rótulos de acessibilidade: título confirmado ou o início do texto, em até 120 caracteres. */
export const LIMITE_TITULO_PEDIDO = 120;
export function tituloDoPedido(pedido: Pick<PedidoEntrada, 'titulo_confirmado' | 'texto_inicial'>): string {
  const texto = (textoOuNulo(pedido.titulo_confirmado) ?? pedido.texto_inicial ?? '').replace(/\s+/g, ' ').trim();
  if (!texto) return 'Pedido sem texto';
  return texto.length > LIMITE_TITULO_PEDIDO ? `${texto.slice(0, LIMITE_TITULO_PEDIDO - 3)}...` : texto;
}

// ---------- cards ----------

export const prazoDoCard = (card: CardComando): string | null => textoOuNulo(card.prazo_ate) ?? textoOuNulo(card.prazo);
export const cardEhFinal = (card: CardComando): boolean => (ESTADOS_FINAIS as readonly string[]).includes(card.estado);
export const cardPrecisaDeVoce = (card: CardComando): boolean => (ESTADOS_ESPERA_FUNDADOR as readonly string[]).includes(card.estado);
export function cardPrazoVencido(card: CardComando, agora: Date): boolean {
  const prazo = lerData(prazoDoCard(card));
  return !!prazo && !cardEhFinal(card) && prazo.getTime() < agora.getTime();
}

export function cardCombinaComFiltro(card: CardComando, filtro: FiltroCards, agora: Date): boolean {
  switch (filtro) {
    case 'precisa': return cardPrecisaDeVoce(card);
    case 'vencido': return cardPrazoVencido(card, agora);
    case 'andamento': return card.estado === 'EM_ANDAMENTO';
    case 'prontos': return card.estado === 'PRONTO';
    default: return true;
  }
}

/** Minúsculas e sem acento, para a busca achar "Operação" digitando "operacao". */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function cardCombinaComBusca(card: CardComando, busca: string, catalogo: CatalogoComando): boolean {
  const termo = normalizarBusca(busca);
  if (!termo) return true;
  const alvo = normalizarBusca([card.titulo, card.empresa ?? '', nomeEmpresa(catalogo, card.empresa), card.dono ?? ''].join(' '));
  return termo.split(/\s+/).every(parte => alvo.includes(parte));
}

export function ordenarCards(cards: CardComando[], ordem: OrdemCards, agora: Date): CardComando[] {
  const tempo = (valor: string | null) => lerData(valor)?.getTime() ?? null;
  const prazoDe = (card: CardComando) => tempo(prazoDoCard(card));
  const comNuloNoFim = (a: number | null, b: number | null, sentido: 1 | -1) =>
    a === b ? 0 : a === null ? 1 : b === null ? -1 : (a - b) * sentido;
  const recente = (card: CardComando) => tempo(card.atualizado_em) ?? tempo(card.criado_em);
  const comparar = (a: CardComando, b: CardComando): number => {
    if (ordem === 'recentes') return comNuloNoFim(recente(a), recente(b), -1);
    if (ordem === 'prazo') return comNuloNoFim(prazoDe(a), prazoDe(b), 1) || comNuloNoFim(recente(a), recente(b), -1);
    // prioridade: o que espera você, depois o vencido, depois o número de prioridade (MAIOR = mais urgente, como o motor: ORDER BY prioridade DESC), depois o prazo.
    const peso = (card: CardComando) => (cardEhFinal(card) ? 3 : cardPrecisaDeVoce(card) ? 0 : cardPrazoVencido(card, agora) ? 1 : 2);
    return peso(a) - peso(b)
      || comNuloNoFim(a.prioridade, b.prioridade, -1)
      || comNuloNoFim(prazoDe(a), prazoDe(b), 1)
      || comNuloNoFim(recente(a), recente(b), -1);
  };
  return [...cards].sort(comparar);
}

export type OpcoesFiltroCards = { busca: string; filtro: FiltroCards; ordem: OrdemCards; agora: Date; catalogo: CatalogoComando };
/** Aplica busca, filtro e ordenação sobre cards que JÁ foram filtrados por empresa. */
export function filtrarCards(cards: CardComando[], { busca, filtro, ordem, agora, catalogo }: OpcoesFiltroCards): CardComando[] {
  return ordenarCards(
    cards.filter(card => cardCombinaComFiltro(card, filtro, agora) && cardCombinaComBusca(card, busca, catalogo)),
    ordem, agora,
  );
}

export function contarPorFiltro(cards: CardComando[], agora: Date): Record<FiltroCards, number> {
  const contar = (filtro: FiltroCards) => cards.filter(card => cardCombinaComFiltro(card, filtro, agora)).length;
  return { todos: cards.length, precisa: contar('precisa'), vencido: contar('vencido'), andamento: contar('andamento'), prontos: contar('prontos') };
}

// ---------- etapas ----------

export const etapaEhFinal = (etapa: EtapaComando): boolean => (ESTADOS_ETAPA_FINAIS as readonly string[]).includes(etapa.estado);
export function etapaAtrasada(etapa: EtapaComando, agora: Date): boolean {
  const prazo = lerData(etapa.prazo_ate);
  return !!prazo && !etapaEhFinal(etapa) && etapa.estado !== 'APROVADA' && prazo.getTime() < agora.getTime();
}
/** Em execução/revisão e sem atualização há mais de 1 h (pelo `atualizado_em`). Sem hora registrada, não acusa nada. */
export function etapaParada(etapa: EtapaComando, agora: Date): boolean {
  if (etapa.estado !== 'EXECUTANDO' && etapa.estado !== 'REVISAO') return false;
  const atualizado = lerData(etapa.atualizado_em);
  return !!atualizado && agora.getTime() - atualizado.getTime() > LIMITE_PARADA_MS;
}
const semRevisor = (valor: string | null | undefined): boolean => !valor || !valor.trim() || valor.trim().toUpperCase() === 'NENHUM';
/**
 * Quem revisa a etapa. `revisor` = 'NENHUM' é o banco dizendo que não há revisor (nada a listar, nem o `revisores` antigo);
 * sem `revisor` informado, vale a lista `revisores`.
 */
export function revisoresReaisDaEtapa(etapa: EtapaComando): string[] {
  if (!semRevisor(etapa.revisor)) return [etapa.revisor!.trim()];
  if (etapa.revisor && etapa.revisor.trim()) return [];
  return (etapa.revisores ?? []).filter(nome => !semRevisor(nome));
}
export function revisoresDaEtapa(etapa: EtapaComando): string {
  const lista = revisoresReaisDaEtapa(etapa);
  return lista.length ? lista.join(', ') : 'Sem revisor';
}
export function etapasDoCard(etapas: EtapaComando[], cardId: string): EtapaComando[] {
  return etapas.filter(etapa => etapa.card_id === cardId)
    .sort((a, b) => (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER) || a.codigo.localeCompare(b.codigo, 'pt-BR'));
}
export function agruparEtapasPorEstado(etapas: EtapaComando[]): Record<string, EtapaComando[]> {
  const grupos: Record<string, EtapaComando[]> = Object.fromEntries(ESTADOS_ETAPA_PROCESSO.map(estado => [estado, []]));
  for (const etapa of etapas) if (grupos[etapa.estado]) grupos[etapa.estado].push(etapa);
  return grupos;
}
/** Dentro de uma coluna: atrasadas primeiro, depois prazo mais próximo (sem prazo no fim). */
export function ordenarEtapas(etapas: EtapaComando[], agora: Date): EtapaComando[] {
  const prazo = (etapa: EtapaComando) => lerData(etapa.prazo_ate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...etapas].sort((a, b) =>
    Number(etapaAtrasada(b, agora)) - Number(etapaAtrasada(a, agora)) || prazo(a) - prazo(b) || a.codigo.localeCompare(b.codigo, 'pt-BR'));
}

// ---------- leituras ----------

export type FonteAmostra = 'cards' | 'etapas' | 'entregas' | 'pedidos';
/** A leitura de ALGUMA das fontes que a aba usa foi cortada por limite? Sem corte por fonte, vale `dados.amostra`. */
export function amostraDe(dados: Pick<DadosComando, 'amostra' | 'amostras'>, fontes: FonteAmostra[]): boolean {
  return dados.amostras ? fontes.some(fonte => dados.amostras?.[fonte] === true) : dados.amostra;
}

export type FonteDados = keyof DadosComando['estado'];
const NOME_FONTE: Record<FonteDados, string> = {
  cards: 'os cards', etapas: 'as etapas', entregas: 'as entregas', pedidos: 'os pedidos', catalogo: 'o catálogo de empresas',
};
/** Junta o estado de várias fontes: qualquer erro vence (nunca vira zero), depois carregando. */
export function combinarLeituras(estado: DadosComando['estado'], fontes: FonteDados[]): { estado: EstadoLeitura; falhas: string[] } {
  const falhas = fontes.filter(fonte => estado[fonte] === 'erro').map(fonte => NOME_FONTE[fonte]);
  if (falhas.length) return { estado: 'erro', falhas };
  return { estado: fontes.some(fonte => estado[fonte] === 'carregando') ? 'carregando' : 'pronta', falhas: [] };
}
export function mensagemFalha(falhas: string[]): string {
  const lista = falhas.length > 1 ? `${falhas.slice(0, -1).join(', ')} e ${falhas[falhas.length - 1]}` : falhas[0];
  return `Não foi possível ler ${lista}. Os números não são mostrados para não parecerem zero. Atualize a página ou tente de novo em instantes.`;
}
