import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AtivacaoConfig, ConfigDetail, ConfigRevision, RepositorioConfigV2 } from '@/integrations/config-v2/repository';
import ConfiguracoesV2Page from './ConfiguracoesV2Page';

const auth = vi.hoisted(() => ({ isFounder: false, userId: 'fundador-a' }));
vi.mock('@/auth', () => ({ useAuth: () => ({ isFounder: auth.isFounder, user: { id: auth.userId } }) }));

const base: ConfigDetail = {
  id: 'uuid-a', nome: 'Configuração existente', versao: 3, estado: 'RASCUNHO', ativa: false, tecnica: false,
  hash_sha256: null, criada_em: '2026-10-13T10:00:00Z', validada_em: null, aposentada_em: null,
  conteudo: { 'helena-v2/agents/isabela.yaml': { missao: 'Texto registrado', servicos: ['SRV-COPY'] } },
};
function repositorio(revisao: ConfigDetail = base): RepositorioConfigV2 {
  return {
    listar: vi.fn().mockResolvedValue([revisao]),
    ler: vi.fn().mockResolvedValue(revisao),
    salvar: vi.fn().mockImplementation(async args => ({ ...revisao, ...args, versao: revisao.versao + 1 })),
    solicitarValidacao: vi.fn().mockResolvedValue({ ...revisao, validacao_pendente: true }),
    ativar: vi.fn().mockResolvedValue({ ...revisao, ativa: true }),
    aposentar: vi.fn().mockResolvedValue({ ...revisao, estado: 'APOSENTADA' }),
    listarAtivacoes: vi.fn().mockResolvedValue([]),
    reverter: vi.fn().mockResolvedValue({ ...revisao, ativa: true }),
  };
}
function mostrar(repo: RepositorioConfigV2) { return render(<MemoryRouter><ConfiguracoesV2Page repositorio={repo}/></MemoryRouter>); }

beforeEach(() => { auth.isFounder = false; auth.userId = 'fundador-a'; });
afterEach(() => { vi.restoreAllMocks(); });

it('não consulta nem mostra o editor para quem não é fundador', () => {
  const repo = repositorio();
  mostrar(repo);
  expect(screen.getByText('Acesso restrito')).toBeTruthy();
  expect(repo.listar).not.toHaveBeenCalled();
  expect(screen.queryByText('Configuração e revisões')).toBeNull();
});

it('mostra ausência real de revisões sem inventar conteúdo', async () => {
  auth.isFounder = true;
  const repo = repositorio();
  vi.mocked(repo.listar).mockResolvedValue([]);
  mostrar(repo);
  expect(await screen.findByText('Nenhuma configuração cadastrada')).toBeTruthy();
  expect(screen.getByLabelText('Importar configuração existente em JSON')).toBeTruthy();
  expect(screen.queryByText('Configuração existente')).toBeNull();
});

