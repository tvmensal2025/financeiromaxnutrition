// Prova as rotas da Sala de comando v2: /comando abre a página nova e os endereços antigos da operação
// (/supervisao, /execucao, /entregas, /consumo, /cobertura, /inbox, /caixa-entrada, /central-execucao)
// redirecionam para /comando?aba=<aba>. Fundador entra; membro continua barrado sem redirecionar.
// Só o Supabase e a página são simulados; o roteador, o AuthProvider e a guarda do fundador são os reais.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

configure({ asyncUtilTimeout: 15_000 });
vi.setConfig({ testTimeout: 30_000 });

const sb = vi.hoisted(() => ({ role: 'founder' }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: vi.fn(), signInWithPassword: vi.fn(),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { user_id: 'u1', role: sb.role, active: true }, error: null }) }) }) }),
  },
}));
vi.mock('@/contexts/SessionBusinessBoundary', () => ({ SessionBusinessBoundary: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { Layout: () => <div data-testid="layout"><Outlet /></div> };
});
vi.mock('@/pages/ComandoV2Page', async () => {
  const { useLocation } = await import('react-router-dom');
  function PaginaFalsa() { const { search } = useLocation(); return <h1>Sala de comando {search}</h1>; }
  return { default: PaginaFalsa };
});

import App from './App';

const abrir = (caminho: string) => { window.history.replaceState({}, '', caminho); return render(<App />); };
beforeEach(() => { sb.role = 'founder'; });
afterEach(() => cleanup());

describe('rotas da Sala de comando', () => {
  it('/comando abre a Sala de comando para o fundador', async () => {
    abrir('/comando?aba=agentes');
    expect(await screen.findByRole('heading', { name: 'Sala de comando ?aba=agentes' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/comando');
  });

  it.each([
    ['/supervisao', 'supervisao'], ['/execucao', 'execucao'], ['/entregas', 'entregas'], ['/consumo', 'consumo'],
    ['/cobertura', 'cobertura'], ['/inbox', 'supervisao'], ['/caixa-entrada', 'supervisao'], ['/central-execucao', 'execucao'],
  ])('%s redireciona para /comando?aba=%s', async (antigo, aba) => {
    abrir(antigo);
    expect(await screen.findByRole('heading', { name: `Sala de comando ?aba=${aba}` })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/comando');
    expect(window.location.search).toBe(`?aba=${aba}`);
  });

  it('o redirecionamento preserva os outros parâmetros e troca a aba antiga da URL', async () => {
    abrir('/execucao?card=abc&aba=outra');
    expect(await screen.findByRole('heading', { name: /Sala de comando/ })).toBeInTheDocument();
    const busca = new URLSearchParams(window.location.search);
    expect(busca.get('aba')).toBe('execucao');
    expect(busca.get('card')).toBe('abc');
  });

  it('membro continua barrado nos endereços antigos, sem redirecionar às escondidas', async () => {
    sb.role = 'member';
    abrir('/entregas');
    expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/entregas');
  });
});
