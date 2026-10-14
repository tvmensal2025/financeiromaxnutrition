// Prova que as rotas /cards-v2 e /configuracoes-v2 só existem no App quando
// VITE_HELENA_V2_HABILITADA é exatamente 'true'; com qualquer outro valor a URL
// direta cai na rota padrão do app ('*' -> '/') sem montar a página v2.
// O menu (Layout) é coberto em src/components/Layout.flag-v2.test.tsx.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// App.tsx lê a flag ao renderizar as rotas; mesmo assim cada caso faz resetModules + import
// dinâmico para que nenhum valor em cache atravesse os casos. Sob carga isso pode passar de 5 s.
configure({ asyncUtilTimeout: 15_000 });
vi.setConfig({ testTimeout: 30_000 });

const auth = vi.hoisted(() => ({
  estado: { user: null, isMember: false, isFounder: false, loading: false, accessCheckFailed: false, sair: () => {} } as Record<string, unknown>,
}));
vi.mock('@/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => auth.estado,
}));
vi.mock('@/contexts/SessionBusinessBoundary', () => ({
  SessionBusinessBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { Layout: () => <div data-testid="layout"><Outlet /></div> };
});
vi.mock('@/pages/CardV2Page', () => ({ default: () => <p data-testid="pagina-cards-v2">Página Cards v2</p> }));
vi.mock('@/pages/ConfiguracoesV2Page', () => ({ default: () => <p data-testid="pagina-configuracoes-v2">Página Configuração v2</p> }));
vi.mock('@/pages/ComandoPage', () => ({ default: () => <p data-testid="pagina-comando">Sala de comando</p> }));
vi.mock('@/pages/Login', () => ({ default: () => <p data-testid="pagina-login">Login</p> }));

async function abrir(caminho: string, flag: string | undefined) {
  vi.stubEnv('VITE_HELENA_V2_HABILITADA', flag);
  vi.resetModules();
  window.history.replaceState({}, '', caminho);
  const { default: App } = await import('./App');
  return render(<App />);
}

beforeEach(() => {
  auth.estado = { user: { id: 'membro-1' }, isMember: true, isFounder: false, loading: false, accessCheckFailed: false, sair: () => {} };
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('flag VITE_HELENA_V2_HABILITADA desligada', () => {
  const desligadas: [string, string | undefined][] = [
    ['"false"', 'false'], ['vazia', ''], ['ausente', undefined],
    ['"TRUE" (caixa diferente)', 'TRUE'], ['"1"', '1'], ['"true " (espaço)', 'true '],
  ];

  describe.each(desligadas)('com a flag %s', (_rotulo, valor) => {
    it.each(['/cards-v2', '/configuracoes-v2'])('%s não existe: cai na rota padrão e não monta a página v2', async caminho => {
      await abrir(caminho, valor);
      expect(await screen.findByTestId('pagina-comando')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/');
      expect(screen.queryByTestId('pagina-cards-v2')).toBeNull();
      expect(screen.queryByTestId('pagina-configuracoes-v2')).toBeNull();
    });
  });

  it('para visitante sem sessão a rota inexistente também não vaza: vai para /login com redirect para a raiz', async () => {
    auth.estado = { ...auth.estado, user: null, isMember: false };
    await abrir('/cards-v2', 'false');
    expect(await screen.findByTestId('pagina-login')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(new URLSearchParams(window.location.search).get('redirect')).toBe('/');
  });

  it('o resto do app continua funcionando (controle positivo): / abre a sala de comando dentro do Layout', async () => {
    await abrir('/', 'false');
    expect(await screen.findByTestId('pagina-comando')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });
});

describe('flag VITE_HELENA_V2_HABILITADA exatamente "true"', () => {
  it('/cards-v2 existe, dentro do Layout, e a URL permanece', async () => {
    await abrir('/cards-v2', 'true');
    expect(await screen.findByTestId('pagina-cards-v2')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toContainElement(screen.getByTestId('pagina-cards-v2'));
    expect(window.location.pathname).toBe('/cards-v2');
    expect(screen.queryByTestId('pagina-comando')).toBeNull();
  });

  it('/configuracoes-v2 existe, dentro do Layout, e a URL permanece', async () => {
    await abrir('/configuracoes-v2', 'true');
    expect(await screen.findByTestId('pagina-configuracoes-v2')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toContainElement(screen.getByTestId('pagina-configuracoes-v2'));
    expect(window.location.pathname).toBe('/configuracoes-v2');
    expect(screen.queryByTestId('pagina-comando')).toBeNull();
  });

  it('as duas rotas são independentes: abrir uma não monta a outra', async () => {
    await abrir('/cards-v2', 'true');
    await screen.findByTestId('pagina-cards-v2');
    expect(screen.queryByTestId('pagina-configuracoes-v2')).toBeNull();
  });
});