it('edita campos do rascunho e salva com UUID e versão esperada', async () => {
  auth.isFounder = true;
  const repo = repositorio();
  mostrar(repo);
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  fireEvent.click(await screen.findByRole('button', { name: /isabela.yaml/ }));
  fireEvent.change(screen.getByDisplayValue('Texto registrado'), { target: { value: 'Texto atualizado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
  await waitFor(() => expect(repo.salvar).toHaveBeenCalledWith({
    id: 'uuid-a', versao_esperada: 3, nome: 'Configuração existente',
    conteudo: { 'helena-v2/agents/isabela.yaml': { missao: 'Texto atualizado', servicos: ['SRV-COPY'] } },
  }));
});

it('solicita validação pelo banco e só ativa revisão validada usando CAS', async () => {
  auth.isFounder = true;
  const pendente = { ...base, validacao_pendente: true };
  const repoPendente = repositorio(pendente);
  const tela = mostrar(repoPendente);
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  expect(screen.queryByRole('button', { name: 'Ativar revisão' })).toBeNull();
  expect(await screen.findByText(/Aguardando validação técnica/)).toBeTruthy();
  tela.unmount();

  const validada: ConfigDetail = { ...base, estado: 'VALIDADA', id: 'uuid-validada', versao: 4 };
  const ativa: ConfigRevision = { ...base, id: 'uuid-ativa', estado: 'VALIDADA', ativa: true };
  const repo = repositorio(validada);
  vi.mocked(repo.listar).mockResolvedValue([ativa, validada]);
  mostrar(repo);
  await screen.findByText('Versão 4 · validada');
  fireEvent.click(screen.getAllByRole('button', { name: /Configuração existente/ })[1]);
  fireEvent.click(await screen.findByRole('button', { name: 'Ativar revisão' }));
  await waitFor(() => expect(repo.ativar).toHaveBeenCalledWith('uuid-validada', 'uuid-ativa'));
});

it('atualiza o detalhe após a validação e habilita a ativação', async () => {
  auth.isFounder = true;
  const pendente: ConfigDetail = { ...base, validacao_pendente: true };
  const validada: ConfigDetail = { ...base, estado: 'VALIDADA', validacao_pendente: false };
  const repo = repositorio(pendente);
  vi.mocked(repo.ler).mockResolvedValueOnce(pendente).mockResolvedValueOnce(validada);
  vi.mocked(repo.listar).mockResolvedValueOnce([pendente]).mockResolvedValueOnce([validada]);
  mostrar(repo);
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  await screen.findByText(/Aguardando validação técnica/);
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar estado' }));
  expect(await screen.findByRole('button', { name: 'Ativar revisão' })).toBeTruthy();
});

it('bloqueia mutações enquanto o detalhe está carregando', async () => {
  auth.isFounder = true;
  const repo = repositorio();
  let liberar!: (valor: ConfigDetail) => void;
  vi.mocked(repo.ler).mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; }));
  mostrar(repo);
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull();
  expect(repo.salvar).not.toHaveBeenCalled();
  liberar(base);
  expect(await screen.findByText('Editar documentos')).toBeTruthy();
});

