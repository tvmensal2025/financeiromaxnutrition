import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    expect(chamadas[2].args).toEqual({ p_id: 'uuid-revisao', p_nome: 'Configuração', p_conteudo: { 'helena-v2/models.yaml': { versao: '3.1' } }, p_versao_esperada: 4, p_base_id: null });
    expect(chamadas[3].args).toEqual({ p_id: 'uuid-revisao', p_versao: 5 });
    expect(chamadas[4].args).toEqual({ p_id: 'uuid-revisao', p_ativa_esperada: 'uuid-ativa' });
    expect(chamadas[1].args).toEqual({ p_id: 'uuid-revisao' });
    expect(chamadas[5].args).toEqual({ p_id: 'uuid-revisao' });
  });

  it('clona revisão como novo rascunho sem sobrescrever origem', async () => {
    const { chamadas, repo } = cliente({ id: 'nova-revisao' });
    await repo.salvar({ base_id: 'origem', nome: 'Configuração', conteudo: { 'helena-v2/servicos.yaml': { servicos: [] } } });
    expect(chamadas[0].args).toMatchObject({ p_id: null, p_versao_esperada: null, p_base_id: 'origem' });
  });

  it('mantém nomes de argumentos iguais aos parâmetros da migração SQL', async () => {
    const local = resolve(process.cwd(), 'supabase/migrations-v2/0006_configuracoes.sql');
    const migracao = existsSync(local) ? local : resolve(process.cwd(), '../helena-v2/supabase/migrations-v2/0006_configuracoes.sql');
    const sql = readFileSync(migracao, 'utf8');
    const { chamadas, repo } = cliente({ id: 'uuid-revisao' });
    await repo.listar(); await repo.ler('uuid-revisao');
    await repo.salvar({ nome: 'Configuração', conteudo: {} });
    await repo.solicitarValidacao('uuid-revisao', 1);
    await repo.ativar('uuid-revisao', null); await repo.aposentar('uuid-revisao');
    for (const chamada of chamadas) {
      const assinatura = sql.match(new RegExp(`create or replace function helena_v2\\.${chamada.nome}\\(([^)]*)\\)`, 'i'));
      expect(assinatura, `assinatura SQL de ${chamada.nome}`).not.toBeNull();
      const parametros = [...assinatura![1].matchAll(/\b(p_\w+)\s+(?:uuid|text|jsonb|integer)\b/gi)].map(match => match[1]);
      expect(Object.keys(chamada.args ?? {}).sort(), chamada.nome).toEqual(parametros.sort());
    }
  });

  it('explica conflito de versão e propaga erro de regra do banco', async () => {
    await expect(cliente(null, { code: '40001', message: 'concorrência' }).repo.listar()).rejects.toThrow(/mudou durante a edição/);
    await expect(cliente(null, { code: '23514', message: 'Máquina exige prova' }).repo.ativar('r', null)).rejects.toThrow('Máquina exige prova');
  });
});
