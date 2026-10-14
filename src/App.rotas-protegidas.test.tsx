// Prova o acesso por URL direta às rotas v2 (flag ligada), com o AuthProvider real
// e só o Supabase simulado: visitante vai a /login?redirect=<caminho codificado> sem
// open redirect; autenticado sem app_access ativo vê a tela de bloqueio e a rota nem
// é montada; membro (não fundador) em /configuracoes-v2 recebe "Acesso restrito" da
// própria página (a rota existe e não redireciona), e só o fundador vê o editor.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// As páginas são carregadas por lazy(); com vários arquivos em paralelo a 1ª carga passa de 1 s.
configure({ asyncUtilTimeout: 15_000 });
vi.setConfig({ testTimeout: 30_000 });

const sb = vi.hoisted(() => ({
  sessao: null as { user: { id: string } } | null,
  acesso: { data: null, error: null } as { data: unknown; error: unknown },
  signOut: vi.fn(),
  consultaAcesso: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: sb.sessao }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: sb.signOut,
      signInWithPassword: vi.fn(),
    },
    from: (tabela: string) => ({
      select: () => ({
        eq: (_coluna: string, id: string) => ({
          maybeSingle: () => { sb.consultaAcesso(tabela, id); return Promise.resolve(sb.acesso); },
        }),
      }),
    }),
  },
}));

const runtime = vi.hoisted(() => ({ cards: vi.fn(), config: vi.fn() }));
vi.mock('@/integrations/cards-v2/runtime', () => ({ repositorioCardsV2DoApp: runtime.cards }));
vi.mock('@/integrations/config-v2/runtime', () => ({ repositorioConfigV2DoApp: runtime.config }));

vi.mock('@/contexts/SessionBusinessBoundary', () => ({
  SessionBusinessBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { Layout: () => <div data-testid="layout"><Outlet /></div>, };
});
vi.mock('@/pages/ComandoPage', () => ({ default: () => <p data-testid="pagina-comando">Sala de comando</p> }));

import App from './App';

const repoCards = () => ({
  listar: vi.fn().mockResolvedValue([]),
  detalhar: vi.fn().mockResolvedValue({ etapas: [], entregas: [] }),
  situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: false, dia_brasilia: '2026-10-13', pedido: null }),
  pedirPublicacao: vi.fn(),
  solicitarCardReal: vi.fn(),
  consultarSolicitacaoPorChave: vi.fn().mockResolvedValue(null),
  listarSolicitacoesReais: vi.fn().mockResolvedValue([]),
  consultarSolicitacaoPorTarefa: vi.fn().mockResolvedValue(null),
  aplicarEventoFundador: vi.fn(),
  consultarToqueFundador: vi.fn().mockResolvedValue(null),
  lerPerguntaEtapaFundador: vi.fn().mockResolvedValue(null),
  lerLeituraCardFundador: vi.fn().mockResolvedValue(null),
});
const repoConfig = () => ({
  listar: vi.fn().mockResolvedValue([]),
  ler: vi.fn(), salvar: vi.fn(), solicitarValidacao: vi.fn(), ativar: vi.fn(), aposentar: vi.fn(),
  listarAtivacoes: vi.fn().mockResolvedValue([]), reverter: vi.fn(),
});

const entrar = (id: string, acesso: { role: string; active: boolean; user_id?: string } | null) => {
  sb.sessao = { user: { id } };
  sb.acesso = { data: acesso && { user_id: id, ...acesso }, error: null };
};
const abrir = (caminho: string) => { window.history.replaceState({}, '', caminho); return render(<App />); };
const conteudoV2 = () => [screen.queryByText('Cards em andamento'), screen.queryByText('Configuração e revisões'),
  screen.queryByTestId('layout'), screen.queryByTestId('pagina-comando')].filter(Boolean);