it('não salva texto JSON avançado antes de ser aplicado', async () => {
  auth.isFounder = true;
  const repo = repositorio();
  mostrar(repo);
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  fireEvent.click(await screen.findByRole('button', { name: /isabela.yaml/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar JSON avançado' }));
  fireEvent.change(screen.getByLabelText('JSON do documento'), { target: { value: '{"missao":"alterada"}' } });
  expect((screen.getByRole('button', { name: 'Solicitar validação' }) as HTMLButtonElement).disabled).toBe(true);
  expect(await screen.findByText(/Aplique ou descarte o JSON avançado/)).toBeTruthy();
  expect(repo.salvar).not.toHaveBeenCalled();
});

it('limpa a revisão anterior ao trocar a identidade do fundador', async () => {
  auth.isFounder = true;
  const repo = repositorio();
  const tela = mostrar(repo);
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  expect(await screen.findByText('Editar documentos')).toBeTruthy();
  auth.userId = 'fundador-b';
  tela.rerender(<MemoryRouter><ConfiguracoesV2Page repositorio={repo}/></MemoryRouter>);
  expect(screen.queryByText('Editar documentos')).toBeNull();
  await waitFor(() => expect(repo.listar).toHaveBeenCalledTimes(2));
});

it.each([
  [{ ...base, estado: 'VALIDADA' as const, ativa: true }, 'Ative outra revisão antes de inativar esta.'],
  [{ ...base, estado: 'VALIDADA' as const, tecnica: true }, 'Base técnica preservada: esta revisão não pode ser inativada.'],
])('impede inativar revisão em uso pelo banco', async (revisao, aviso) => {
  auth.isFounder = true;
  const repo = repositorio(revisao);
  mostrar(repo);
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  expect(await screen.findByText(aviso)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Inativar' }) as HTMLButtonElement).disabled).toBe(true);
  expect(repo.aposentar).not.toHaveBeenCalled();
});

it('aceita novo documento apenas com nome minúsculo permitido pelo backend', async () => {
  auth.isFounder = true;
  mostrar(repositorio());
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  const nome = await screen.findByLabelText('Novo documento');
  const adicionar = screen.getByRole('button', { name: 'Adicionar documento' }) as HTMLButtonElement;
  fireEvent.change(nome, { target: { value: 'helena-v2/agents/Agente_Novo.yaml' } });
  expect(adicionar.disabled).toBe(true);
  fireEvent.change(nome, { target: { value: 'helena-v2/agents/agente_novo.yaml' } });
  expect(adicionar.disabled).toBe(false);
});

it('limita o nome do arquivo a 255 caracteres incluindo .yaml', async () => {
  auth.isFounder = true;
  mostrar(repositorio());
  fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
  const nome = await screen.findByLabelText('Novo documento');
  const adicionar = screen.getByRole('button', { name: 'Adicionar documento' }) as HTMLButtonElement;
  fireEvent.change(nome, { target: { value: `helena-v2/agents/${'a'.repeat(250)}.yaml` } });
  expect(adicionar.disabled).toBe(false);
  fireEvent.change(nome, { target: { value: `helena-v2/agents/${'a'.repeat(251)}.yaml` } });
  expect(adicionar.disabled).toBe(true);
});

// --- histórico de ativações e reversão (0019) ---
const ativa: ConfigDetail = { ...base, id: 'uuid-ativa', nome: 'Revisão ativa', versao: 5, estado: 'VALIDADA', ativa: true };
const anterior: ConfigDetail = { ...base, id: 'uuid-anterior', nome: 'Revisão anterior', versao: 4, estado: 'VALIDADA', ativa: false };
const ativacao = (parcial: Partial<AtivacaoConfig> = {}): AtivacaoConfig => ({
  id: 2, tipo: 'ATIVACAO', ativada_por: 'fundador-a', ativada_em: '2026-10-13T15:30:00Z',
  configuracao_id: 'uuid-ativa', configuracao_nome: 'Revisão ativa', configuracao_versao: 5,
  anterior_id: 'uuid-anterior', anterior_nome: 'Revisão anterior', anterior_versao: 4, anterior_estado: 'VALIDADA', ...parcial,
});
function repoComAtivacoes(ativacoes: AtivacaoConfig[], lista: ConfigRevision[] = [ativa, anterior]) {
  const repo = repositorio(ativa);
  vi.mocked(repo.listar).mockResolvedValue(lista);
  vi.mocked(repo.listarAtivacoes).mockResolvedValue(ativacoes);
  return repo;
}
const botaoReverter = () => screen.getByRole('button', { name: 'Reverter para a revisão anterior' }) as HTMLButtonElement;

it('lista as últimas ativações com quem e quando, e distingue reversão e primeira ativação', async () => {
  auth.isFounder = true;
  const repo = repoComAtivacoes([
    ativacao({ id: 3, tipo: 'REVERSAO', configuracao_id: 'uuid-anterior', configuracao_nome: 'Revisão anterior', configuracao_versao: 4, anterior_id: 'uuid-ativa', anterior_nome: 'Revisão ativa', anterior_versao: 5 }),
    ativacao({ id: 2, ativada_por: '11111111-2222-3333-4444-555555555555' }),
    ativacao({ id: 1, configuracao_id: 'uuid-anterior', configuracao_nome: 'Revisão anterior', configuracao_versao: 4, anterior_id: null, anterior_nome: null, anterior_versao: null, anterior_estado: null }),
  ]);
  mostrar(repo);
  const secao = await screen.findByRole('region', { name: 'Ativações recentes' });
  expect(repo.listarAtivacoes).toHaveBeenCalledWith(10);
  const itens = within(secao).getAllByRole('listitem');
  expect(itens).toHaveLength(3);
  expect(itens[0].textContent).toMatch(/Reversão.*Revisão anterior · versão 4.*Estava ativa: Revisão ativa · versão 5.*Por você · 13\/10\/2026.*12:30/);
  expect(itens[1].textContent).toMatch(/Ativação.*Revisão ativa · versão 5.*Por fundador 11111111 · 13\/10\/2026/);
  expect(itens[2].textContent).toMatch(/Primeira ativação/);
});

it('reverte só depois de confirmar, com a ativa esperada, e atualiza a tela', async () => {
  auth.isFounder = true;
  const repo = repoComAtivacoes([ativacao()]);
  vi.mocked(repo.listar).mockResolvedValueOnce([ativa, anterior]).mockResolvedValue([{ ...ativa, ativa: false }, { ...anterior, ativa: true }]);
  vi.mocked(repo.listarAtivacoes).mockResolvedValueOnce([ativacao()]).mockResolvedValue([
    ativacao({ id: 3, tipo: 'REVERSAO', configuracao_id: 'uuid-anterior', configuracao_nome: 'Revisão anterior', configuracao_versao: 4, anterior_id: 'uuid-ativa', anterior_nome: 'Revisão ativa', anterior_versao: 5 }), ativacao()]);
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  mostrar(repo);
  await screen.findByRole('region', { name: 'Ativações recentes' });
  await waitFor(() => expect(botaoReverter().disabled).toBe(false));
  fireEvent.click(botaoReverter());
  expect(repo.reverter).not.toHaveBeenCalled();           // "Cancelar" na confirmação não faz nada
  fireEvent.click(botaoReverter());
  expect(confirmar).toHaveBeenLastCalledWith(expect.stringContaining('"Revisão anterior" (versão 4)'));
  await waitFor(() => expect(repo.reverter).toHaveBeenCalledWith('uuid-ativa'));
  expect(await screen.findByText(/Configuração revertida para a revisão anterior/)).toBeTruthy();
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Ativações recentes' })).getAllByRole('listitem')).toHaveLength(2));
  expect(repo.reverter).toHaveBeenCalledTimes(1);
});

it.each([
  ['a ativa foi a primeira ativação', ativacao({ anterior_id: null, anterior_nome: null, anterior_versao: null, anterior_estado: null }), /primeira ativação: não há revisão anterior/],
  ['a anterior foi inativada', ativacao({ anterior_estado: 'APOSENTADA' }), /Revisão anterior\) foi inativada e não pode voltar/],
  ['o histórico não confere com a ativa', ativacao({ configuracao_id: 'outra' }), /não confere com a revisão ativa/],
])('desabilita a reversão quando %s', async (_caso, linha, motivo) => {
  auth.isFounder = true;
  const repo = repoComAtivacoes([linha]);
  mostrar(repo);
  await screen.findByRole('region', { name: 'Ativações recentes' });
  expect(botaoReverter().disabled).toBe(true);
  expect(screen.getByText(motivo)).toBeTruthy();
  fireEvent.click(botaoReverter());
  expect(repo.reverter).not.toHaveBeenCalled();
});

it('mostra o erro do banco quando a reversão é recusada e não finge que deu certo', async () => {
  auth.isFounder = true;
  const repo = repoComAtivacoes([ativacao()]);
  vi.mocked(repo.reverter).mockRejectedValue(new Error('A revisão ativa mudou enquanto você olhava. Atualize o estado e confira antes de tentar de novo.'));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mostrar(repo);
  await screen.findByRole('region', { name: 'Ativações recentes' });
  fireEvent.click(botaoReverter());
  expect((await screen.findByRole('alert')).textContent).toMatch(/revisão ativa mudou/);
  expect(screen.queryByText(/Configuração revertida/)).toBeNull();
});

it('falha ao consultar as ativações não derruba a lista de revisões', async () => {
  auth.isFounder = true;
  const repo = repoComAtivacoes([]);
  vi.mocked(repo.listarAtivacoes).mockRejectedValue(new Error('rede'));
  mostrar(repo);
  expect((await screen.findByText(/Não foi possível consultar as ativações\. rede/))).toBeTruthy();
  expect(screen.getByRole('button', { name: /Revisão ativa/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Reverter para a revisão anterior' })).toBeNull();
});

it('quem não é fundador não consulta ativações nem vê o botão de reverter', () => {
  const repo = repoComAtivacoes([ativacao()]);
  mostrar(repo);
  expect(repo.listarAtivacoes).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Reverter para a revisão anterior' })).toBeNull();
});
