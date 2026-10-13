import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ConfigDetail, ConfigRevision, RepositorioConfigV2 } from '@/integrations/config-v2/repository';
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
  };
}
function mostrar(repo: RepositorioConfigV2) { return render(<MemoryRouter><ConfiguracoesV2Page repositorio={repo}/></MemoryRouter>); }

beforeEach(() => { auth.isFounder = false; auth.userId = 'fundador-a'; });

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
