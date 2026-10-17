import { describe, expect, it } from 'vitest';
import type { ConfigDetail, ConfigRevision, RepositorioConfigV2 } from '@/integrations/config-v2/repository';
import { catalogoComando, lerCatalogoComandoAtivo } from './catalogo-comando';

const revisao: ConfigRevision = {
  id: 'r1', nome: 'Revisão 7', versao: 3, estado: 'VALIDADA', ativa: true, tecnica: false,
  hash_sha256: 'abc', criada_em: '2026-10-01', validada_em: '2026-10-02', aposentada_em: null,
};

// Formato mínimo copiado de helena-v2/organograma.yaml e servicos.yaml.
const organograma = {
  versao: '3.1.0',
  empresas: {
    'BIZ-003': { nome: 'Humano Digital', area: 'x', pacote: { estado: 'CONFIRMADO', conteudo: 'y' } },
    'BIZ-001': { nome: 'iGreen Energy', area: 'x', pacote: { estado: 'NAO_CONFIRMADO', falta: 'z' } },
  },
  agentes: [
    { id: 'AGT-01', identidade: 'HELENA', nome: 'Helena', cargo: 'Coordenadora (CEO virtual)', grupo: 'GRP-COORDENACAO', escopo: 'EMPRESAS', fase_de_ativacao: 'v2.0', estado: 'ESTAGIO' },
    { id: 'AGT-05', identidade: 'CAIO', nome: 'Caio', cargo: 'Finanças', grupo: 'GRP-FINANCAS-DADOS-ADM', escopo: 'EMPRESAS', estado: 'PAUSADO' },
  ],
};
const servicos = {
  versao: '3.1.0',
  servicos: [
    { id: 'SRV-RELATORIO-FINAL', nome: 'Relatório final do card', dono: 'HELENA', revisor: 'CAIO', estado: 'ESTAGIO', empresas: ['BIZ-003', 'BIZ-004'] },
  ],
};

function detalhe(conteudo: Record<string, unknown>, extra: Partial<ConfigDetail> = {}): ConfigDetail {
  return { ...revisao, conteudo: conteudo as ConfigDetail['conteudo'], ...extra };
}
const completo = () => detalhe({ 'helena-v2/organograma.yaml': organograma, 'helena-v2/servicos.yaml': servicos });

describe('catálogo da Sala de comando', () => {
  it('extrai empresas, agentes com identidade e serviços', () => {
    const catalogo = catalogoComando(completo());
    expect(catalogo.revisao).toBe('Revisão 7');
    expect(catalogo.empresas).toEqual([
      { id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' },
      { id: 'BIZ-001', nome: 'iGreen Energy', pacote: 'NAO_CONFIRMADO' },
    ]);
    expect(catalogo.agentes[0]).toEqual({
      id: 'AGT-01', identidade: 'HELENA', nome: 'Helena', cargo: 'Coordenadora (CEO virtual)',
      grupo: 'GRP-COORDENACAO', estado: 'ESTAGIO', fase: 'v2.0',
    });
    expect(catalogo.agentes[1]).not.toHaveProperty('fase');
    expect(catalogo.servicos).toEqual([
      { id: 'SRV-RELATORIO-FINAL', nome: 'Relatório final do card', dono: 'HELENA', revisor: 'CAIO', estado: 'ESTAGIO', empresas: ['BIZ-003', 'BIZ-004'] },
    ]);
  });

  it.each([
    ['sem organograma', { 'helena-v2/servicos.yaml': servicos }],
    ['sem servicos', { 'helena-v2/organograma.yaml': organograma }],
    ['sem empresas', { 'helena-v2/organograma.yaml': { ...organograma, empresas: undefined }, 'helena-v2/servicos.yaml': servicos }],
    ['empresas vazias', { 'helena-v2/organograma.yaml': { ...organograma, empresas: {} }, 'helena-v2/servicos.yaml': servicos }],
    ['empresa sem nome', { 'helena-v2/organograma.yaml': { ...organograma, empresas: { 'BIZ-009': { pacote: {} } } }, 'helena-v2/servicos.yaml': servicos }],
    ['agentes em texto', { 'helena-v2/organograma.yaml': { ...organograma, agentes: 'texto' }, 'helena-v2/servicos.yaml': servicos }],
    ['agente sem identidade', { 'helena-v2/organograma.yaml': { ...organograma, agentes: [{ id: 'AGT-99', nome: 'X' }] }, 'helena-v2/servicos.yaml': servicos }],
    ['sem agentes', { 'helena-v2/organograma.yaml': { ...organograma, agentes: [] }, 'helena-v2/servicos.yaml': servicos }],
    ['servicos malformados', { 'helena-v2/organograma.yaml': organograma, 'helena-v2/servicos.yaml': { servicos: 1 } }],
  ])('catálogo malformado (%s) vira erro, nunca vazio', (_nome, conteudo) => {
    expect(() => catalogoComando(detalhe(conteudo))).toThrow();
  });
});

describe('leitura do catálogo ativo', () => {
  function repo(revisoes: ConfigRevision[], lido: ConfigDetail = completo()): RepositorioConfigV2 {
    return { listar: async () => revisoes, ler: async () => lido } as unknown as RepositorioConfigV2;
  }
  it('lê a única revisão ativa e validada', async () => {
    expect((await lerCatalogoComandoAtivo(repo([revisao]))).agentes).toHaveLength(2);
  });
  it('recusa zero ou duas ativas, ou ativa não validada', async () => {
    await expect(lerCatalogoComandoAtivo(repo([]))).rejects.toThrow('exatamente uma');
    await expect(lerCatalogoComandoAtivo(repo([revisao, { ...revisao, id: 'r2' }]))).rejects.toThrow('exatamente uma');
    await expect(lerCatalogoComandoAtivo(repo([{ ...revisao, estado: 'RASCUNHO' }]))).rejects.toThrow('exatamente uma');
  });
  it('recusa quando a ativa muda durante a leitura', async () => {
    await expect(lerCatalogoComandoAtivo(repo([revisao], { ...completo(), hash_sha256: 'outro' }))).rejects.toThrow('mudou durante a leitura');
  });
});
