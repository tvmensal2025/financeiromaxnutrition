/**
 * O que é: cálculos puros (sem tela, sem banco) das abas Execução, Entregas e Consumo da Sala de comando v2.
 * Recebe o `DadosComando` do contrato e devolve blocos prontos para exibir. Lê SÓ dados da v2.
 * Como mudar: mantenha as funções puras. Regras de estado seguem helena-v2/maquina/passagens.yaml (estados de card e de etapa).
 * Datas: sempre no fuso America/Sao_Paulo.
 */
import {
  ESTADOS_ESPERA_FUNDADOR, ESTADOS_FINAIS,
  type AgenteComando, type CardComando, type CatalogoComando, type DadosComando, type EntregaResumo,
  type EstadoLeitura, type EtapaComando,
} from './tipos';
import { entregasAprovadas as entregasAprovadasDoCard } from './supervisao-v2';

export const FUSO = 'America/Sao_Paulo';
export const LIMITE_ITENS_BLOCO = 5;
/** Etapas que já terminaram (não contam como abertas). */
const ETAPAS_FINAIS = ['PRONTA', 'CANCELADA', 'ENCERRADA_COM_FALHA'];
/** Etapas que já passaram da fila e do trabalho e deveriam ter passado pelo portão 1 (ver passagens.yaml). */
const ETAPAS_COM_PORTAO = ['VALIDACAO', 'REVISAO', 'ESPERANDO_FUNDADOR', 'EM_RESOLUCAO', 'ENCERRADA_COM_FALHA'];

/* ---------- datas (America/Sao_Paulo) ---------- */

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** "17/10/2026 14:30" no horário de Brasília; data pura (AAAA-MM-DD) não sofre deslocamento de fuso. */
export function dataHoraSP(valor: string | null | undefined, vazio = 'Sem data'): string {
  if (!valor) return vazio;
  if (SO_DATA.test(valor)) {
    const [ano, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data indisponível';
  return data.toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });
}

/** Dia (AAAA-MM-DD) no horário de Brasília. */
export function diaSP(data: Date): string {
  return data.toLocaleDateString('sv-SE', { timeZone: FUSO });
}

