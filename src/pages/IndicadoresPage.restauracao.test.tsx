import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

const mock = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  failTable: '',
  ranges: [] as Array<{ table: string; start: number; end: number }>,
}));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  currentBusinessId: 'GRUPO', isConsolidated: true, selecionadas: ['BIZ-001'],
}) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => {
  let start = 0;
  let end = 999;
  const query = {
    select: () => query, order: () => query, in: () => query,
    range: (from: number, to: number) => { start = from; end = to; return query; },
    returns: () => query,
    then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
      mock.ranges.push({ table, start, end });
      const rows = mock.rows[table] ?? [];
      return Promise.resolve({
        data: rows.slice(start, Math.min(end + 1, start + 500)), count: rows.length,
        error: table === mock.failTable ? { code: '42501' } : null,
      }).then(resolve, reject);
    },
  };
  return query;
} } }));

import IndicadoresPage from './IndicadoresPage';

const open = () => render(<MemoryRouter><IndicadoresPage /></MemoryRouter>);
beforeEach(() => { mock.rows = {}; mock.failTable = ''; mock.ranges = []; });
afterEach(() => cleanup());

it('includes every capped CRM page in the BRL pipeline total', async () => {
  mock.rows.crm = Array.from({ length: 1001 }, () => ({
    business_id: 'BIZ-001', etapa: 'PROPOSTA', status: 'ABERTO', valor_potencial_brl: 10,
    moeda: 'BRL', probabilidade: 50,
  }));
  open();
  expect(await screen.findByText(/R\$\s*10\.010,00/)).toBeInTheDocument();
  expect(screen.getByText(/R\$\s*5\.005,00/)).toBeInTheDocument();
  expect(mock.ranges.filter(call => call.table === 'crm').map(call => call.start)).toEqual([0, 500, 1000]);
});

it('does not treat an unconverted foreign amount as BRL', async () => {
  mock.rows.crm = [{ business_id: 'BIZ-001', etapa: 'PROPOSTA', status: 'ABERTO',
    valor_potencial: 100, valor_potencial_brl: null, moeda: 'USD', probabilidade: 50 }];
  open();
  await screen.findByRole('heading', { name: 'Indicadores do negócio' });
  expect(screen.queryByText(/R\$\s*100,00/)).toBeNull();
  expect(screen.getByText('1 oportunidade com etapa e status abertos reconhecidos.')).toBeInTheDocument();
});

it('shows a read error instead of partial metrics when one source fails', async () => {
  mock.failTable = 'financeiro';
  open();
  expect(await screen.findByText('Não foi possível carregar o painel')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Indicadores do negócio' })).toBeNull();
  expect(mock.ranges.some(call => call.table === 'financeiro')).toBe(true);
});
