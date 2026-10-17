import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

const mock = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, select: vi.fn() }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  currentBusinessId: 'GRUPO', isConsolidated: true, selecionadas: ['BIZ-001', 'BIZ-004'], setCurrentBusiness: mock.select,
}) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => {
  const query = {
    select: () => query, order: () => query, in: () => query, returns: () => query, range: () => query,
    then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve({
      data: mock.rows[table] ?? [], count: (mock.rows[table] ?? []).length, error: null,
    }).then(resolve, reject),
  };
  return query;
} } }));

import IndicadoresPage from './IndicadoresPage';

const abrir = () => render(<MemoryRouter><IndicadoresPage /></MemoryRouter>);
beforeEach(() => { mock.rows = {}; mock.select.mockReset(); });
afterEach(() => cleanup());

it('com banco vazio explica cada número ausente e oferece atalhos', async () => {
  abrir();
  await screen.findByRole('heading', { name: 'Indicadores do negócio' });
  expect(screen.getByRole('note', { name: 'Origem dos dados' })).toHaveTextContent('foco_executivo, portfolio, crm, financeiro, riscos');
  expect(screen.getByText('Nenhum lançamento liquidado encontrado.')).toBeInTheDocument();
  expect(screen.getByText('Sem oportunidades abertas para ponderar.')).toBeInTheDocument();
  expect(screen.getByText('Nenhuma entrada liquidada neste mês.')).toBeInTheDocument();
  expect(screen.getByText(/Nenhum foco executivo cadastrado/)).toBeInTheDocument();
  const atalhos = screen.getByRole('navigation', { name: 'Atalhos' });
  expect(atalhos.querySelectorAll('a')).toHaveLength(4);
  expect(screen.getByRole('link', { name: /Financeiro/ })).toHaveAttribute('href', '/financeiro');
});

it('lista riscos pelo maior impacto e as empresas do grupo com ação para abri-las', async () => {
  mock.rows.riscos = [
    { risk_id: 'R1', business_id: 'BIZ-001', risco: 'Risco baixo', impacto: 'BAIXO', status: 'ABERTO' },
    { risk_id: 'R2', business_id: 'BIZ-004', risco: 'Risco alto', impacto: 'ALTO', status: 'ABERTO' },
    { risk_id: 'R3', business_id: 'BIZ-004', risco: 'Risco tratado', impacto: 'ALTO', status: 'FECHADO' },
  ];
  mock.rows.portfolio = [{ business_id: 'BIZ-004', negocio: 'eLiving™', kpi_principal: 'Usuários ativos', principal_gargalo: null, objetivo_atual: null }];
  abrir();
  await screen.findByText('Risco alto');
  expect(screen.getByText(/2 em aberto/)).toBeInTheDocument();
  expect(screen.queryByText('Risco tratado')).not.toBeInTheDocument();
  const textos = screen.getAllByText(/^Risco (alto|baixo)$/).map((el) => el.textContent);
  expect(textos).toEqual(['Risco alto', 'Risco baixo']);
  expect(screen.getByText('KPI: Usuários ativos')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Ver empresa/ }));
  expect(mock.select).toHaveBeenCalledWith('BIZ-004');
});