/** Segunda-feira (AAAA-MM-DD) da semana em que `data` cai, no horário de Brasília. */
export function inicioDaSemanaSP(data: Date): string {
  const [ano, mes, dia] = diaSP(data).split('-').map(Number);
  const base = new Date(Date.UTC(ano, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
  return base.toISOString().slice(0, 10);
}

/** As últimas `quantidade` semanas (segunda-feira de cada uma), da mais antiga para a atual. */
export function ultimasSemanas(agora: Date, quantidade = 8): string[] {
  const atual = inicioDaSemanaSP(agora);
  const [ano, mes, dia] = atual.split('-').map(Number);
  const semanas: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    d.setUTCDate(d.getUTCDate() - 7 * i);
    semanas.push(d.toISOString().slice(0, 10));
  }
  return semanas;
}

export function rotuloSemana(chave: string): string {
  const [, mes, dia] = chave.split('-');
  return `${dia}/${mes}`;
}

function textoAtraso(prazo: Date, agora: Date): string {
  const minutos = Math.max(1, Math.round((agora.getTime() - prazo.getTime()) / 60000));
  if (minutos < 60) return `Atrasado há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `Atrasado há ${horas} h`;
  return `Atrasado há ${Math.round(horas / 24)} dias`;
}

/* ---------- nomes ---------- */

export function nomeEmpresa(catalogo: CatalogoComando, id: string | null | undefined): string {
  if (!id) return 'Empresa não definida';
  return catalogo.empresas.find(e => e.id === id)?.nome ?? id;
}

export function nomeAgente(catalogo: CatalogoComando, identidade: string | null | undefined): string | null {
  if (!identidade) return null;
  const agente: AgenteComando | undefined = catalogo.agentes.find(a => a.identidade === identidade || a.id === identidade);
  return agente?.nome ?? identidade;
}

/** "SEM_CAPACIDADE" -> "sem capacidade". */
export function textoSimples(valor: string): string {
  return valor.replace(/_/g, ' ').toLowerCase();
}

/** Junta os estados de várias fontes: erro vence, depois carregando. */
export function estadoCombinado(...estados: EstadoLeitura[]): EstadoLeitura {
  if (estados.includes('erro')) return 'erro';
  if (estados.includes('carregando')) return 'carregando';
  return 'pronta';
}

/* ---------- Central de execução ---------- */

export type ItemExecucao = {
  chave: string;
  /** null quando o item ainda não é um card (pedido em preparo). */
  cardId: string | null;
  titulo: string;
  empresa: string;
  /** Ex.: "Autor: Helena". */
  quem: string | null;
  prazo: string | null;
  prazoVencido: boolean;
  detalhe: string | null;
  /** Identidades de agentes ligadas ao item (para o filtro por agente). */
  agentes: string[];
  /** Instante usado para ordenar (mais antigo primeiro). */
  ordem: number;
};

export type BlocoDerivado = { itens: ItemExecucao[]; total: number };

export type ExecucaoDerivada = {
  esperando: BlocoDerivado;
  trabalho: BlocoDerivado;
  revisao: BlocoDerivado;
  pedidos: BlocoDerivado;
  falhas: BlocoDerivado;
  atrasados: BlocoDerivado;
  /** Pedidos que ainda não têm empresa e por isso ficam fora do filtro por empresa. */
  pedidosSemEmpresa: number;
};

const instante = (valor: string | null | undefined): number => {
  const t = valor ? new Date(valor).getTime() : NaN;
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
};
const ehFinalCard = (estado: string) => (ESTADOS_FINAIS as readonly string[]).includes(estado);
const prazoDoCard = (card: CardComando): string | null => card.prazo_ate ?? card.prazo ?? null;
const vencido = (prazo: string | null, agora: Date): boolean => !!prazo && new Date(prazo).getTime() < agora.getTime();
const empresaConfere = (empresa: string, valor: string | null | undefined) => empresa === 'GRUPO' || valor === empresa;

/** Atrasados precisam de um prazo com data completa; prazo só com dia vale até o fim do dia. */
function prazoVencido(prazo: string | null, agora: Date): boolean {
  if (!prazo) return false;
  if (SO_DATA.test(prazo)) return diaSP(agora) > prazo;
  return vencido(prazo, agora);
}

function montarBloco(itens: ItemExecucao[], agente: string): BlocoDerivado {
  const filtrados = agente ? itens.filter(i => i.agentes.includes(agente)) : itens;
  return { itens: [...filtrados].sort((a, b) => a.ordem - b.ordem), total: filtrados.length };
}

const ORIGEM: Record<string, string> = { SITE: 'Site', TELEGRAM: 'Telegram', CODEX: 'Codex' };

/**
 * Monta os blocos da Central de execução.
 * `agente` é a identidade (ex.: HELENA) ou '' para todos. Pedidos não têm agente: o filtro de agente não os altera.
 */
export function derivarExecucao(dados: DadosComando, empresa: string, agente = ''): ExecucaoDerivada {
  const { agora, catalogo } = dados;
  const cardsPorId = new Map(dados.cards.map(c => [c.id, c]));
  const etapasPorCard = new Map<string, EtapaComando[]>();
  for (const etapa of dados.etapas) {
    const lista = etapasPorCard.get(etapa.card_id) ?? [];
    lista.push(etapa);
    etapasPorCard.set(etapa.card_id, lista);
  }
  const agentesDoCard = (card: CardComando): string[] => {
    const ids = new Set<string>();
    if (card.dono) ids.add(card.dono);
    for (const e of etapasPorCard.get(card.id) ?? []) {
      if (ETAPAS_FINAIS.includes(e.estado) || e.estado === 'AGUARDANDO_ANTERIORES') continue;
      if (e.autor) ids.add(e.autor);
      if (e.revisor) ids.add(e.revisor);
      for (const r of e.revisores ?? []) ids.add(r);
    }
    return [...ids];
  };
  const doCard = (card: CardComando, sufixo: string, extra: Partial<ItemExecucao> = {}): ItemExecucao => {
    const prazo = prazoDoCard(card);
    return {
      chave: `card:${card.id}:${sufixo}`, cardId: card.id, titulo: card.titulo,
      empresa: nomeEmpresa(catalogo, card.empresa),
      quem: card.dono ? `Dono: ${nomeAgente(catalogo, card.dono)}` : null,
      prazo, prazoVencido: !ehFinalCard(card.estado) && prazoVencido(prazo, agora), detalhe: null,
      agentes: agentesDoCard(card), ordem: instante(card.atualizado_em ?? card.criado_em), ...extra,
    };
  };
  /** Etapa: precisa do card para saber a empresa; sem o card só entra na visão do grupo. */
  const doEtapa = (etapa: EtapaComando, quemRotulo: string, quemId: string | null, detalhe: string | null): ItemExecucao | null => {
    const card = cardsPorId.get(etapa.card_id);
    if (!card && empresa !== 'GRUPO') return null;
    if (card && !empresaConfere(empresa, card.empresa)) return null;
    const prazo = etapa.prazo_ate ?? (card ? prazoDoCard(card) : null);
    const envolvidos = new Set<string>();
    if (etapa.autor) envolvidos.add(etapa.autor);
    if (etapa.revisor) envolvidos.add(etapa.revisor);
    for (const r of etapa.revisores ?? []) envolvidos.add(r);
    const nome = nomeAgente(catalogo, quemId);
    return {
      chave: `etapa:${etapa.id}`, cardId: etapa.card_id, titulo: card?.titulo ?? 'Card fora da amostra lida',
      empresa: card ? nomeEmpresa(catalogo, card.empresa) : 'Empresa não confirmada',
      quem: nome ? `${quemRotulo}: ${nome}` : null, prazo, prazoVencido: prazoVencido(prazo, agora),
      detalhe: [`Etapa ${etapa.codigo} · ${etapa.nome}`, detalhe].filter(Boolean).join(' · '),
      agentes: [...envolvidos], ordem: instante(etapa.atualizado_em ?? card?.criado_em),
    };
  };

  const cardsEmpresa = dados.cards.filter(c => empresaConfere(empresa, c.empresa));

  const esperando = cardsEmpresa
    .filter(c => (ESTADOS_ESPERA_FUNDADOR as readonly string[]).includes(c.estado))
    .map(c => doCard(c, 'esperando', { detalhe: c.estado === 'ESPERANDO_CONFIRMACAO' ? 'Aguarda sua confirmação' : 'Aguarda sua decisão' }));

  const trabalho = dados.etapas.filter(e => e.estado === 'EXECUTANDO')
    .map(e => doEtapa(e, 'Autor', e.autor, null)).filter((i): i is ItemExecucao => i !== null);

  const revisao = dados.etapas.filter(e => e.estado === 'REVISAO')
    .map(e => doEtapa(e, 'Revisor', e.revisor ?? e.revisores?.[0] ?? null, e.autor ? `Autor: ${nomeAgente(catalogo, e.autor)}` : null))
    .filter((i): i is ItemExecucao => i !== null);

  const falhasDeCard = cardsEmpresa
    .filter(c => c.estado === 'ENCERRADO_COM_FALHA'
      || (!!c.motivo && c.motivo !== 'NENHUM' && c.estado !== 'PRONTO' && c.estado !== 'CANCELADO'))
    .map(c => doCard(c, 'falha', {
      detalhe: c.estado === 'ENCERRADO_COM_FALHA'
        ? `Encerrado com falha${c.motivo && c.motivo !== 'NENHUM' ? ` · motivo: ${textoSimples(c.motivo)}` : ''}`
        : `Travado · motivo: ${textoSimples(c.motivo ?? '')}`,
    }));
  const falhasDeEtapa = dados.etapas
    .filter(e => e.portao1_ok === false && ETAPAS_COM_PORTAO.includes(e.estado))
    .map(e => doEtapa(e, 'Autor', e.autor, 'Não passou no portão 1')).filter((i): i is ItemExecucao => i !== null);

  const atrasados = cardsEmpresa
    .filter(c => !ehFinalCard(c.estado) && prazoVencido(prazoDoCard(c), agora))
    .map(c => doCard(c, 'atrasado', {
      detalhe: SO_DATA.test(prazoDoCard(c) ?? '') ? 'Prazo vencido' : textoAtraso(new Date(prazoDoCard(c) as string), agora),
      ordem: instante(prazoDoCard(c)),
    }));

  const pedidosEmpresa = dados.pedidos.filter(p => p.estado === 'RECEBIDO' || p.estado === 'PLANO_CONFIRMADO');
  const pedidosSemEmpresa = empresa === 'GRUPO' ? 0 : pedidosEmpresa.filter(p => !p.empresa_id).length;
  const pedidos = pedidosEmpresa.filter(p => empresaConfere(empresa, p.empresa_id)).map((p): ItemExecucao => {
    const texto = (p.titulo_confirmado?.trim() || p.texto_inicial.trim() || 'Pedido sem texto');
    return {
      chave: `pedido:${p.pedido_id}`, cardId: p.card_id ?? null,
      titulo: texto.length > 120 ? `${texto.slice(0, 117)}...` : texto,
      empresa: p.empresa_id ? nomeEmpresa(catalogo, p.empresa_id) : 'Empresa ainda não definida',
      quem: `Origem: ${ORIGEM[p.origem_inicial] ?? p.origem_inicial}`,
      prazo: p.prazo_confirmado ?? null, prazoVencido: prazoVencido(p.prazo_confirmado ?? null, agora),
      detalhe: p.estado === 'RECEBIDO' ? 'Recebido para triagem; ainda não virou card.' : 'Plano confirmado; aguardando criação do card.',
      agentes: [], ordem: instante(p.criado_em),
    };
  });

  return {
    esperando: montarBloco(esperando, agente),
    trabalho: montarBloco(trabalho, agente),
    revisao: montarBloco(revisao, agente),
    // Pedidos não têm agente: o filtro de agente não se aplica a eles.
    pedidos: montarBloco(pedidos, ''),
    falhas: montarBloco([...falhasDeCard, ...falhasDeEtapa], agente),
    atrasados: montarBloco(atrasados, agente),
    pedidosSemEmpresa,
  };
}

/* ---------- Entregas e Consumo ---------- */

/**
 * Entregas aprovadas da empresa escolhida, pela MESMA regra do detalhe do card e das outras abas (`entregasAprovadas` de
 * supervisao-v2.ts): etapa APROVADA/PRONTA, portão 1 passou, entrega fresca e versão igual à da etapa. Entrega que só passou
 * no portão 1 mas ficou velha, ou cuja etapa não veio na leitura, NÃO entra (o card também não a abriria).
 * Entrega não traz empresa: ela vem do card. Se o card não está na leitura, a entrega é contada em `ocultas`.
 * `indisponivel` = etapas ou entregas não foram lidas: sem elas não dá para afirmar nada (a lista vem vazia, nunca "zero real").
 */
export function entregasAprovadas(dados: DadosComando, empresa: string):
  { itens: EntregaResumo[]; ocultas: number; indisponivel: boolean } {
  const aprovadas = entregasAprovadasDoCard(dados);
  if (aprovadas === null) return { itens: [], ocultas: 0, indisponivel: true };
  const ordenadas = [...aprovadas].sort((a, b) => instante(b.criada_em) - instante(a.criada_em));
  if (empresa === 'GRUPO') return { itens: ordenadas, ocultas: 0, indisponivel: false };
  const conhecidos = new Set(dados.cards.map(c => c.id));
  const daEmpresa = new Set(dados.cards.filter(c => c.empresa === empresa).map(c => c.id));
  return {
    itens: ordenadas.filter(e => daEmpresa.has(e.card_id)),
    ocultas: aprovadas.filter(e => !conhecidos.has(e.card_id)).length,
    indisponivel: false,
  };
}

export type SemanaEntregas = { chave: string; rotulo: string; total: number };

/** Entregas aprovadas por semana nas últimas `quantidade` semanas (segunda a domingo, horário de Brasília). */
export function entregasPorSemana(dados: DadosComando, empresa: string, quantidade = 8):
  { semanas: SemanaEntregas[]; total: number; ocultas: number } {
  const { itens, ocultas } = entregasAprovadas(dados, empresa); // mesma regra estrita da galeria
  const semanas = ultimasSemanas(dados.agora, quantidade).map(chave => ({ chave, rotulo: rotuloSemana(chave), total: 0 }));
  const porChave = new Map(semanas.map(s => [s.chave, s]));
  for (const entrega of itens) {
    const data = new Date(entrega.criada_em);
    if (Number.isNaN(data.getTime())) continue;
    const semana = porChave.get(inicioDaSemanaSP(data));
    if (semana) semana.total += 1;
  }
  return { semanas, total: semanas.reduce((soma, s) => soma + s.total, 0), ocultas };
}

export type GrupoExecucoes = { nome: string; execucoes: number; etapas: number };

/**
 * Volume de trabalho por etapa. `totalExecucoes` fica null quando nenhuma etapa trouxe o número
 * (assim a tela nunca mostra zero no lugar de "não medido").
 */
export function execucoesPorEtapa(dados: DadosComando, empresa: string): {
  abertas: number; medidas: number; semLeitura: number; totalExecucoes: number | null; grupos: GrupoExecucoes[]; ocultas: number;
} {
  const cardsPorId = new Map(dados.cards.map(c => [c.id, c]));
  let ocultas = 0;
  const etapas = dados.etapas.filter(e => {
    if (empresa === 'GRUPO') return true;
    const card = cardsPorId.get(e.card_id);
    if (!card) { ocultas += 1; return false; }
    return card.empresa === empresa;
  });
  const abertas = etapas.filter(e => !ETAPAS_FINAIS.includes(e.estado)).length;
  const numericas = etapas.filter(e => typeof e.execucoes === 'number' && Number.isFinite(e.execucoes));
  const mapa = new Map<string, GrupoExecucoes>();
  for (const e of numericas) {
    const nome = e.nome?.trim() || e.codigo;
    const grupo = mapa.get(nome) ?? { nome, execucoes: 0, etapas: 0 };
    grupo.execucoes += e.execucoes as number;
    grupo.etapas += 1;
    mapa.set(nome, grupo);
  }
  const grupos = [...mapa.values()].sort((a, b) => b.execucoes - a.execucoes || a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    abertas, medidas: numericas.length, semLeitura: etapas.length - numericas.length,
    totalExecucoes: numericas.length ? numericas.reduce((soma, e) => soma + (e.execucoes as number), 0) : null,
    grupos, ocultas,
  };
}
