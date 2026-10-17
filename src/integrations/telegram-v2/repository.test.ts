import { describe, expect, it, vi } from 'vitest';
import { criarRepositorioPareamentoTelegramV2, type ClientePareamentoTelegramV2 } from './repository';

const semVinculo = { vinculado: false, chat_id: null, usuario_id: null, vinculado_em: null,
  codigo_pendente: false, codigo_expira_em: null };
const vinculado = { vinculado: true, chat_id: '-100123456789012345', usuario_id: '123456789012345678',
  vinculado_em: '2026-10-17T12:00:00Z', codigo_pendente: false, codigo_expira_em: null };
function banco(data: unknown, code?: string) {
  const rpc = vi.fn().mockResolvedValue({ data, error: code ? { code, message: 'detalhe interno' } : null });
  const schema = vi.fn().mockReturnValue({ rpc });
  return { cliente: { schema } as ClientePareamentoTelegramV2, rpc, schema };
}

describe('RPCs de pareamento Telegram', () => {
  it('chama apenas a camada helena_v2 e valida código de 48 hex', async () => {
    const codigo = { codigo: 'a'.repeat(48), expira_em: '2026-10-17T12:10:00Z' };
    const { cliente, rpc, schema } = banco(codigo);
    expect(await criarRepositorioPareamentoTelegramV2(cliente).gerar()).toEqual(codigo);
    expect(schema).toHaveBeenCalledWith('helena_v2');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('gerar_pareamento_telegram');
  });
  it('lê vínculo próprio com IDs decimais tratados como texto e revoga só com resposta confirmada', async () => {
    const { cliente, rpc } = banco(vinculado);
    const repo = criarRepositorioPareamentoTelegramV2(cliente);
    expect(await repo.consultar()).toEqual(vinculado);
    rpc.mockResolvedValueOnce({ data: semVinculo, error: null });
    expect(await repo.revogar()).toEqual(semVinculo);
    expect(rpc).toHaveBeenLastCalledWith('revogar_pareamento_telegram');
  });
  it.each([null, {}, { ...semVinculo, vinculado: true }, { ...vinculado, chat_id: 123 },
    { ...semVinculo, codigo_pendente: true }, { ...semVinculo, codigo_expira_em: 'data ruim' }])
  ('rejeita situação sem confirmação válida: %j', async data => {
    await expect(criarRepositorioPareamentoTelegramV2(banco(data).cliente).consultar()).rejects.toThrow();
  });
  it.each([null, { codigo: 'curto', expira_em: '2026-10-17T12:10:00Z' },
    { codigo: 'a'.repeat(48), expira_em: 'inválido' }])('rejeita código malformado: %j', async data => {
    await expect(criarRepositorioPareamentoTelegramV2(banco(data).cliente).gerar()).rejects.toThrow();
  });
  it('não aceita revogação que ainda declara vínculo', async () => {
    await expect(criarRepositorioPareamentoTelegramV2(banco(vinculado).cliente).revogar()).rejects.toThrow();
  });
  it.each(['42501', '23505', 'PGRST202', '42883', 'XX000'])('não mostra detalhes internos da RPC: %s', async code => {
    const { cliente } = banco(null, code);
    await expect(criarRepositorioPareamentoTelegramV2(cliente).consultar()).rejects.not.toThrow('detalhe interno');
  });
});
