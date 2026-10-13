import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './auth';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), from: vi.fn(), signOut: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: mocks, from: mocks.from } }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const session = (id: string) => ({ user: { id } }) as Session;
const access = (id: string) => ({ data: { user_id: id, role: 'founder', active: true }, error: null });
let authAtual: ReturnType<typeof useAuth>;
const consultas: { id: string; request: ReturnType<typeof deferred<ReturnType<typeof access>>> }[] = [];
let notify: (_event: string, value: Session | null) => void;
const pending = new Map<string, ReturnType<typeof deferred<ReturnType<typeof access>>>>();
function Probe() { const auth = useAuth(); authAtual = auth; return <div><span>{auth.user?.id ?? 'sem sessão'}</span><span>{auth.isFounder ? 'fundador' : 'sem permissão'}</span><span>{auth.loading ? 'validando' : 'carregado'}</span><span>{auth.appAccess?.user_id ?? 'sem cadastro'}</span></div>; }
beforeEach(() => {
  vi.clearAllMocks(); pending.clear(); consultas.length = 0;
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockImplementation(callback => { notify = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; });
  mocks.from.mockImplementation(() => ({ select: () => ({ eq: (_: string, id: string) => ({ maybeSingle: () => {
    const request = deferred<ReturnType<typeof access>>(); pending.set(id, request); consultas.push({ id, request }); return request.promise;
  } }) }) }));
});
afterEach(cleanup);

describe('sessão e permissões reais', () => {
  it('descarta a consulta de permissão que terminou depois de sair', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('carregado');
    act(() => notify('SIGNED_IN', session('sessao-A')));
    await waitFor(() => expect(pending.has('sessao-A')).toBe(true));
    act(() => notify('SIGNED_OUT', null));
    await act(async () => pending.get('sessao-A')!.resolve(access('sessao-A')));
    expect(screen.getByText('sem sessão')).toBeInTheDocument();
    expect(screen.getByText('sem permissão')).toBeInTheDocument();
  });
  it('não troca uma sessão nova pela resposta inicial atrasada', async () => {
    const initial = deferred<{ data: { session: Session }; error: null }>();
    mocks.getSession.mockReturnValue(initial.promise);
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => notify('SIGNED_IN', session('sessao-B')));
    await act(async () => initial.resolve({ data: { session: session('sessao-A') }, error: null }));
    expect(screen.getByText('sessao-B')).toBeInTheDocument();
  });
  it('limpa a permissão anterior ao trocar de pessoa', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('carregado');
    act(() => notify('SIGNED_IN', session('sessao-A')));
    await waitFor(() => expect(pending.has('sessao-A')).toBe(true));
    await act(async () => pending.get('sessao-A')!.resolve(access('sessao-A')));
    expect(screen.getByText('fundador')).toBeInTheDocument();
    act(() => notify('SIGNED_IN', session('sessao-B')));
    expect(screen.getByText('sem permissão')).toBeInTheDocument();
    expect(screen.getByText('validando')).toBeInTheDocument();
  });
});

it('não reaproveita permissão de um login que terminou após outra sessão', async () => {
  mocks.signInWithPassword.mockImplementation(async () => {
    notify('SIGNED_IN', session('sessao-A'));
    return { data: { user: { id: 'sessao-A' } }, error: null };
  });
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('carregado');
  let login!: Promise<string | null>;
  act(() => { login = authAtual.entrar('local@example.test', 'fixture-local'); });
  await waitFor(() => expect(consultas.some(c => c.id === 'sessao-A')).toBe(true));
  act(() => notify('SIGNED_IN', session('sessao-B')));
  await act(async () => {
    for (const c of consultas.filter(c => c.id === 'sessao-A')) c.request.resolve(access('sessao-A'));
    await login;
  });
  expect(screen.getByText('sessao-B')).toBeInTheDocument();
  expect(screen.getByText('sem cadastro')).toBeInTheDocument();
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it('não anuncia saída se o serviço recusou encerrar a sessão', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('carregado');
  act(() => notify('SIGNED_IN', session('sessao-A')));
  await waitFor(() => expect(pending.has('sessao-A')).toBe(true));
  await act(async () => pending.get('sessao-A')!.resolve(access('sessao-A')));
  mocks.signOut.mockResolvedValue({ error: { message: 'offline' } });
  await act(async () => { await authAtual.sair(); });
  expect(screen.getAllByText('sessao-A').length).toBeGreaterThan(0);
  expect(screen.queryByText('sem sessão')).not.toBeInTheDocument();
});

it('sai do carregamento quando a saída falha durante a validação', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('carregado');
  act(() => notify('SIGNED_IN', session('sessao-A')));
  await waitFor(() => expect(pending.has('sessao-A')).toBe(true));
  mocks.signOut.mockResolvedValue({ error: { message: 'offline' } });
  await act(async () => { await authAtual.sair(); });
  expect(screen.getByText('carregado')).toBeInTheDocument();
  expect(authAtual.accessCheckFailed).toBe(true);
  expect(authAtual.appAccess).toBeNull();
});
