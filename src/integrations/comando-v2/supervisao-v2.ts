/**
 * O que é: a Supervisão da Sala de comando v2 — regras puras que olham cards, etapas e pedidos da v2 (esquema helena_v2)
 * e apontam exceções (o que está sem dono, atrasado, parado ou esperando você). Também guarda auxiliares de leitura
 * usados pelas abas Supervisão, Empresas, Agentes e Cobertura (tempo decorrido, rótulos, carga dos agentes, entregas aprovadas).
 * Como mudar: cada regra é uma função pequena em `analisarCardsV2`; para ajustar um prazo, mude as constantes `LIMITE_*`.
 * Nada aqui lê banco, usa dados da v1 ou aprova algo: só aponta para você olhar.
 */
import {
  ESTADOS_ESPERA_FUNDADOR, ESTADOS_FINAIS,
  type AgenteComando, type CardComando, type DadosComando, type EtapaComando,
} from './tipos';
import { revisoresReaisDaEtapa, rotuloMotivo } from './derivar-cards';

export type Severidade = 'ALTA' | 'MEDIA' | 'BAIXA';
export type RegraSupervisao =
  | 'SEM_DONO' | 'SEM_PRAZO' | 'PRAZO_VENCIDO' | 'ESPERANDO_VOCE' | 'ENCERRADO_COM_FALHA'
  | 'PORTAO_OU_ENTREGA' | 'EXECUCAO_PARADA' | 'SEM_EMPRESA' | 'PEDIDO_SEM_CARD';

export type Excecao = {
  id: string;
  regra: RegraSupervisao;
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  cardId?: string;
  etapaId?: string;
  empresa?: string;
  /** Desde quando vale (ISO). Serve para dizer "há quanto tempo" e para ordenar do mais antigo. */
  desde?: string;
};

const HORA = 3_600_000;
export const LIMITE_ESPERA_MEDIA_H = 24;
export const LIMITE_ESPERA_ALTA_H = 72;
export const LIMITE_EXECUCAO_PARADA_H = 1;
export const LIMITE_PEDIDO_SEM_CARD_H = 1;
/** Plano já confirmado por você, mas o card ainda não nasceu: prazo próprio, contado desde a confirmação. */
export const LIMITE_PLANO_CONFIRMADO_SEM_CARD_H = 1;

export const ROTULO_REGRA: Record<RegraSupervisao, string> = {
  SEM_DONO: 'Sem dono',
  SEM_PRAZO: 'Sem prazo',
  PRAZO_VENCIDO: 'Prazo vencido',
  ESPERANDO_VOCE: 'Esperando você',
  ENCERRADO_COM_FALHA: 'Encerrado com falha',
  PORTAO_OU_ENTREGA: 'Portão ou entrega',
  EXECUCAO_PARADA: 'Execução parada',
  SEM_EMPRESA: 'Sem empresa',
  PEDIDO_SEM_CARD: 'Pedido sem card',
};
export const ORDEM_REGRAS = Object.keys(ROTULO_REGRA) as RegraSupervisao[];
export const ROTULO_SEVERIDADE: Record<Severidade, string> = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };
const PESO: Record<Severidade, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

/** Explicação em uma frase de cada regra (aparece na aba, para ninguém precisar adivinhar). */
export const EXPLICACAO_REGRA: Record<RegraSupervisao, string> = {
  SEM_DONO: 'Card em aberto que não tem um responsável.',
  SEM_PRAZO: 'Card em aberto sem data combinada.',
  PRAZO_VENCIDO: 'Card em aberto cujo prazo já passou.',
  ESPERANDO_VOCE: `Card esperando decisão sua há mais de ${LIMITE_ESPERA_MEDIA_H} h (média) ou ${LIMITE_ESPERA_ALTA_H} h (alta).`,
  ENCERRADO_COM_FALHA: 'Card que terminou com falha.',
  PORTAO_OU_ENTREGA: 'Etapa em revisão, aprovada ou pronta cuja entrega ficou velha (média) ou, com a entrega em dia, não passou no portão 1 (alta).',
  EXECUCAO_PARADA: `Etapa executando ou em revisão sem nenhuma atualização há mais de ${LIMITE_EXECUCAO_PARADA_H} h.`,
  SEM_EMPRESA: 'Card sem empresa definida.',
  PEDIDO_SEM_CARD: `Pedido recebido há mais de ${LIMITE_PEDIDO_SEM_CARD_H} h, ou plano confirmado há mais de ${LIMITE_PLANO_CONFIRMADO_SEM_CARD_H} h, que ainda não virou card.`,
};

