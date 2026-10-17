import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mock = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, role: null as string | null,
    isMember: false, isFounder: false, loading: false, accessCheckFailed: false },
  from: vi.fn(), order: vi.fn(),
}));
vi.mock('@/auth', () => ({ useAuth: () => mock.auth }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mock.from } }));

import { useBusiness } from './BusinessContext';
import { SessionBusinessBoundary } from './SessionBusinessBoundary';

function EmpresasVisiveis() {
  const { empresas } = useBusiness();
  return <p>{empresas.map(empresa => empresa.nome).join(', ') || 'sem empresas'}</p>;
}

beforeEach(() => {
  mock.auth = { user: null, role: null, isMember: false, isFounder: false, loading: false, accessCheckFailed: false };
  mock.from.mockReset();
  mock.order.mockReset();
  mock.from.mockReturnValue({ select: () => ({ order: mock.order }) });
  localStorage.clear();
});

it('descarta imediatamente empresas da conta anterior ao trocar de usuário', async () => {
  mock.auth = { ...mock.auth, user: { id: 'usuario-a' }, role: 'founder', isMember: true, isFounder: true };
  mock.order.mockResolvedValueOnce({ data: [{ business_id: 'BIZ-A', negocio: 'Empresa privada A' }], error: null });
  const view = render(<SessionBusinessBoundary><EmpresasVisiveis /></SessionBusinessBoundary>);
  expect(await screen.findByText('Empresa privada A')).toBeInTheDocument();

  mock.auth = { ...mock.auth, user: { id: 'usuario-b' }, role: 'member', isFounder: false };
  mock.order.mockReturnValueOnce(new Promise(() => {}));
  view.rerender(<SessionBusinessBoundary><EmpresasVisiveis /></SessionBusinessBoundary>);
  expect(screen.queryByText('Empresa privada A')).not.toBeInTheDocument();
  expect(screen.getByText('sem empresas')).toBeInTheDocument();
  expect(mock.from).toHaveBeenCalledTimes(1);
});

it('descarta dados ao perder acesso e ao mudar de papel', async () => {
  mock.auth = { ...mock.auth, user: { id: 'usuario-a' }, role: 'founder', isMember: true, isFounder: true };
  mock.order.mockResolvedValueOnce({ data: [{ business_id: 'BIZ-A', negocio: 'Empresa privada A' }], error: null });
  const view = render(<SessionBusinessBoundary><EmpresasVisiveis /></SessionBusinessBoundary>);
  expect(await screen.findByText('Empresa privada A')).toBeInTheDocument();

  mock.auth = { ...mock.auth, role: 'member', isFounder: false };
  mock.order.mockReturnValueOnce(new Promise(() => {}));
  view.rerender(<SessionBusinessBoundary><EmpresasVisiveis /></SessionBusinessBoundary>);
  expect(screen.getByText('sem empresas')).toBeInTheDocument();

  mock.auth = { ...mock.auth, isMember: false, accessCheckFailed: true };
  view.rerender(<SessionBusinessBoundary><EmpresasVisiveis /></SessionBusinessBoundary>);
  expect(screen.getByText('sem empresas')).toBeInTheDocument();
});

it('não consulta portfólio quando a sessão existe mas o acesso falhou', () => {
  mock.auth = { user: { id: 'usuario-b' }, role: null, isMember: false, isFounder: false,
    loading: false, accessCheckFailed: true };
  render(<SessionBusinessBoundary><EmpresasVisiveis /></SessionBusinessBoundary>);
  expect(screen.getByText('sem empresas')).toBeInTheDocument();
  expect(mock.from).not.toHaveBeenCalled();
});
