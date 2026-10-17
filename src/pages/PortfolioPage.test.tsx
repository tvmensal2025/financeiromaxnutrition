import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({ read: vi.fn(), select: vi.fn() }));
vi.mock('@/lib/leitura-paginada', () => ({ lerPaginas: mocks.read }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ select: mocks.select }) } }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({ currentBusinessId: 'GRUPO', setCurrentBusiness: vi.fn() }) }));

import PortfolioPage from './PortfolioPage';

beforeEach(() => { vi.clearAllMocks(); });

it('apresenta falha de leitura sem transformar empresas desconhecidas em lista vazia', async () => {
  mocks.read.mockResolvedValueOnce({ data: null, error: new Error('indisponível'), count: null });
  render(<MemoryRouter><PortfolioPage /></MemoryRouter>);
  expect(await screen.findByText('Erro ao carregar o portfólio')).toBeInTheDocument();
  expect(screen.queryByText('Nenhum negócio no portfólio')).not.toBeInTheDocument();
  mocks.read.mockResolvedValueOnce({ data: [{ business_id: 'BIZ-004', negocio: 'eLiving™', estagio: 'VALIDAÇÃO' }], error: null, count: 1 });
  fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
  await waitFor(() => expect(screen.getByText('eLiving™')).toBeInTheDocument());
});
