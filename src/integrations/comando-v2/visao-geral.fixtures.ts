/**
 * O que é: dados montados à mão para os testes da aba Visão geral (agora = 17/10/2026 12:00 em São Paulo).
 * Como mudar: só os testes de derivar-visao-geral e da VisaoGeralAba usam isto; ajuste os números esperados juntos.
 */
import { dadosVazios, type CardComando, type DadosComando, type EntregaResumo, type EtapaComando } from './tipos';
import type { PedidoEntrada } from '@/integrations/pedidos-v2/repository';

export const AGORA = new Date('2026-10-17T15:00:00Z');

export const card = (id: string, estado: string, extra: Partial<CardComando> = {}): CardComando => ({
  id, titulo: `Card ${id}`, empresa: 'BIZ-003', estado, dono: 'Helena', prazo: '2026-10-30T12:00:00Z',
  criado_em: '2026-10-10T12:00:00Z', atualizado_em: '2026-10-10T12:00:00Z', prazo_ate: null, prioridade: null, ...extra,
});
export const etapa = (id: string, card_id: string, autor: string, estado = 'EM_ANDAMENTO'): EtapaComando => ({
  id, codigo: id.toUpperCase(), nome: `Etapa ${id}`, estado, autor, dono: null, prazo_ate: null, revisores: [], versao: 1,
  portao1_ok: false, entrega_fresca: false, card_id, ordem: 1, atualizado_em: null, execucoes: null,
});
export const entrega = (id: string, card_id: string, criada_em: string, portao1 = 'PASSOU', etapa_id = 'e1'): EntregaResumo => ({
  id, card_id, etapa_id, etapa_codigo: 'E1', versao: 1, autor: 'HELENA', portao1, criada_em, parecer: null, usou_internet: null,
});
export const pedido = (id: string, criado_em: string, extra: Partial<PedidoEntrada> = {}): PedidoEntrada => ({
  pedido_id: id, request_id: id, estado: 'RECEBIDO', texto_inicial: `Pedido ${id}`, total_eventos: 1,
  criado_em, atualizado_em: criado_em, origem_inicial: 'SITE', ...extra,
});

export const cardsBase: CardComando[] = [
  card('c1', 'ESPERANDO_FUNDADOR', { titulo: 'Escolher a campanha', atualizado_em: '2026-10-14T15:00:00Z', prazo: '2026-10-20T12:00:00Z' }),
  card('c2', 'ESPERANDO_CONFIRMACAO', { titulo: 'Confirmar o pedido novo', motivo: 'HELENA_FALHOU', atualizado_em: '2026-10-17T13:00:00Z' }),
  card('c3', 'EM_ANDAMENTO', { titulo: 'Montar o site', empresa: 'BIZ-001', prazo: '2026-10-12T12:00:00Z' }),
  card('c4', 'PRONTO', { titulo: 'Logo final', empresa: 'BIZ-001', atualizado_em: '2026-10-15T12:00:00Z', prazo: '2026-10-01T12:00:00Z' }),
  card('c5', 'PRONTO', { titulo: 'Texto antigo', empresa: 'BIZ-001', atualizado_em: '2026-09-01T12:00:00Z' }),
  card('c6', 'ENCERRADO_COM_FALHA', { titulo: 'Plano quebrado', motivo: 'PLANO_INVALIDO', atualizado_em: '2026-10-16T12:00:00Z' }),
  card('c7', 'RASCUNHO', { titulo: 'Ideia solta', empresa: 'BIZ-001', prazo: '2026-10-17' }),
  card('c8', 'EM_ANDAMENTO', { titulo: 'Sem empresa', empresa: null }),
];

export function dadosCheios(): DadosComando {
  return {
    ...dadosVazios(AGORA),
    cards: cardsBase,
    etapas: [
      etapa('e1', 'c3', 'MAYA'), etapa('e2', 'c3', 'maya'), etapa('e3', 'c1', 'HELENA', 'REVISAO'),
      etapa('e4', 'c3', 'HELENA', 'APROVADA'), etapa('e5', 'c4', 'HELENA'), etapa('e6', 'c8', 'Fulano externo'),
      // Etapas prontas e frescas que sustentam as entregas d1 e d2 (entrega aprovada = regra estrita do card).
      { ...etapa('x1', 'c4', 'HELENA', 'PRONTA'), portao1_ok: true, entrega_fresca: true },
      { ...etapa('x2', 'c3', 'HELENA', 'PRONTA'), portao1_ok: true, entrega_fresca: true },
    ],
    entregas: [
      entrega('d1', 'c4', '2026-10-16T15:00:00Z', 'PASSOU', 'x1'), entrega('d2', 'c3', '2026-10-17T10:00:00Z', 'PASSOU', 'x2'),
      entrega('d3', 'c3', '2026-10-17T11:00:00Z', 'FALHOU'), entrega('d4', 'c1', '2026-09-01T10:00:00Z'),
    ],
    pedidos: [
      pedido('p1', '2026-10-17T02:00:00Z'), // 23h de 16/10 em São Paulo
      pedido('p2', '2026-10-17T15:00:00Z', { empresa_id: 'BIZ-003' }),
      pedido('p3', '2026-10-15T15:00:00Z', { card_id: 'c4' }),
    ],
    catalogo: {
      revisao: 'rev-1',
      empresas: [
        { id: 'BIZ-001', nome: 'Max Nutrition', pacote: 'CONFIRMADO' },
        { id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' },
        { id: 'BIZ-004', nome: 'Empresa Parada', pacote: 'RASCUNHO' },
      ],
      agentes: [
        { id: 'AGT-01', identidade: 'HELENA', nome: 'Helena', cargo: 'Orquestradora', grupo: 'CORE', estado: 'ESTAGIO' },
        { id: 'AGT-02', identidade: 'MAYA', nome: 'Maya', cargo: 'Conteúdo', grupo: 'CRIACAO', estado: 'ESTAGIO' },
      ],
      servicos: [],
    },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
  };
}
