import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Modulo from './Modulo';

const db = vi.hoisted(() => ({ from: vi.fn(), calls: [] as Array<[string, ...unknown[]]>, result: { data: [] as Record<string, unknown>[], error: null as null | { code: string; message: string }, count: 0 }, write: vi.fn(), insert: vi.fn() }));
const auth = vi.hoisted(() => ({ isFounder: true }));
vi.mock('@/auth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isFounder: auth.isFounder }) }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({ currentBusinessId: 'BIZ-003', isConsolidated: false, selecionadas: ['BIZ-003'], loading: false, error: null, rotulo: 'Humano Digital' }) }));
vi.mock('@/lib/escrita-protegida', () => ({ escreverRegistro: db.write, ehConflitoDeVersao: (code: string) => code === 'PT409', MENSAGEM_CONFLITO: 'Conflito de versão. Seu rascunho foi preservado.', TABELAS_PROTEGIDAS: new Set(['ideias']) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: db.from } }));

function query() {
  const q: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'or', 'ilike', 'order', 'range']) q[method] = (...args: unknown[]) => {
    db.calls.push([method, ...args]);
    return method === 'range' ? Promise.resolve(db.result) : q;
  };
  q.insert = db.insert;
  return q;
}
function open(table: string) { render(<MemoryRouter initialEntries={[`/modulo/${table}`]}><Routes><Route path="/modulo/:tabela" element={<Modulo />} /></Routes></MemoryRouter>); }

describe('Módulo recuperado', () => {
  beforeEach(() => { auth.isFounder = true; db.calls = []; db.result = { data: [], error: null, count: 0 }; db.from.mockReset().mockImplementation(() => query()); db.write.mockReset(); db.insert.mockReset().mockResolvedValue({ error: null }); });
  afterEach(cleanup);

  it('blocks unknown tables without querying Supabase', () => {
    open('pg_authid');
    expect(screen.getByText('Módulo não encontrado')).toBeTruthy();
    expect(db.from).not.toHaveBeenCalled();
  });

  it('keeps archived but uncontracted modules visible without a data query', () => {
    open('configuracao');
    expect(screen.getByText('Consulta indisponível')).toBeTruthy();
    expect(db.from).not.toHaveBeenCalled();
  });

  it('selects only vetted columns, filters business on the server, then pages', async () => {
    db.result = { data: [{ id: 'IDEIA-1', business_id: 'BIZ-003', ideia: 'Ação A', row_version: 2 }], error: null, count: 1 };
    open('ideias');
    expect(await screen.findByText('Ação A')).toBeTruthy();
    const select = db.calls.find(call => call[0] === 'select');
    expect(select?.[1]).toContain('ideia');
    expect(select?.[1]).not.toContain('*');
    expect(db.calls.find(call => call[0] === 'eq')).toEqual(['eq', 'business_id', 'BIZ-003']);
    expect(db.calls.findIndex(call => call[0] === 'eq')).toBeLessThan(db.calls.findIndex(call => call[0] === 'range'));
  });

  it('does not display raw database errors', async () => {
    db.result = { data: [], error: { code: '42501', message: 'SEGREDO_PLANTADO_LOCAL' }, count: 0 };
    open('ideias');
    expect(await screen.findByText('Você não tem permissão para consultar este módulo. Confira a conta usada para entrar.')).toBeTruthy();
    expect(screen.queryByText(/SEGREDO_PLANTADO_LOCAL/)).toBeNull();
  });

  it('preserves edit draft on version conflict', async () => {
    db.result = { data: [{ id: 'IDEIA-1', business_id: 'BIZ-003', ideia: 'Ação A', row_version: 2 }], error: null, count: 1 };
    db.write.mockResolvedValue({ error: { code: 'PT409', message: 'SEGREDO_PLANTADO_LOCAL' } });
    open('ideias');
    fireEvent.click(await screen.findByText('Abrir'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('ideia'), { target: { value: 'Ação B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(db.write).toHaveBeenCalledWith('ideias', 'IDEIA-1', 2, { ideia: 'Ação B' }));
    expect(await screen.findByText('Conflito de versão. Seu rascunho foi preservado.')).toBeTruthy();
    expect((screen.getByLabelText('ideia') as HTMLInputElement).value).toBe('Ação B');
    expect(screen.queryByText(/SEGREDO_PLANTADO_LOCAL/)).toBeNull();
  });

  it('creates an authorized business record with only approved fields', async () => {
    open('ideias');
    fireEvent.click(await screen.findByRole('button', { name: 'Novo registro' }));
    fireEvent.change(screen.getByLabelText('ideia'), { target: { value: 'Ação nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(db.insert).toHaveBeenCalledWith({ ideia: 'Ação nova', id: expect.stringMatching(/^IDEA-[a-f0-9-]{36}$/), business_id: 'BIZ-003' }));
  });
  it('keeps reads available to a member while hiding generic writes', async () => {
    auth.isFounder = false;
    db.result = { data: [{ id: 'IDEIA-1', business_id: 'BIZ-003', ideia: 'Ação A', row_version: 2 }], error: null, count: 1 };
    open('ideias');
    fireEvent.click(await screen.findByText('Abrir'));
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Novo registro' })).toBeNull();
  });
});
