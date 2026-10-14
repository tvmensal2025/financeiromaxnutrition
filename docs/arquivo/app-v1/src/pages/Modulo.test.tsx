import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Modulo from './Modulo';

const banco = vi.hoisted(() => ({ from: vi.fn(), escrever: vi.fn(), erro: null as null | { code: string; message: string }, escrita: null as null | { code: string; message: string }, rejeitar: false }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: banco.from } }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  currentBusiness: null, currentBusinessId: 'BIZ-003', isConsolidated: false,
  selecionadas: [], rotulo: 'Empresa selecionada', empresas: [],
}) }));
vi.mock('@/lib/tarefa-calendario', () => ({ sincronizarTarefaNoCalendario: vi.fn() }));
vi.mock('@/lib/escrita-protegida', () => ({ escreverRegistro: banco.escrever, TABELAS_PROTEGIDAS: new Set(['tarefas']), ehConflitoDeVersao: (code: unknown) => code === 'PT409' || code === '40001', MENSAGEM_CONFLITO: 'Outra conversa ou pessoa alterou este registro. Seu rascunho foi preservado. Reabra a versão atual e compare antes de salvar.' }));

function consultaVazia(dados: unknown[] = []) {
  const resultado = { data: dados, error: banco.erro, count: dados.length };
  const consulta: Record<string, unknown> = {
    then: (resolver: (valor: typeof resultado) => unknown) => Promise.resolve(resultado).then(resolver),
  };
  for (const metodo of ['select', 'eq', 'range', 'order', 'or', 'in']) consulta[metodo] = () => consulta;
  consulta.insert = () => banco.rejeitar ? Promise.reject(new Error('SEGREDO_PLANTADO_LOCAL')) : Promise.resolve({ error: banco.escrita });
  return consulta;
}

function abrir(tabela: string) {
  render(<MemoryRouter initialEntries={[`/modulo/${encodeURIComponent(tabela)}`]}>
    <Routes><Route path="/modulo/:tabela" element={<Modulo />} /></Routes>
  </MemoryRouter>);
}

describe('Rotas de módulos', () => {
  beforeEach(() => { banco.erro = null; banco.escrita = null; banco.rejeitar = false; banco.escrever.mockReset(); banco.from.mockReset().mockImplementation(() => consultaVazia()); });
  afterEach(cleanup);

  it.each(['tabela_inexistente', 'pg_authid', '__proto__'])('recusa %s sem consultar o banco', async tabela => {
    abrir(tabela);
    expect(await screen.findByRole('heading', { name: 'Módulo não encontrado' })).toBeTruthy();
    expect(banco.from).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /novo registro/i })).toBeNull();
  });

  it('continua lendo um módulo do catálogo', async () => {
    abrir('tarefas');
    await waitFor(() => expect(banco.from).toHaveBeenCalledWith('tarefas'));
    expect(screen.queryByRole('heading', { name: 'Módulo não encontrado' })).toBeNull();
  });

  it('explica a falta de permissão sem expor a resposta técnica', async () => {
    banco.erro = { code: '42501', message: 'SEGREDO_PLANTADO_LOCAL para testar a resposta técnica' };
    abrir('tarefas');
    expect(await screen.findByText('Você não tem permissão para consultar este módulo. Confira a conta usada para entrar.')).toBeTruthy();
    expect(screen.queryByText(/SEGREDO_PLANTADO_LOCAL/)).toBeNull();
  });

  it.each([false, true])('não expõe resposta técnica ao salvar (falha de rede: %s)', async rejeitar => {
    banco.escrita = { code: '42501', message: 'SEGREDO_PLANTADO_LOCAL' };
    banco.rejeitar = rejeitar;
    abrir('tarefas');
    await waitFor(() => expect(banco.from).toHaveBeenCalledWith('tarefas'));
    fireEvent.click(screen.getByRole('button', { name: /novo registro/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getAllByText('Não foi possível salvar o registro. Confira suas permissões e tente novamente.').length).toBeGreaterThan(0));
    expect(screen.queryByText(/SEGREDO_PLANTADO_LOCAL/)).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it.each([false, true])('não expõe resposta técnica ao excluir (falha de rede: %s)', async rejeitar => {
    banco.from.mockImplementation(tabela => consultaVazia(tabela === 'helena_campos'
      ? [{ coluna: 'task_id', chave: 'SIM', calculado: 'NAO', nome_na_planilha: 'Identificador' }]
      : [{ task_id: 'TESTE-LOCAL-1', row_version: 1 }]));
    banco.escrever.mockImplementation(() => rejeitar
      ? Promise.reject(new Error('SEGREDO_PLANTADO_LOCAL'))
      : Promise.resolve({ error: { code: '42501', message: 'SEGREDO_PLANTADO_LOCAL' } }));
    abrir('tarefas');
    fireEvent.click(await screen.findByTitle('Excluir registro'));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir registro' }));
    expect(await screen.findByText('Não foi possível excluir o registro. Confira suas permissões e tente novamente.')).toBeTruthy();
    expect(screen.queryByText(/SEGREDO_PLANTADO_LOCAL/)).toBeNull();
  });

  it('preserva o rascunho e explica conflito de versão ao atualizar', async () => {
    banco.from.mockImplementation(tabela => consultaVazia(tabela === 'helena_campos'
      ? [{ coluna: 'task_id', chave: 'SIM', calculado: 'NAO', nome_na_planilha: 'Identificador' }]
      : [{ task_id: 'TESTE-LOCAL-1', row_version: 1 }]));
    banco.escrever.mockResolvedValue({ error: { code: 'PT409', message: 'SEGREDO_PLANTADO_LOCAL' } });
    abrir('tarefas');
    fireEvent.click(await screen.findByTitle('Editar registro'));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(screen.getAllByText(/Seu rascunho foi preservado/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/SEGREDO_PLANTADO_LOCAL/)).toBeNull();
    expect(screen.getByRole('textbox', { name: /Identificador/ }).getAttribute('value')).toBe('TESTE-LOCAL-1');
  });
});
