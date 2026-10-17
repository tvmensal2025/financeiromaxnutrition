import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/lib/leitura-paginada', () => ({ lerPaginas: mocks.read }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ select: vi.fn() }) } }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({ currentBusinessId: 'GRUPO', setCurrentBusiness: vi.fn() }) }));

import PortfolioPage from './PortfolioPage';

const empresas = [
  { business_id: 'BIZ-002', negocio: 'Ecossistema de Saúde', estagio: 'VALIDAÇÃO', kpi_principal: 'Retenção em 90 dias' },
  { business_id: 'BIZ-001', negocio: 'iGreen', estagio: 'OPERAÇÃO', principal_gargalo: 'Conversão de leads' },
  { business_id: 'BIZ-004', negocio: 'eLiving™', estagio: 'PRÉ-LANÇAMENTO', ativo: 'NÃO' },
];
const titulos = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ data: empresas, error: null, count: 3 });
});

it('mostra o selo de origem e ordena por ID, nome e estágio', async () => {
  render(<MemoryRouter><PortfolioPage /></MemoryRouter>);
  await screen.findByText('iGreen');
  const selo = screen.getByRole('note', { name: 'Origem dos dados' });
  expect(selo).toHaveTextContent('portfolio');
  expect(selo).toHaveTextContent('3 empresas');
  expect(titulos()).toEqual(['iGreen', 'Ecossistema de Saúde', 'eLiving™']);
  fireEvent.change(screen.getByLabelText('Ordenar empresas'), { target: { value: 'nome' } });
  expect(titulos()).toEqual(['Ecossistema de Saúde', 'eLiving™', 'iGreen']);
  fireEvent.change(screen.getByLabelText('Ordenar empresas'), { target: { value: 'estagio' } });
  expect(titulos()).toEqual(['iGreen', 'eLiving™', 'Ecossistema de Saúde']);
});

it('filtra por busca sem acento e por estágio, com estado vazio que limpa os filtros', async () => {
  render(<MemoryRouter><PortfolioPage /></MemoryRouter>);
  await screen.findByText('iGreen');
  fireEvent.change(screen.getByLabelText('Buscar empresa'), { target: { value: 'retencao' } });
  expect(titulos()).toEqual(['Ecossistema de Saúde']);
  expect(screen.getByText('1 de 3 empresas')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Buscar empresa'), { target: { value: 'zzz' } });
  expect(screen.getByText('Nenhuma empresa corresponde aos filtros')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(titulos()).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('Filtrar por estágio'), { target: { value: 'OPERAÇÃO' } });
  expect(titulos()).toEqual(['iGreen']);
});

it('oculta empresas inativas quando solicitado', async () => {
  render(<MemoryRouter><PortfolioPage /></MemoryRouter>);
  await screen.findByText('iGreen');
  fireEvent.click(screen.getByLabelText(/Ocultar inativas \(1\)/));
  expect(screen.queryByText('eLiving™')).not.toBeInTheDocument();
});