/** Traduz o código de motivo do banco para uma frase simples (o mesmo dicionário das abas de cards). Nunca devolve vazio. */
export function traduzirMotivo(motivo: string | null | undefined): string {
  return rotuloMotivo(motivo) ?? 'Sem motivo registrado.';
}

const ROTULOS_ESTADO_AGENTE: Record<string, string> = {
  ATIVO: 'Ativo', ESTAGIO: 'Em estágio', RASCUNHO: 'Rascunho', EM_TESTE: 'Em teste', PAUSADO: 'Pausado',
  APOSENTADO: 'Aposentado', 'NÃO INFORMADO': 'Não informado',
};
/** Estado da configuração (agente ou serviço) em português simples. */
export function rotuloEstadoConfig(estado: string): string {
  const codigo = (estado ?? '').trim();
  if (!codigo) return 'Não informado';
  return ROTULOS_ESTADO_AGENTE[codigo] ?? (codigo.charAt(0).toUpperCase() + codigo.slice(1).replace(/_/g, ' ').toLowerCase());
}

const instante = (valor: string | null | undefined): number | null => {
  if (!valor) return null;
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? null : t;
};
const temTexto = (valor: string | null | undefined) => typeof valor === 'string' && valor.trim() !== '';

export const cardAberto = (card: Pick<CardComando, 'estado'>) =>
  !(ESTADOS_FINAIS as readonly string[]).includes(card.estado);
export const aguardaFundador = (card: Pick<CardComando, 'estado'>) =>
  (ESTADOS_ESPERA_FUNDADOR as readonly string[]).includes(card.estado);
/** O prazo que vale: `prazo_ate` (coluna do banco) ou, na falta dele, `prazo`. */
export const prazoDoCard = (card: CardComando): string | null => card.prazo_ate ?? (temTexto(card.prazo) ? card.prazo : null);
export const prazoVencido = (card: CardComando, agora: Date): boolean => {
  const t = instante(prazoDoCard(card));
  return cardAberto(card) && t !== null && t < agora.getTime();
};

const ETAPAS_ENCERRADAS = ['APROVADA', 'PRONTA', 'CANCELADA', 'ENCERRADA_COM_FALHA'];
export const etapaAberta = (etapa: Pick<EtapaComando, 'estado'>) => !ETAPAS_ENCERRADAS.includes(etapa.estado);
const mesmaPessoa = (a: string | null | undefined, b: string | null | undefined) =>
  temTexto(a) && temTexto(b) && a!.trim().toUpperCase() === b!.trim().toUpperCase();
export const mesmaIdentidade = mesmaPessoa;

