import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ user: { id: 'founder' }, isFounder: true }) }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  currentBusinessId: 'GRUPO', isConsolidated: true, selecionadas: ['BIZ-001', 'BIZ-004'],
  todasLigadas: true, nomeDe: (id: string) => (id === 'BIZ-001' ? 'iGreen' : 'eLiving'), empresas: [],
}) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: (tabela: string) => {
  const query = {
    select: () => query, in: () => query, order: () => query,
    range: () => Promise.resolve({ data: tabela === 'financeiro' ? mocks.rows : [], count: tabela === 'financeiro' ? mocks.rows.length : 0, error: null }),
  };
  return query;
} } }));
vi.mock('@/lib/escrita-protegida', () => ({ escreverRegistro: vi.fn() }));

import FinanceiroPage from './FinanceiroPage';

const lanc = (id: string, descricao: string, extra: Record<string, unknown> = {}) => ({
  finance_id: id, business_id: 'BIZ-001', descricao, fluxo: 'SAÍDA', status: 'ABERTO', moeda: 'BRL',
  valor_original: '100.00', valor_brl: '100.00', vencimento: '2026-10-10', competencia: '2026-10', row_version: 1, ...extra,
});
const descricoes = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '');

beforeEach(() => {
  mocks.rows = [
    lanc('F1', 'Aluguel', { vencimento: '2026-10-01', valor_brl: '300.00' }),
    lanc('F2', 'Venda de plano', { fluxo: 'ENTRADA', status: 'RECEBIDO', vencimento: '2026-10-20', valor_brl: '900.00', business_id: 'BIZ-004' }),
    lanc('F3', 'Internet', { vencimento: '2026-10-15', valor_brl: '50.00' }),
  ];
});

it('mostra o selo de origem e atalhos que abrem os lançamentos já filtrados', async () => {
  render(<MemoryRouter><FinanceiroPage /></MemoryRouter>);
  const selo = await screen.findByRole('note', { name: 'Origem dos dados' });
  expect(selo).toHaveTextContent('financeiro');
  expect(selo).toHaveTextContent('3 lançamentos');
  fireEvent.click(await screen.findByRole('button', { name: /Ver a pagar em aberto \(2\)/ }));
  expect(screen.getByLabelText('Filtro de Fluxo')).toHaveValue('SAIDA');
  expect(screen.getByLabelText('Filtro de Status')).toHaveValue('ABERTO');
  expect(screen.queryByText('Venda de plano')).not.toBeInTheDocument();
  expect(screen.getByText('2 de 3 lançamentos', { exact: false })).toBeInTheDocument();
});

it('ordena por data e por valor, filtra por empresa e limpa os filtros', async () => {
  render(<MemoryRouter><FinanceiroPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Lançamentos' }));
  await screen.findByText('Aluguel');
  expect(descricoes()[0]).toContain('Venda de plano');
  fireEvent.change(screen.getByLabelText('Ordenar lançamentos'), { target: { value: 'valor_asc' } });
  expect(descricoes()[0]).toContain('Internet');
  fireEvent.change(screen.getByLabelText('Ordenar lançamentos'), { target: { value: 'vencimento_asc' } });
  expect(descricoes()[0]).toContain('Aluguel');

  fireEvent.change(screen.getByLabelText('Filtro de Empresa'), { target: { value: 'BIZ-004' } });
  expect(descricoes()).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Filtro de Fluxo'), { target: { value: 'SAIDA' } });
  expect(screen.getByText('Nenhum lançamento encontrado')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(descricoes()).toHaveLength(3);
});

it('totais filtrados indicam quando falta valor em BRL', async () => {
  mocks.rows = [lanc('F1', 'Fatura USD', { moeda: 'USD', valor_brl: null, valor_original: '10.00' })];
  render(<MemoryRouter><FinanceiroPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Lançamentos' }));
  expect(await screen.findByText(/Totais em BRL indisponíveis/)).toBeInTheDocument();
});
