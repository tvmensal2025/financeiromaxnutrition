import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), businesses: [] as { business_id: string; nome: string }[] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ isFounder: false }) }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({ currentBusinessId: 'GRUPO', businesses: mocks.businesses }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/lib/escrita-protegida', () => ({ escreverRegistro: vi.fn(), ehConflitoDeVersao: () => false }));

import IdentidadePage from './IdentidadePage';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.businesses = [{ business_id: 'BIZ-001', nome: 'iGreen' }, { business_id: 'BIZ-004', nome: 'eLiving™' }];
  mocks.from.mockImplementation(() => ({ select: () => ({ eq: (_: string, id: string) => ({ single: async () => ({ data: { business_id: id, negocio: id, row_version: 3 }, error: null }) }) }) }));
});

it('sem empresa escolhida lista as empresas para abrir a identidade e mostra a origem', async () => {
  render(<MemoryRouter initialEntries={['/identidade']}><IdentidadePage /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Identidade da empresa' })).toBeInTheDocument();
  expect(screen.getByRole('note', { name: 'Origem dos dados' })).toHaveTextContent('nenhuma empresa selecionada');
  fireEvent.click(screen.getByRole('button', { name: /eLiving™/ }));
  expect(await screen.findByText('Cores e tipografia')).toBeInTheDocument();
  expect(screen.getByRole('note', { name: 'Origem dos dados' })).toHaveTextContent('eLiving™');
});

it('sem empresas disponíveis orienta o caminho em vez de mostrar uma lista vazia', () => {
  mocks.businesses = [];
  render(<MemoryRouter initialEntries={['/identidade']}><IdentidadePage /></MemoryRouter>);
  expect(screen.getByText(/Nenhuma empresa do portfólio está disponível/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'portfólio' })).toHaveAttribute('href', '/portfolio');
});
