import { describe, expect, it, vi } from 'vitest';
import { criarRepositorioPedidosV2, type ClientePedidosV2 } from './repository';

export const requestId = '00000000-0000-4000-8000-000000000010';
export const recibo = { pedido_id: '00000000-0000-4000-8000-000000000020', request_id: requestId,
  estado: 'RECEBIDO' as const, texto_inicial: 'Preparar campanha', total_eventos: 1,
  criado_em: '2026-10-17T12:00:00Z', atualizado_em: '2026-10-17T12:00:00Z', origem_inicial: 'SITE' as const };
const envio = { requestId, eventoId: 'site:uuid', texto: 'Preparar campanha' };
const plano = { ...recibo, estado: 'PLANO_CONFIRMADO' as const, empresa_id: 'BIZ-003', empresa_confirmada: true,
  config_revision_id: '33333333-3333-4333-8333-333333333333', card_id: null,
  titulo_confirmado: 'Campanha da eLiving™', prazo_confirmado: '2026-10-30T12:00:00Z', plano_hash: 'a'.repeat(64) };
const cardCriado = { ...plano, estado: 'CARD_CRIADO' as const, card_id: '44444444-4444-4444-8444-444444444444' };
function banco(data: unknown, code?: string) {
  const rpc = vi.fn().mockResolvedValue({ data, error: code ? { code, message: 'detalhe interno não deve sair' } : null });
  const schema = vi.fn().mockReturnValue({ rpc });
  return { cliente: { schema } as ClientePedidosV2, rpc, schema };
}
describe('entrada autenticada de pedidos', () => {
  it('recebe somente pela RPC de triagem com origem SITE e preserva os identificadores', async () => {
    const { cliente, schema, rpc } = banco(recibo);
    expect(await criarRepositorioPedidosV2(cliente).receber(envio)).toEqual(recibo);
    expect(schema).toHaveBeenCalledWith('helena_v2');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('receber_pedido_entrada', {
      p_request_id: requestId, p_origem: 'SITE', p_evento_id: envio.eventoId, p_texto: envio.texto,
    });
  });
  it('consulta ausente como null e lista com limite visível', async () => {
    const { cliente, rpc } = banco(null);
    const repo = criarRepositorioPedidosV2(cliente);
    expect(await repo.ler(requestId)).toBeNull();
    rpc.mockResolvedValueOnce({ data: { limite: 50, itens: [recibo] }, error: null });
    expect(await repo.listar()).toEqual({ limite: 50, itens: [recibo] });
    expect(rpc).toHaveBeenLastCalledWith('listar_pedidos_entrada', { p_limite: 50 });
  });
  it('aceita recibo 0021 e estados 0023 sem confundir plano confirmado com card criado', async () => {
    const { cliente, rpc } = banco({ limite: 50, itens: [recibo, plano, cardCriado] });
    const repo = criarRepositorioPedidosV2(cliente);
    expect((await repo.listar()).itens.map(item => item.estado)).toEqual(['RECEBIDO', 'PLANO_CONFIRMADO', 'CARD_CRIADO']);
    rpc.mockResolvedValueOnce({ data: plano, error: null });
    expect((await repo.receber(envio)).card_id).toBeNull();
    rpc.mockResolvedValueOnce({ data: { ...cardCriado, eventos: [{ origem: 'SITE', evento_id: envio.eventoId,
      texto: envio.texto, recebido_em: recibo.criado_em }] }, error: null });
    expect((await repo.ler(requestId))?.card_id).toBe(cardCriado.card_id);
  });
  it.each([{ ...plano, empresa_confirmada: false }, { ...plano, card_id: cardCriado.card_id },
    { ...cardCriado, card_id: 'javascript:alert(1)' }, { ...cardCriado, plano_hash: 'incorreto' },
    { ...recibo, estado: 'CARD_CRIADO' }])('rejeita estado e vínculo inconsistentes: %j', async data => {
    await expect(criarRepositorioPedidosV2(banco(data).cliente).receber(envio)).rejects.toThrow();
  });
  it.each([null, {}, { ...recibo, estado: 'PRONTO' }, { ...recibo, request_id: 'inválido' },
    { ...recibo, total_eventos: 0 }, { ...recibo, origem_inicial: 'DESCONHECIDA' },
    { ...recibo, request_id: '00000000-0000-4000-8000-000000000099' }])('recusa recibo ausente, estranho ou de outro pedido: %j', async data => {
    await expect(criarRepositorioPedidosV2(banco(data).cliente).receber(envio)).rejects.toThrow();
  });
  it.each(['42501', '23505', 'PGRST202', '42883'])('mostra falha segura sem detalhes internos: %s', async codigo => {
    await expect(criarRepositorioPedidosV2(banco(null, codigo).cliente).receber(envio))
      .rejects.not.toThrow('detalhe interno');
  });
  it('rejeita campos inválidos antes de chamar banco', async () => {
    const { cliente, rpc } = banco(recibo);
    const repo = criarRepositorioPedidosV2(cliente);
    for (const invalido of [{ ...envio, texto: ' \n\t' }, { ...envio, texto: 'x'.repeat(10_001) },
      { ...envio, requestId: 'outro' }, { ...envio, eventoId: 'x'.repeat(161) }]) {
      await expect(repo.receber(invalido)).rejects.toThrow();
    }
    await expect(repo.ler('outro')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('não transforma lista inválida em fila vazia', async () => {
    await expect(criarRepositorioPedidosV2(banco({ itens: [], limite: 1000 }).cliente).listar()).rejects.toThrow();
  });
  it('lê mensagens exatas e rejeita história incompleta', async () => {
    const evento = { origem: 'SITE', evento_id: envio.eventoId, texto: envio.texto, recebido_em: recibo.criado_em };
    const { cliente, rpc } = banco({ ...recibo, eventos: [evento] });
    const repo = criarRepositorioPedidosV2(cliente);
    expect(await repo.ler(requestId)).toEqual({ ...recibo, eventos: [evento] });
    rpc.mockResolvedValueOnce({ data: { ...recibo, eventos: [] }, error: null });
    await expect(repo.ler(requestId)).rejects.toThrow('mensagens');
  });
  it('sanitiza também rejeições de rede da biblioteca', async () => {
    const { cliente, rpc } = banco(null);
    rpc.mockRejectedValueOnce(new Error('detalhe interno não deve sair'));
    await expect(criarRepositorioPedidosV2(cliente).receber(envio)).rejects.toThrow('Não foi possível confirmar o pedido no banco.');
  });
});
