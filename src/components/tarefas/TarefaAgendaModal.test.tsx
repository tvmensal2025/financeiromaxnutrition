import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TarefaAgendaModal } from './TarefaAgendaModal';
import { MENSAGEM_CONFLITO } from '@/lib/escrita-protegida';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/supabase', () => ({ supabase: mock }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  isConsolidated: false, currentBusinessId: 'BIZ-001', selecionadas: ['BIZ-001'],
  empresas: [], nomeDe: () => 'Empresa de teste',
}) }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.rows = [{ task_id: 'T1', business_id: 'BIZ-001', tarefa: 'Descrição original', status: 'EM ANDAMENTO', row_version: 8 }];
  mock.from.mockImplementation(() => { const q = { select: () => q, order: () => q, eq: () => q, in: () => q, range: async () => ({ data: mock.rows, count: mock.rows.length, error: null }) }; return q; });
});

describe('Rascunho do modal com concorrência', () => {
  it('mostra o conflito e conserva o texto sem reler ou repetir a escrita', async () => {
    const updated = vi.fn();
    mock.rpc.mockResolvedValue({ data: null, error: { code: '40001' } });
    render(<TarefaAgendaModal aberto onFechar={() => {}} onAtualizado={updated} taskIdInicial="T1" />);
    const field = await screen.findByDisplayValue('Descrição original');
    fireEvent.click(screen.getByText('Editar campos avançados'));
    fireEvent.change(field, { target: { value: 'Meu texto ainda não salvo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_CONFLITO);
    expect(field).toHaveValue('Meu texto ainda não salvo');
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc.mock.calls[0][1].p_expected_version).toBe(8);
    expect(mock.from).toHaveBeenCalledTimes(1);
    expect(updated).not.toHaveBeenCalled();
  });

  it('depois de concluir usa a versão confirmada e conserva uma descrição ainda em edição', async () => {
    mock.rpc.mockImplementation(async (_name, args) => {
      const result = { ...mock.rows[0], ...args.p_changes, row_version: args.p_expected_version + 1 };
      mock.rows = [result];
      return { data: result, error: null };
    });
    render(<TarefaAgendaModal aberto onFechar={() => {}} taskIdInicial="T1" />);
    const field = await screen.findByDisplayValue('Descrição original');
    fireEvent.click(screen.getByText('Editar campos avançados'));
    fireEvent.change(field, { target: { value: 'Descrição que estou editando' } });
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Concluída' })).toBeDisabled());
    expect(field).toHaveValue('Descrição que estou editando');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(2));
    expect(mock.rpc.mock.calls[1][1]).toMatchObject({ p_expected_version: 9, p_changes: { tarefa: 'Descrição que estou editando', status: 'CONCLUÍDA' } });
  });
});
