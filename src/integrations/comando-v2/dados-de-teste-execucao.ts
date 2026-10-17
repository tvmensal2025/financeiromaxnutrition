/**
 * O que é: dados montados à mão (sem banco) que os testes das abas Execução, Entregas, Consumo e Plano usam.
 * Não é importado pelo app. "Agora" fixo: 17/10/2026 12:00 em Brasília (sábado; a semana começa em 12/10).
 * Como mudar: acrescente itens com cuidado, pois vários testes contam o que há aqui.
 */
import { dadosVazios, type CardComando, type DadosComando, type EntregaResumo, type EtapaComando } from './tipos';

export const AGORA_TESTE = new Date('2026-10-17T15:00:00Z');

export const card = (id: string, extra: Partial<CardComando> = {}): CardComando => ({
  id, titulo: `Card ${id}`, empresa: 'BIZ-003', estado: 'EM_ANDAMENTO', dono: 'HELENA', prazo: '2026-10-25T12:00:00Z',
  criado_em: '2026-10-10T12:00:00Z', motivo: 'NENHUM', atualizado_em: '2026-10-16T12:00:00Z', prazo_ate: null, prioridade: null, ...extra,
});
export const etapa = (id: string, cardId: string, extra: Partial<EtapaComando> = {}): EtapaComando => ({
  id, codigo: id.toUpperCase(), nome: `Etapa ${id}`, estado: 'NA_FILA', autor: 'HELENA', dono: null, prazo_ate: null, revisores: [],
  versao: 1, portao1_ok: false, entrega_fresca: false, card_id: cardId, ordem: 1, atualizado_em: '2026-10-16T12:00:00Z', execucoes: null, ...extra,
});
export const entrega = (id: string, cardId: string, extra: Partial<EntregaResumo> = {}): EntregaResumo => ({
  id, card_id: cardId, etapa_id: 'e1', etapa_codigo: 'E1', versao: 1, autor: 'HELENA', portao1: 'PASSOU',
  criada_em: '2026-10-15T15:00:00Z', parecer: null, usou_internet: null, ...extra,
});

/** Todas as leituras prontas, com cards, etapas, entregas e pedidos de duas empresas. */
export function dadosDeTeste(): DadosComando {
  const base = dadosVazios(AGORA_TESTE);
  return {
    ...base,
    cards: [
      card('c1', { titulo: 'Campanha de outubro', estado: 'ESPERANDO_FUNDADOR', prazo: '2026-10-20T12:00:00Z' }),
      card('c2', { titulo: 'Plano Max', estado: 'ESPERANDO_CONFIRMACAO', empresa: 'BIZ-001' }),
      card('c3', { titulo: 'Post semanal', prazo: '2026-10-10T12:00:00Z' }),
      card('c4', { titulo: 'Relatório que falhou', estado: 'ENCERRADO_COM_FALHA', motivo: 'HELENA_FALHOU' }),
      card('c5', { titulo: 'Site da Max', empresa: 'BIZ-001', motivo: 'INFRA', dono: 'CRIADOR' }),
      card('c6', { titulo: 'Feito e entregue', estado: 'PRONTO', prazo: '2026-10-01T12:00:00Z' }),
    ],
    etapas: [
      etapa('e1', 'c3', { estado: 'EXECUTANDO', nome: 'Redigir', execucoes: 2 }),
      etapa('e2', 'c3', { estado: 'REVISAO', nome: 'Revisar', autor: 'CRIADOR', revisor: 'REVISOR', revisores: ['REVISOR'], execucoes: 1, portao1_ok: true }),
      etapa('e3', 'c5', { estado: 'EXECUTANDO', nome: 'Redigir', autor: 'CRIADOR', execucoes: 3 }),
      etapa('e4', 'c3', { estado: 'VALIDACAO', nome: 'Conferir', portao1_ok: false }),
      etapa('e5', 'c3', { estado: 'PRONTA', nome: 'Pesquisar', portao1_ok: true }),
      // Etapas aprovadas/prontas e frescas: dão sustentação às entregas 1 a 4 (entrega aprovada = regra estrita do card).
      etapa('a1', 'c3', { estado: 'PRONTA', nome: 'Redigir', portao1_ok: true, entrega_fresca: true }),
      etapa('a2', 'c3', { estado: 'PRONTA', nome: 'Revisar', autor: 'CRIADOR', portao1_ok: true, entrega_fresca: true }),
      etapa('a3', 'c5', { estado: 'PRONTA', nome: 'Redigir', portao1_ok: true, entrega_fresca: true }),
      etapa('a4', 'c6', { estado: 'PRONTA', nome: 'Redigir', portao1_ok: true, entrega_fresca: true }),
    ],
    entregas: [
      entrega('1', 'c3', { etapa_id: 'a1', criada_em: '2026-10-15T15:00:00Z', parecer: 'Texto claro' }),
      entrega('2', 'c3', { criada_em: '2026-10-13T15:00:00Z', autor: 'CRIADOR', etapa_codigo: 'E2', etapa_id: 'a2' }),
      entrega('3', 'c5', { etapa_id: 'a3', criada_em: '2026-10-06T15:00:00Z' }),
      entrega('4', 'c6', { etapa_id: 'a4', criada_em: '2026-08-25T15:00:00Z', usou_internet: true }),
      entrega('5', 'c3', { portao1: 'NAO_PASSOU', criada_em: '2026-10-15T16:00:00Z' }),
    ],
    pedidos: [
      { pedido_id: 'p1', request_id: 'r1', estado: 'RECEBIDO', texto_inicial: 'Quero um post sobre vitaminas', total_eventos: 1,
        criado_em: '2026-10-16T12:00:00Z', atualizado_em: '2026-10-16T12:00:00Z', origem_inicial: 'TELEGRAM' },
      { pedido_id: 'p2', request_id: 'r2', estado: 'PLANO_CONFIRMADO', texto_inicial: 'Plano de e-mail', total_eventos: 2,
        criado_em: '2026-10-15T12:00:00Z', atualizado_em: '2026-10-16T12:00:00Z', origem_inicial: 'SITE', empresa_id: 'BIZ-003', titulo_confirmado: 'E-mails de lançamento' },
      { pedido_id: 'p3', request_id: 'r3', estado: 'CARD_CRIADO', texto_inicial: 'Já virou card', total_eventos: 2,
        criado_em: '2026-10-14T12:00:00Z', atualizado_em: '2026-10-14T12:00:00Z', origem_inicial: 'SITE', card_id: 'c3' },
    ],
    catalogo: {
      revisao: 'Revisão ativa',
      empresas: [{ id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' }, { id: 'BIZ-001', nome: 'Max Nutrition', pacote: 'CONFIRMADO' }],
      agentes: [
        { id: 'AGT-01', identidade: 'HELENA', nome: 'Helena', cargo: 'Chefe', grupo: 'Núcleo', estado: 'ESTAGIO', fase: '1' },
        { id: 'AGT-02', identidade: 'CRIADOR', nome: 'Sirlene', cargo: 'Criação', grupo: 'Conteúdo', estado: 'RASCUNHO', fase: '2' },
        { id: 'AGT-03', identidade: 'REVISOR', nome: 'Rafael', cargo: 'Revisão', grupo: 'Conteúdo', estado: 'ESTAGIO', fase: '1' },
        { id: 'AGT-04', identidade: 'SEMFASE', nome: 'Alex', cargo: 'Apoio', grupo: 'Apoio', estado: 'PAUSADO' },
      ],
      servicos: [],
    },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
  };
}
