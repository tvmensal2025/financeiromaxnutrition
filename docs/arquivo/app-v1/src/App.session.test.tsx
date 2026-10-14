import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null, appAccess: null, loading: false, sair: vi.fn() }),
}));
vi.mock('@/contexts/SessionBusinessBoundary', () => ({
  SessionBusinessBoundary: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="fronteira-da-sessao">{children}</div>,
}));

import App from './App';

it('monta todas as rotas dentro da fronteira que isola o estado da sessão', () => {
  window.history.replaceState({}, '', '/login');
  render(<App />);
  expect(screen.getByTestId('fronteira-da-sessao')).toBeInTheDocument();
});
