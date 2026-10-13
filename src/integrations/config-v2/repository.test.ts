import { describe, expect, it } from 'vitest';
import { criarRepositorioConfigV2, type ClienteConfigV2 } from './repository';

function cliente(resposta: unknown, error: { message: string; code?: string } | null = null) {
  const chamadas: { schema: string; nome: string; args?: Record<string, unknown> }[] = [];
  const base: ClienteConfigV2 = {
    schema(schema) {
      return { rpc(nome, args) { chamadas.push({ schema, nome, args }); return Promise.resolve({ data: resposta, error }); } };
    },
  };
  return { chamadas, repo: criarRepositorioConfigV2(base) };
}

describe('contrato de configuração v2', () => {
  it('usa RPCs no schema v2 e preserva UUID, versão esperada e CAS da ativa', async () => {
    const { chamadas, repo } = cliente({ id: 'uuid-revisao' });
    await repo.listar();
    await repo.ler('uuid-revisao');
    await repo.salvar({ id: 'uuid-revisao', nome: 'Configuração', conteudo: { 'helena-v2/models.yaml': { versao: '3.1' } }, versao_esperada: 4 });
    await repo.solicitarValidacao('uuid-revisao', 5);
    await repo.ativar('uuid-revisao', 'uuid-ativa');
    await repo.aposentar('uuid-revisao');
    expect(chamadas.map(c => [c.schema, c.nome])).toEqual([
      ['helena_v2', 'listar_configuracoes'], ['helena_v2', 'ler_configuracao'],
      ['helena_v2', 'salvar_rascunho'], ['helena_v2', 'solicitar_validacao_config'],
      ['helena_v2', 'ativar_configuracao'], ['helena_v2', 'aposentar_configuracao'],
    ]);
    expect(chamadas[2].args).toEqual({ id: 'uuid-revisao', nome: 'Configuração', conteudo: { 'helena-v2/models.yaml': { versao: '3.1' } }, versao_esperada: 4, base_id: null });
    expect(chamadas[3].args).toEqual({ id: 'uuid-revisao', versao: 5 });
    expect(chamadas[4].args).toEqual({ id: 'uuid-revisao', ativa_esperada: 'uuid-ativa' });
  });

  it('clona revisão como novo rascunho sem sobrescrever origem', async () => {
    const { chamadas, repo } = cliente({ id: 'nova-revisao' });
    await repo.salvar({ base_id: 'origem', nome: 'Configuração', conteudo: { 'helena-v2/servicos.yaml': { servicos: [] } } });
    expect(chamadas[0].args).toMatchObject({ id: null, versao_esperada: null, base_id: 'origem' });
  });

  it('explica conflito de versão e propaga erro de regra do banco', async () => {
    await expect(cliente(null, { code: '40001', message: 'concorrência' }).repo.listar()).rejects.toThrow(/mudou durante a edição/);
    await expect(cliente(null, { code: '23514', message: 'Máquina exige prova' }).repo.ativar('r', null)).rejects.toThrow('Máquina exige prova');
  });
});
