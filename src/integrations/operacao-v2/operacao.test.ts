import { describe, expect, it, vi } from 'vitest';
import type { RepositorioConfigV2, ConfigDetail, ConfigRevision } from '@/integrations/config-v2/repository';
import { lerCatalogoAtivo } from './catalogo';
import { criarRepositorioGovernancaV2 } from './governanca';

const revisao: ConfigRevision = {
  id: 'r1', nome: 'Revisão validada', versao: 2, estado: 'VALIDADA', ativa: true,
  tecnica: false, hash_sha256: 'hash', criada_em: '', validada_em: '', aposentada_em: null,
};
const detalhe: ConfigDetail = { ...revisao, conteudo: {
  'helena-v2/organograma.yaml': { agentes: [{ id: 'AGT-01', nome: 'Helena', cargo: 'Coordenação', estado: 'ATIVO' }] },
  'helena-v2/servicos.yaml': { servicos: [{ id: 'SRV-01', nome: 'Relatório', dono: 'HELENA', revisor: 'CAIO', estado: 'ESTAGIO', empresas: ['BIZ-001'] }] },
} };
function config(lista: ConfigRevision[], lido: ConfigDetail): RepositorioConfigV2 {
  return { listar: vi.fn().mockResolvedValue(lista), ler: vi.fn().mockResolvedValue(lido) } as unknown as RepositorioConfigV2;
}

describe('leitura da operação v2', () => {
  it('usa apenas a revisão ativa validada e preserva o estado como configuração', async () => {
    const repo = config([{ ...revisao, id: 'rascunho', ativa: false, estado: 'RASCUNHO' }, revisao], detalhe);
    const catalogo = await lerCatalogoAtivo(repo);
    expect(repo.ler).toHaveBeenCalledWith('r1');
    expect(catalogo.agentes[0]).toMatchObject({ nome: 'Helena', estado: 'ATIVO' });
    expect(catalogo.servicos[0]).toMatchObject({ dono: 'HELENA', estado: 'ESTAGIO' });
  });

  it('recusa ativa divergente e não apresenta revisão desatualizada', async () => {
    await expect(lerCatalogoAtivo(config([revisao], { ...detalhe, versao: 3 }))).rejects.toThrow('mudou');
    await expect(lerCatalogoAtivo(config([{ ...revisao, estado: 'RASCUNHO' }], detalhe))).rejects.toThrow('ativa e validada');
  });

  it('lê somente metadados do checkpoint e das decisões, sem snapshot nem texto livre', async () => {
    const colunas: string[] = [];
    const cliente = { from: (tabela: string) => ({ select: (campos: string) => {
      colunas.push(`${tabela}:${campos}`);
      const data = tabela === 'checkpoint_mestre_atual'
        ? [{ checkpoint_id: 'CP-1', versao: 1, status: 'ATIVO', atualizado_em: null }]
        : [{ decision_id: 'DEC-1', status: 'VIGENTE', data_hora: null, escopo: 'GRUPO' }];
      const consulta = { limit: () => consulta, order: () => consulta, then: (resolve: (valor: unknown) => void) => Promise.resolve({ data, error: null }).then(resolve) };
      return consulta;
    } }) };
    const repo = criarRepositorioGovernancaV2(cliente as unknown as Parameters<typeof criarRepositorioGovernancaV2>[0]);
    expect(await repo.checkpoint()).toMatchObject({ id: 'CP-1', estado: 'ATIVO' });
    expect(await repo.decisoes()).toMatchObject([{ id: 'DEC-1', estado: 'VIGENTE' }]);
    expect(colunas).toEqual([
      'checkpoint_mestre_atual:checkpoint_id,versao,status,atualizado_em',
      'decisoes:decision_id,status,data_hora,escopo',
    ]);
  });
});
