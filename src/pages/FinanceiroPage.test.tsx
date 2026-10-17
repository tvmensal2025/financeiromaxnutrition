import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  write: vi.fn(),
  financeStarts: [] as number[],
}));
vi.mock('@/auth', () => ({ useAuth: () => ({ user: { id: 'founder' }, isFounder: true }) }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  currentBusinessId: 'BIZ-001', isConsolidated: false, selecionadas: ['BIZ-001'],
  todasLigadas: false, nomeDe: (id: string) => id, empresas: [{ id: 'BIZ-001', nome: 'Empresa' }],
}) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => mocks.from(...args) } }));
vi.mock('@/lib/escrita-protegida', () => ({ escreverRegistro: (...args: unknown[]) => mocks.write(...args) }));
import FinanceiroPage from './FinanceiroPage';

const row = (id: string, descricao: string) => ({
  finance_id: id, business_id: 'BIZ-001', descricao, fluxo: 'SAÍDA', status: 'ABERTO',
  valor_original: '10.00', conta_id: 'CONTA-1', competencia: '2026-10', row_version: 7,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.financeStarts = [];
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: () => query, in: () => query, order: () => query,
      range: (start: number) => {
        if (table !== 'financeiro') return Promise.resolve({ data: [], count: 0, error: null });
        mocks.financeStarts.push(start);
        return Promise.resolve({ data: [start === 0 ? row('FIN-1', 'Primeiro') : row('FIN-2', 'Segundo')], count: 2, error: null });
      },
    };
    return query;
  });
});

describe('FinanceiroPage', () => {
  it('lê todas as páginas antes de mostrar os lançamentos', async () => {
    render(<MemoryRouter><FinanceiroPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Lançamentos' }));
    expect(await screen.findByText('Primeiro')).toBeInTheDocument();
    expect(screen.getByText('Segundo')).toBeInTheDocument();
    expect(mocks.financeStarts).toEqual([0, 1]);
  });

  it('mantém a falha de escrita versionada visível e não recarrega dados', async () => {
    mocks.write.mockResolvedValue({ error: { message: 'Conflito de versão' } });
    render(<MemoryRouter><FinanceiroPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Lançamentos' }));
    await screen.findByText('Primeiro');
    fireEvent.click(screen.getAllByTitle('Quitar / Liquidar Lançamento')[0]);
    await waitFor(() => expect(screen.getByText('Conflito de versão')).toBeInTheDocument());
    expect(mocks.write).toHaveBeenCalledWith('financeiro', 'FIN-1', 7, expect.objectContaining({ status: 'PAGO' }));
    expect(mocks.financeStarts).toEqual([0, 1]);
  });
});
