import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], founder: true }));
vi.mock('@/auth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isFounder: mocks.founder }) }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  empresas: [{ id: 'BIZ-001', nome: 'iGreen', sigla: 'iGreen', cor: '#007A3D' }, { id: 'BIZ-004', nome: 'eLiving', sigla: 'eLiving', cor: '#0EA5E9' }],
  currentBusiness: null, currentBusinessId: 'GRUPO', isConsolidated: true, selecionadas: ['BIZ-001', 'BIZ-004'], rotulo: 'Grupo consolidado',
}) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => {
  const query = {
    select: () => query, in: () => query, order: () => query,
    range: () => Promise.resolve({ data: mocks.rows, count: mocks.rows.length, error: null }),
  };
  return query;
} } }));

import CrmPage from './CrmPage';

const op = (id: string, lead: string, extra: Record<string, unknown> = {}) => ({
  opportunity_id: id, business_id: 'BIZ-001', empresa_lead: lead, etapa: 'PROSPECCAO', status: 'ATIVO',
  valor_potencial: 1000, probabilidade: 10, ...extra,
});
const abrir = () => render(<MemoryRouter><CrmPage /></MemoryRouter>);

beforeEach(() => { mocks.founder = true; mocks.rows = []; });

it('sem oportunidades mostra estado vazio útil em vez de sete colunas vazias', async () => {
  abrir();
  expect(await screen.findByText('Nenhuma oportunidade no pipeline')).toBeInTheDocument();
  expect(screen.queryByText(/Nenhuma oportunidade em Prospecção/)).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Nova oportunidade' })).toHaveLength(2);
});

it('mostra a origem, filtra por etapa e por empresa e ordena a tabela por valor', async () => {
  mocks.rows = [
    op('1', 'Lead Alfa', { valor_potencial: 500, etapa: 'PROPOSTA' }),
    op('2', 'Lead Beta', { valor_potencial: 9000, etapa: 'PROSPECCAO', business_id: 'BIZ-004' }),
    op('3', 'Lead Gama', { valor_potencial: 2500, etapa: 'PROPOSTA' }),
  ];
  abrir();
  await screen.findByText(/Lead Alfa/);
  expect(screen.getByRole('note', { name: 'Origem dos dados' })).toHaveTextContent('3 oportunidades');

  const grupoEtapas = screen.getByRole('group', { name: 'Filtrar por etapa' });
  fireEvent.click(within(grupoEtapas).getByRole('button', { name: /Proposta \(2\)/ }));
  expect(screen.queryByText(/Lead Beta/)).not.toBeInTheDocument();
  expect(screen.getByText(/Lead Gama/)).toBeInTheDocument();

  fireEvent.click(within(grupoEtapas).getByRole('button', { name: /Todas/ }));
  fireEvent.change(screen.getByLabelText('Filtrar por empresa'), { target: { value: 'BIZ-004' } });
  expect(screen.getByText(/Lead Beta/)).toBeInTheDocument();
  expect(screen.queryByText(/Lead Alfa/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filtrar por empresa'), { target: { value: 'TODAS' } });

  fireEvent.click(screen.getByRole('button', { name: /Tabela/ }));
  fireEvent.change(screen.getByLabelText('Ordenar oportunidades'), { target: { value: 'valor' } });
  const linhas = screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
  expect(linhas[0]).toContain('Lead Beta');
  expect(linhas[1]).toContain('Lead Gama');
  expect(linhas[2]).toContain('Lead Alfa');
});

it('busca sem resultado oferece limpar os filtros', async () => {
  mocks.rows = [op('1', 'Lead Alfa')];
  abrir();
  await screen.findByText(/Lead Alfa/);
  fireEvent.change(screen.getByLabelText('Buscar oportunidade'), { target: { value: 'inexistente' } });
  expect(screen.getByText('Nenhuma oportunidade corresponde aos filtros')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(screen.getByText(/Lead Alfa/)).toBeInTheDocument();
});

it('avisa quando há oportunidade com etapa fora do funil padrão', async () => {
  mocks.rows = [op('1', 'Lead Alfa', { etapa: 'EM_ESPERA' })];
  abrir();
  expect(await screen.findByText(/etapa fora do funil padrão/)).toBeInTheDocument();
});