beforeEach(() => {
  vi.stubEnv('VITE_HELENA_V2_HABILITADA', 'true');
  sb.sessao = null;
  sb.acesso = { data: null, error: null };
  sb.signOut.mockReset().mockResolvedValue({ error: null });
  sb.consultaAcesso.mockReset();
  runtime.cards.mockReset().mockImplementation(async () => repoCards());
  runtime.config.mockReset().mockImplementation(async () => repoConfig());
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('visitante sem sessão abrindo a URL direta', () => {
  it.each([
    ['/cards-v2', '%2Fcards-v2'],
    ['/configuracoes-v2', '%2Fconfiguracoes-v2'],
    ['/cards-v2?card=abc&aba=etapas', '%2Fcards-v2%3Fcard%3Dabc%26aba%3Detapas'],
  ])('%s vai para /login com o destino codificado e não carrega nada da v2', async (caminho, codificado) => {
    abrir(caminho);
    expect(await screen.findByText('Bem-vindo ao seu espaço.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toBe(`?redirect=${codificado}`);
    expect(new URLSearchParams(window.location.search).get('redirect')).toBe(caminho);
    expect(conteudoV2()).toHaveLength(0);
    expect(runtime.cards).not.toHaveBeenCalled();
    expect(runtime.config).not.toHaveBeenCalled();
    expect(sb.consultaAcesso).not.toHaveBeenCalled();
  });

  it.each([
    '/cards-v2?next=https://evil.example/x',
    '/cards-v2?a=1&redirect=https://evil.example/x',
    '/cards-v2?u=//evil.example',
    '/configuracoes-v2?u=%2F%2Fevil.example',
  ])('%s: o redirect gerado é só caminho local, codificado, sem parâmetro extra nem outro domínio', async caminho => {
    const origem = window.location.origin;
    abrir(caminho);
    await screen.findByText('Bem-vindo ao seu espaço.');
    const params = new URLSearchParams(window.location.search);
    expect([...params.keys()]).toEqual(['redirect']);
    const destino = params.get('redirect')!;
    expect(destino).toBe(caminho);
    expect(destino.startsWith('/') && !destino.startsWith('//')).toBe(true);
    expect(new URL(destino, origem).origin).toBe(origem);
    expect(window.location.origin).toBe(origem);
    expect(window.location.pathname).toBe('/login');
    // Na URL do login o conteúdo hostil só existe codificado.
    expect(window.location.search).not.toContain('://');
    expect(window.location.search).not.toContain('//');
  });
});

describe('retorno do login (destino vindo da URL)', () => {
  it('autorizado em /login?redirect=/cards-v2 volta para a rota v2 pedida (controle positivo)', async () => {
    entrar('membro-1', { role: 'member', active: true });
    abrir('/login?redirect=%2Fcards-v2');
    expect(await screen.findByText('Cards em andamento')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/cards-v2');
  });

  it.each(['https://evil.example/x', '//evil.example/x'])('autorizado em /login?redirect=%s não sai do domínio: cai na raiz do app', async externo => {
    const origem = window.location.origin;
    entrar('membro-1', { role: 'member', active: true });
    abrir(`/login?redirect=${encodeURIComponent(externo)}`);
    expect(await screen.findByTestId('pagina-comando')).toBeInTheDocument();
    expect(window.location.origin).toBe(origem);
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByText('Cards em andamento')).toBeNull();
  });
});

describe('autenticado sem app_access ativo abrindo a URL direta', () => {
  const casos: [string, { role: string; active: boolean; user_id?: string } | null][] = [
    ['membro com active=false', { role: 'member', active: false }],
    ['fundador com active=false', { role: 'founder', active: false }],
    ['sem linha em app_access', null],
    ['linha de app_access de outro usuário', { role: 'founder', active: true, user_id: 'outra-pessoa' }],
  ];

  describe.each(casos)('%s', (_rotulo, acesso) => {
    it.each(['/cards-v2', '/configuracoes-v2'])('%s mostra o bloqueio e não monta a rota nem o layout', async caminho => {
      entrar('pessoa-1', acesso);
      abrir(caminho);
      expect(await screen.findByRole('button', { name: 'Sair e Voltar ao Início' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Acesso Não Autorizado' })).toBeInTheDocument();
      expect(window.location.pathname).toBe(caminho);
      expect(conteudoV2()).toHaveLength(0);
      expect(screen.queryByText('Acesso restrito')).toBeNull();
      expect(runtime.cards).not.toHaveBeenCalled();
      expect(runtime.config).not.toHaveBeenCalled();
    });
  });

  it('se a consulta de permissão falha, mostra o alerta de sessão não confirmada e também não monta a rota', async () => {
    entrar('pessoa-1', null);
    sb.acesso = { data: null, error: { message: 'offline' } };
    abrir('/cards-v2');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar sua sessão');
    expect(screen.queryByRole('button', { name: 'Sair e Voltar ao Início' })).toBeNull();
    expect(conteudoV2()).toHaveLength(0);
    expect(runtime.cards).not.toHaveBeenCalled();
  });

  it('"Sair e Voltar ao Início" encerra a sessão no serviço e, sem sessão, o app leva ao /login com o destino pedido', async () => {
    entrar('pessoa-1', { role: 'member', active: false });
    abrir('/cards-v2');
    fireEvent.click(await screen.findByRole('button', { name: 'Sair e Voltar ao Início' }));
    await waitFor(() => expect(sb.signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Bem-vindo ao seu espaço.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(new URLSearchParams(window.location.search).get('redirect')).toBe('/cards-v2');
    expect(screen.queryByRole('button', { name: 'Sair e Voltar ao Início' })).toBeNull();
  });
});

describe('membro autorizado nas rotas v2', () => {
  it('membro (não fundador) em /configuracoes-v2 recebe "Acesso restrito" e nenhum editor; a rota não redireciona', async () => {
    entrar('membro-1', { role: 'member', active: true });
    abrir('/configuracoes-v2');
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.getByText('Somente o fundador pode gerenciar a configuração da Helena v2.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao sistema' })).toHaveAttribute('href', '/sistema');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/configuracoes-v2');
    expect(screen.queryByText('Configuração e revisões')).toBeNull();
    expect(screen.queryByText('Atualizar estado')).toBeNull();
    expect(screen.queryByLabelText('Importar configuração existente em JSON')).toBeNull();
    // O repositório da configuração nem é pedido ao banco.
    expect(runtime.config).not.toHaveBeenCalled();
  });

  it('administrador (role admin, não fundador) também recebe "Acesso restrito" em /configuracoes-v2', async () => {
    entrar('admin-1', { role: 'admin', active: true });
    abrir('/configuracoes-v2');
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.queryByText('Configuração e revisões')).toBeNull();
    expect(runtime.config).not.toHaveBeenCalled();
  });

  it('controle positivo: o fundador em /configuracoes-v2 vê o editor e o repositório é aberto', async () => {
    entrar('fundador-1', { role: 'founder', active: true });
    abrir('/configuracoes-v2');
    expect(await screen.findByText('Configuração e revisões')).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma configuração cadastrada')).toBeInTheDocument();
    expect(screen.queryByText('Acesso restrito')).toBeNull();
    expect(runtime.config).toHaveBeenCalledTimes(1);
  });

  it('controle positivo: o membro em /cards-v2 vê a página de cards, sem as áreas exclusivas do fundador', async () => {
    entrar('membro-1', { role: 'member', active: true });
    abrir('/cards-v2');
    expect(await screen.findByText('Cards em andamento')).toBeInTheDocument();
    expect(await screen.findByText('Nenhum card disponível.')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/cards-v2');
    expect(screen.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
    expect(screen.queryByLabelText('Arquivo de preparação privada')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Publicação' })).toBeNull();
    expect(runtime.cards).toHaveBeenCalledTimes(1);
  });
});
