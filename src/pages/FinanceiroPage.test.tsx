import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
const state = vi.hoisted(() => ({ fail: false, starts: [] as number[] }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({ currentBusinessId: 'BIZ-003', isConsolidated: false, selecionadas: ['BIZ-003'], todasLigadas: false }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => {
  let start = 0;
  const query: any = { select: () => query, order: () => query, eq: () => query, in: () => query, abortSignal: () => query, range: (value: number) => { start = value; return query; }, then: (resolve: (value: unknown) => void) => {
    if (table !== 'financeiro') return Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
    state.starts.push(start);
    if (state.fail) return Promise.resolve({ data: null, count: null, error: { message: 'Connection failed' } }).then(resolve);
    const data = Array.from({ length: start === 0 ? 200 : 1 }, (_, i) => ({ finance_id: `F-${start + i}`, business_id: 'BIZ-003', status: 'RECEBIDO', fluxo: 'ENTRADA', conta_id: 'C1', valor_original: 1, moeda: 'BRL' }));
    return Promise.resolve({ data, count: 201, error: null }).then(resolve);
  } }; return query;
} } }));
import FinanceiroPage from './FinanceiroPage';
beforeEach(() => { state.starts = []; state.fail = false; });
afterEach(cleanup);
describe('financial completeness', () => {
  it('includes transactions after a short server page in the displayed total', async () => {
    render(<MemoryRouter><FinanceiroPage /></MemoryRouter>);
    expect((await screen.findAllByText(/R\$\s*201,00/)).length).toBeGreaterThan(0);
    expect(state.starts).toEqual([0, 200]);
  });
  it('does not render an empty ledger as a successful result after a read failure', async () => {
    state.fail = true;
    render(<MemoryRouter><FinanceiroPage /></MemoryRouter>);
    expect(await screen.findByText('Erro ao carregar registros financeiros')).toBeInTheDocument();
    expect(screen.queryByText('Caixa realizado')).not.toBeInTheDocument();
  });
});