/** "5 min", "3 h", "2 dias" (tempo entre `desde` e `agora`). Data inválida: "tempo desconhecido". */
export function duracao(desde: string | null | undefined, agora: Date): string {
  const t = instante(desde);
  if (t === null) return 'tempo desconhecido';
  const min = Math.floor((agora.getTime() - t) / 60_000);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} dias`;
}
/** "há 5 min", "há 3 h", "há 2 dias". */
export function haQuantoTempo(desde: string | null | undefined, agora: Date): string {
  if (instante(desde) === null) return 'data não informada';
  const d = duracao(desde, agora);
  return d === 'menos de 1 min' ? 'agora há pouco' : `há ${d}`;
}
/** Data e hora no fuso de São Paulo. */
export function dataHoraSaoPaulo(valor: string | null | undefined): string {
  const t = instante(valor);
  if (t === null) return 'data indisponível';
  return new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

function ordenar(lista: Excecao[]): Excecao[] {
  return [...lista].sort((a, b) => {
    if (PESO[a.severidade] !== PESO[b.severidade]) return PESO[a.severidade] - PESO[b.severidade];
    const ta = instante(a.desde), tb = instante(b.desde);
    if (ta !== tb) return ta === null ? 1 : tb === null ? -1 : ta - tb;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Aplica as regras da Supervisão sobre os dados lidos. Não decide nada: só aponta.
 * Etapa ou data que o banco não informa (nulo) nunca vira exceção por suposição.
 */
export function analisarCardsV2(dados: DadosComando, agora: Date): Excecao[] {
  const saida: Excecao[] = [];
  const agoraMs = agora.getTime();
  const cardPorId = new Map(dados.cards.map(c => [c.id, c]));

  for (const card of dados.cards) {
    const base = { cardId: card.id, titulo: card.titulo, empresa: card.empresa ?? undefined };
    const aberto = cardAberto(card);
    if (aberto && !temTexto(card.dono)) {
      saida.push({ ...base, id: `SEM_DONO:${card.id}`, regra: 'SEM_DONO', severidade: 'MEDIA', desde: card.criado_em,
        detalhe: 'Este card está em aberto e ninguém é responsável por ele.' });
    }
    const prazo = prazoDoCard(card);
    if (aberto && !prazo) {
      saida.push({ ...base, id: `SEM_PRAZO:${card.id}`, regra: 'SEM_PRAZO', severidade: 'MEDIA', desde: card.criado_em,
        detalhe: 'Este card está em aberto e não tem prazo combinado.' });
    }
    if (prazoVencido(card, agora)) {
      saida.push({ ...base, id: `PRAZO_VENCIDO:${card.id}`, regra: 'PRAZO_VENCIDO', severidade: 'ALTA', desde: prazo!,
        detalhe: `O prazo deste card venceu em ${dataHoraSaoPaulo(prazo)} e ele ainda não terminou.` });
    }
    if (aguardaFundador(card)) {
      const t = instante(card.atualizado_em);
      if (t !== null && agoraMs - t > LIMITE_ESPERA_MEDIA_H * HORA) {
        const alta = agoraMs - t > LIMITE_ESPERA_ALTA_H * HORA;
        saida.push({ ...base, id: `ESPERANDO_VOCE:${card.id}`, regra: 'ESPERANDO_VOCE', severidade: alta ? 'ALTA' : 'MEDIA',
          desde: card.atualizado_em!,
          detalhe: `Este card espera uma decisão sua faz ${duracao(card.atualizado_em, agora)}.` });
      }
    }
    if (card.estado === 'ENCERRADO_COM_FALHA') {
      saida.push({ ...base, id: `ENCERRADO_COM_FALHA:${card.id}`, regra: 'ENCERRADO_COM_FALHA', severidade: 'ALTA',
        desde: card.atualizado_em ?? undefined,
        detalhe: `Este card terminou com falha. ${traduzirMotivo(card.motivo)}` });
    }
    if (aberto && !temTexto(card.empresa)) {
      saida.push({ ...base, id: `SEM_EMPRESA:${card.id}`, regra: 'SEM_EMPRESA', severidade: 'BAIXA', desde: card.criado_em,
        detalhe: 'Este card não diz de qual empresa ele é.' });
    }
  }

  for (const etapa of dados.etapas) {
    const card = cardPorId.get(etapa.card_id);
    if (card && card.estado === 'CANCELADO') continue;
    const nomeEtapa = `${etapa.codigo} · ${etapa.nome}`;
    const base = { cardId: etapa.card_id, etapaId: etapa.id, empresa: card?.empresa ?? undefined };
    // Sem o card na leitura não dá para saber de quem é nem se ainda vale: a exceção continua, mas rebaixada e dizendo isso.
    const contexto = card ? ` (card "${card.titulo}")` : ' (o card dela não está na leitura)';
    const rebaixar = (severidade: Severidade): Severidade => (card ? severidade : 'BAIXA');

    // Antes da entrega, portao1_ok é falso por natureza: só cobramos de etapa que já deveria ter entrega passada.
    if (['REVISAO', 'APROVADA', 'PRONTA'].includes(etapa.estado)) {
      // Entrega velha é a causa (a informação mudou depois dela) e explica o portão falso; só com a entrega em dia o portão falso é grave.
      const velha = etapa.entrega_fresca === false;
      const portao = etapa.portao1_ok === false && etapa.entrega_fresca === true;
      if (velha || portao) {
        saida.push({ ...base, id: `PORTAO_OU_ENTREGA:${etapa.id}`, regra: 'PORTAO_OU_ENTREGA', severidade: rebaixar(velha ? 'MEDIA' : 'ALTA'),
          titulo: nomeEtapa, desde: etapa.atualizado_em ?? undefined,
          detalhe: velha
            ? `Na etapa${contexto}, a entrega ficou velha (a informação mudou depois dela).`
            : `Na etapa${contexto}, a entrega não passou no portão 1.` });
      }
    }
    // Card já terminado (PRONTO, ENCERRADO_COM_FALHA, CANCELADO): etapa solta não está "parada", só ficou para trás.
    if (['EXECUTANDO', 'REVISAO'].includes(etapa.estado) && !(card && !cardAberto(card))) {
      const t = instante(etapa.atualizado_em);
      if (t !== null && agoraMs - t > LIMITE_EXECUCAO_PARADA_H * HORA) {
        saida.push({ ...base, id: `EXECUCAO_PARADA:${etapa.id}`, regra: 'EXECUCAO_PARADA', severidade: rebaixar('MEDIA'),
          titulo: nomeEtapa, desde: etapa.atualizado_em!,
          detalhe: `A etapa${contexto} está ${etapa.estado === 'EXECUTANDO' ? 'executando' : 'em revisão'} e não muda ${haQuantoTempo(etapa.atualizado_em, agora)}.` });
      }
    }
  }

  for (const pedido of dados.pedidos) {
    const semCard = !temTexto(pedido.card_id);
    const recebido = pedido.estado === 'RECEBIDO' && semCard;
    const planoConfirmado = pedido.estado === 'PLANO_CONFIRMADO' && semCard;
    if (!recebido && !planoConfirmado) continue;
    // Recebido conta desde a chegada; plano confirmado conta desde a confirmação (última atualização), com limite próprio.
    const desde = recebido ? pedido.criado_em : (pedido.atualizado_em ?? pedido.criado_em);
    const limite = recebido ? LIMITE_PEDIDO_SEM_CARD_H : LIMITE_PLANO_CONFIRMADO_SEM_CARD_H;
    const t = instante(desde);
    if (t === null || agoraMs - t <= limite * HORA) continue;
    const resumo = (pedido.titulo_confirmado?.trim() || pedido.texto_inicial.trim()).replace(/\s+/g, ' ');
    saida.push({
      id: `PEDIDO_SEM_CARD:${pedido.pedido_id}`, regra: 'PEDIDO_SEM_CARD', severidade: 'MEDIA',
      titulo: resumo.length > 80 ? `${resumo.slice(0, 77)}...` : resumo || 'Pedido sem texto',
      empresa: pedido.empresa_id ?? undefined, desde,
      detalhe: recebido
        ? `Este pedido foi recebido ${haQuantoTempo(desde, agora)} e ainda não virou card.`
        : `Você confirmou o plano deste pedido ${haQuantoTempo(desde, agora)} e o card ainda não foi criado.`,
    });
  }

  return ordenar(saida);
}

/** Conta exceções por severidade e por regra (para os chips do resumo). */
export function resumirExcecoes(lista: Excecao[]) {
  const porSeveridade: Record<Severidade, number> = { ALTA: 0, MEDIA: 0, BAIXA: 0 };
  const porRegra: Partial<Record<RegraSupervisao, number>> = {};
  for (const e of lista) {
    porSeveridade[e.severidade] += 1;
    porRegra[e.regra] = (porRegra[e.regra] ?? 0) + 1;
  }
  return { porSeveridade, porRegra };
}

/** Respeita o filtro de empresa: 'GRUPO' deixa tudo; senão só o que é da empresa. `foraDoFiltro` conta o que não tem empresa. */
export function filtrarPorEmpresa(lista: Excecao[], empresa: string): { itens: Excecao[]; semEmpresa: number } {
  if (empresa === 'GRUPO') return { itens: lista, semEmpresa: 0 };
  return {
    itens: lista.filter(e => e.empresa === empresa),
    semEmpresa: lista.filter(e => !temTexto(e.empresa)).length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Auxiliares das abas Empresas, Agentes e Cobertura.

/** Nome da empresa pelo código; sem cadastro, devolve o próprio código (nunca inventa nome). */
export function nomeDaEmpresa(dados: DadosComando, id: string | null | undefined): string {
  if (!temTexto(id)) return 'Empresa não definida';
  return dados.catalogo.empresas.find(e => e.id === id)?.nome ?? id!;
}

/**
 * Entregas aprovadas, pela mesma regra do detalhe do card: a etapa está APROVADA/PRONTA, passou no portão 1,
 * a entrega está fresca e a versão da entrega é a versão atual da etapa.
 * Sem a leitura de etapas não dá para afirmar nada: devolve null (a tela mostra "indisponível", nunca zero).
 */
export function entregasAprovadas(dados: DadosComando) {
  if (dados.estado.etapas !== 'pronta' || dados.estado.entregas !== 'pronta') return null;
  const aprovadas = new Map(dados.etapas
    .filter(e => ['APROVADA', 'PRONTA'].includes(e.estado) && e.portao1_ok && e.entrega_fresca)
    .map(e => [e.id, e.versao]));
  return dados.entregas.filter(en => en.portao1 === 'PASSOU' && aprovadas.get(en.etapa_id) === en.versao);
}

export type ResumoEmpresa = {
  id: string; nome: string; pacote: string; pacoteConfirmado: boolean;
  abertos: number; esperandoVoce: number; atrasados: number; prontos: number;
  /** null = não deu para ler etapas/entregas. */
  entregasAprovadas: number | null;
};

export function resumirEmpresas(dados: DadosComando, empresa: string, agora: Date): { empresas: ResumoEmpresa[]; semEmpresa: number } {
  const aprovadas = entregasAprovadas(dados);
  const conhecidas = new Set(dados.catalogo.empresas.map(e => e.id));
  const monta = (id: string, nome: string, pacote: string): ResumoEmpresa => {
    const cards = dados.cards.filter(c => c.empresa === id);
    const ids = new Set(cards.map(c => c.id));
    return {
      id, nome, pacote, pacoteConfirmado: pacote === 'CONFIRMADO',
      abertos: cards.filter(cardAberto).length,
      esperandoVoce: cards.filter(aguardaFundador).length,
      atrasados: cards.filter(c => prazoVencido(c, agora)).length,
      prontos: cards.filter(c => c.estado === 'PRONTO').length,
      entregasAprovadas: aprovadas === null ? null : aprovadas.filter(en => ids.has(en.card_id)).length,
    };
  };
  const empresas = dados.catalogo.empresas
    .filter(e => empresa === 'GRUPO' || e.id === empresa)
    .map(e => monta(e.id, e.nome, e.pacote));
  const semEmpresa = empresa === 'GRUPO'
    ? dados.cards.filter(c => cardAberto(c) && (!temTexto(c.empresa) || !conhecidas.has(c.empresa!))).length : 0;
  return { empresas, semEmpresa };
}

export type CargaAgente = { etapasAbertas: number; revisoesPendentes: number };

/** Carga atual de cada agente (chave = identidade em maiúsculas). Respeita o filtro de empresa pelo card da etapa. */
export function cargaPorAgente(dados: DadosComando, empresa: string): Map<string, CargaAgente> {
  const cardPorId = new Map(dados.cards.map(c => [c.id, c]));
  const etapas = dados.etapas.filter(e => {
    const card = cardPorId.get(e.card_id);
    if (card && !cardAberto(card)) return false; // etapa solta de card terminado não é carga
    return empresa === 'GRUPO' || card?.empresa === empresa;
  });
  const mapa = new Map<string, CargaAgente>();
  for (const agente of dados.catalogo.agentes) {
    const chave = agente.identidade.trim().toUpperCase();
    mapa.set(chave, {
      etapasAbertas: etapas.filter(e => etapaAberta(e) && mesmaIdentidade(e.autor, agente.identidade)).length,
      // Revisão pendente: etapa em REVISAO cujo revisor (≠ NENHUM) é este agente, de card ainda aberto.
      revisoesPendentes: etapas.filter(e => e.estado === 'REVISAO' && revisoresReaisDaEtapa(e).some(r => mesmaIdentidade(r, agente.identidade))).length,
    });
  }
  return mapa;
}
export const chaveAgente = (agente: Pick<AgenteComando, 'identidade'>) => agente.identidade.trim().toUpperCase();

// ---------------------------------------------------------------------------------------------------------------
// Estado das leituras: a tela mostra erro ou "carregando" antes de mostrar qualquer número.

export type FonteComando = keyof DadosComando['estado'];
const NOME_FONTE: Record<FonteComando, string> = {
  cards: 'os cards', etapas: 'as etapas', entregas: 'as entregas', pedidos: 'os pedidos',
  catalogo: 'a configuração ativa (empresas, agentes e serviços)',
};
export const nomeDaFonte = (fonte: FonteComando) => NOME_FONTE[fonte];

/** Resume as fontes que a aba exige: 'erro' vence 'carregando', que vence 'pronta'. `falhas` lista as fontes com erro. */
export function situacaoDasLeituras(
  dados: DadosComando, fontes: FonteComando[],
): { situacao: 'erro' | 'carregando' | 'pronta'; falhas: FonteComando[] } {
  const falhas = fontes.filter(f => dados.estado[f] === 'erro');
  if (falhas.length) return { situacao: 'erro', falhas };
  if (fontes.some(f => dados.estado[f] === 'carregando')) return { situacao: 'carregando', falhas: [] };
  return { situacao: 'pronta', falhas: [] };
}
/** "os cards, as etapas e os pedidos". */
export function listaDeFontes(fontes: FonteComando[]): string {
  const nomes = fontes.map(nomeDaFonte);
  return nomes.length < 2 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
