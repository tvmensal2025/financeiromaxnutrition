import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MODULOS } from '@/lib/modulos';
import { gruposNavegacao } from '@/lib/navegacao';

configure({ asyncUtilTimeout: 10_000 });
vi.setConfig({ testTimeout: 60_000 });

const mock = vi.hoisted(() => ({
  userId: 'founder-a', role: 'founder',
  portfolio: [{ business_id: 'BIZ-001', negocio: 'Empresa A', row_version: 1 }],
  failTable: '',
  from: vi.fn<(table: string) => unknown>(),
  onAuth: null as null | ((event: string, session: unknown) => void),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        mock.onAuth = callback;
        return { data: { subscription: { unsubscribe: () => { mock.onAuth = null; } } } };
      },
      getSession: async () => ({ data: { session: { user: { id: mock.userId } } }, error: null }),
      signOut: vi.fn(), signInWithPassword: vi.fn(),
    },
    from: (table: string) => {
      mock.from(table);
      if (table === 'app_access') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: { user_id: mock.userId, role: mock.role, active: true }, error: null,
      }) }) }) };
      const rows = table === 'portfolio' ? mock.portfolio : [];
      const result = () => Promise.resolve({ data: rows, error: table === mock.failTable ? { code: '42501' } : null, count: rows.length });
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'or', 'ilike', 'order']) chain[method] = () => chain;
      chain.range = result;
      chain.then = (resolve: (result: unknown) => void, reject: (error: unknown) => void) => result().then(resolve, reject);
      return chain;
    },
  },
}));

vi.mock('@/components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  const { useBusiness } = await import('@/contexts/BusinessContext');
  return { Layout: () => {
    const { empresas } = useBusiness();
    return <div data-testid="layout"><output data-testid="portfolio-session">{empresas.map(empresa => empresa.nome).join(',')}</output><Outlet /></div>;
  } };
});

// Route rendering is checked here; page data contracts have their own focused tests.
vi.mock('@/pages/FinanceiroPage', () => ({ default: () => <h1>Financeiro</h1> }));
vi.mock('@/pages/CrmPage', () => ({ default: () => <h1>CRM</h1> }));
vi.mock('@/pages/CalendarioPage', () => ({ default: () => <h1>Calendário</h1> }));
vi.mock('@/pages/PortfolioPage', () => ({ default: () => <h1>Portfólio</h1> }));
vi.mock('@/pages/EquipeV2Page', () => ({ default: () => <h1>Equipe</h1> }));
vi.mock('@/pages/IntegracoesV2Page', () => ({ default: () => <h1>Integrações</h1> }));
vi.mock('@/pages/IdentidadePage', () => ({ default: () => <h1>Identidade</h1> }));
vi.mock('@/pages/IndicadoresPage', () => ({ default: () => <h1>Indicadores</h1> }));

import App from './App';

const open = (path: string) => { window.history.replaceState({}, '', path); return render(<App />); };
const go = async (path: string) => { await act(async () => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }); };
const canonicalReads = () => mock.from.mock.calls.map(([table]) => table).filter(table => table !== 'app_access');

beforeEach(() => {
  mock.userId = 'founder-a'; mock.role = 'founder';
  mock.portfolio = [{ business_id: 'BIZ-001', negocio: 'Empresa A', row_version: 1 }];
  mock.failTable = '';
  mock.from.mockClear(); mock.onAuth = null; localStorage.clear();
});
afterEach(() => cleanup());

it('blocks every restored founder area for a member without reading canonical business tables', async () => {
  mock.role = 'member';
  open('/financeiro');
  expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
  for (const path of ['/crm', '/calendario', '/portfolio', '/empresas', '/identidade', '/indicadores', '/modulo/tarefas', '/comando', '/sistema', '/equipe', '/integracoes', '/conversa', '/execucao', '/entregas', '/consumo', '/cobertura', '/supervisao']) {
    await go(path);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument());
  }
  expect(canonicalReads()).toEqual([]);
});

it('gives all 56 catalog entries a route and shows an explicit read failure', async () => {
  expect(MODULOS).toHaveLength(56);
  const destinations = new Set(gruposNavegacao(true).flatMap(group => group.itens.map(item => item.to)));
  for (const module of MODULOS) expect(destinations.has(module.rota || `/modulo/${module.tabela}`)).toBe(true);

  mock.failTable = 'sistema_vivo';
  open('/modulo/sistema_vivo');
  expect(await screen.findByRole('heading', { name: 'Sistema Vivo' })).toBeInTheDocument();
  expect(await screen.findByText('Você não tem permissão para consultar este módulo. Confira a conta usada para entrar.')).toBeInTheDocument();
  expect(canonicalReads()).toContain('sistema_vivo');

  const dedicated: Record<string, string> = {
    portfolio: 'Portfólio', crm: 'CRM', calendario: 'Calendário', financeiro: 'Financeiro',
    equipe: 'Equipe', integracoes: 'Integrações',
  };
  for (const module of MODULOS) {
    await go(module.rota || `/modulo/${module.tabela}`);
    expect(await screen.findByRole('heading', { name: dedicated[module.tabela] || module.titulo })).toBeInTheDocument();
  }

  await go('/endereco-sem-rota');
  expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/endereco-sem-rota');
});

it('discards portfolio immediately when the authenticated role changes', async () => {
  open('/modulo/sistema_vivo');
  expect(await screen.findByRole('heading', { name: 'Sistema Vivo' })).toBeInTheDocument();
  expect(screen.getByTestId('portfolio-session')).toHaveTextContent('Empresa A');
  await waitFor(() => expect(canonicalReads()).toContain('portfolio'));
  mock.role = 'member';
  await act(async () => { mock.onAuth?.('SIGNED_IN', { user: { id: mock.userId } }); });
  expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
  expect(screen.getByTestId('portfolio-session')).toBeEmptyDOMElement();
  expect(canonicalReads()).toEqual(['portfolio', 'sistema_vivo']);
});
