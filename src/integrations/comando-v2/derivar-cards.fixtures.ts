/**
 * O que é: dados montados à mão para os testes das abas Cards, Processo e Acompanhamento (nenhum dado real).
 * Como mudar: acrescente fábricas aqui; não importe isto em código de produção.
 */
import { dadosVazios, type CardComando, type DadosComando, type EntregaResumo, type EtapaComando } from './tipos';
import type { PedidoEntrada } from '@/integrations/pedidos-v2/repository';

export const AGORA = new Date('2026-10-17T15:00:00Z');
const horas = (h: number) => new Date(AGORA.getTime() + h * 3600_000).toISOString();

export const card = (id: string, extra: Partial<CardComando> = {}): CardComando => ({
  id, titulo: `Card ${id}`, empresa: 'BIZ-003', estado: 'EM_ANDAMENTO', dono: 'HELENA', prazo: horas(48), criado_em: horas(-72),
  atualizado_em: horas(-2), prazo_ate: horas(48), prioridade: null, motivo: 'NENHUM', ...extra,
});
export const etapa = (id: string, cardId: string, extra: Partial<EtapaComando> = {}): EtapaComando => ({
  id, card_id: cardId, codigo: `E-${id}`, nome: `Etapa ${id}`, estado: 'EXECUTANDO', autor: 'CAIO', dono: null, prazo_ate: horas(5),
  revisores: ['CLARA'], versao: 1, portao1_ok: false, entrega_fresca: false, ordem: 1, atualizado_em: horas(-0.2), execucoes: 1, ...extra,
});
export const entrega = (id: string, cardId: string, portao1 = 'PASSOU'): EntregaResumo => ({
  id, card_id: cardId, etapa_id: 'x', etapa_codigo: 'E-x', versao: 1, autor: 'CAIO', portao1, criada_em: horas(-1), parecer: null, usou_internet: false,
});
export const pedido = (id: string, estado: PedidoEntrada['estado'], extra: Partial<PedidoEntrada> = {}): PedidoEntrada => ({
  pedido_id: id, request_id: id, estado, texto_inicial: `Pedido ${id}`, total_eventos: 1, criado_em: horas(-3), atualizado_em: horas(-3),
  origem_inicial: 'SITE', card_id: null, empresa_id: null, ...extra,
});

export function montarDados(parcial: Partial<DadosComando> = {}): DadosComando {
  const base = dadosVazios(AGORA);
  return {
    ...base,
    catalogo: {
      revisao: 'rev-1',
      empresas: [{ id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' }, { id: 'BIZ-005', nome: 'eLiving', pacote: 'CONFIRMADO' }],
      agentes: [], servicos: [],
    },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
    ...parcial,
  };
}
