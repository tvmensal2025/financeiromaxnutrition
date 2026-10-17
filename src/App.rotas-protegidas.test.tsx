// Prova o acesso por URL direta às rotas do app da v2 (DEC-032: só a v2 roda), com o
// AuthProvider real e só o Supabase simulado: visitante vai a /login?redirect=<caminho
// codificado> sem open redirect; autenticado sem app_access ativo vê a tela de bloqueio e a
// rota nem é montada; membro (não fundador) em /configuracoes recebe "Acesso restrito" da
// própria página (a rota existe e não redireciona), e só o fundador vê o editor. Os endereços
// antigos (/cards-v2, /configuracoes-v2 e /?card=) continuam funcionando, e
// áreas recuperadas exigem fundador; os aliases preservam seus destinos.
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

const runtime = vi.hoisted(() => ({ cards: vi.fn(), pedidos: vi.fn(), config: vi.fn() }));
vi.mock('@/integrations/cards-v2/runtime', () => ({ repositorioCardsV2DoApp: runtime.cards }));
vi.mock('@/integrations/pedidos-v2/runtime', () => ({ repositorioPedidosV2DoApp: runtime.pedidos }));
vi.mock('@/integrations/config-v2/runtime', () => ({ repositorioConfigV2DoApp: runtime.config }));

vi.mock('@/contexts/SessionBusinessBoundary', () => ({ SessionBusinessBoundary: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { Layout: () => <div data-testid="layout"><Outlet /></div> };
});

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
const repoPedidos = () => ({ listar: vi.fn().mockResolvedValue({ limite: 50, itens: [] }),
  ler: vi.fn().mockResolvedValue(null), lerProposta: vi.fn().mockResolvedValue(null),
  receber: vi.fn(), confirmarProposta: vi.fn() });

const entrar = (id: string, acesso: { role: string; active: boolean; user_id?: string } | null) => {
  sb.sessao = { user: { id } };
  sb.acesso = { data: acesso && { user_id: id, ...acesso }, error: null };
};
const abrir = (caminho: string) => { window.history.replaceState({}, '', caminho); return render(<App />); };
const conteudoV2 = () => [screen.queryByRole('heading', { name: 'Visão geral' }), screen.queryByRole('heading', { name: 'Quadro de cards' }), screen.queryByText('Configuração e revisões'),
  screen.queryByTestId('layout')].filter(Boolean);

beforeEach(() => {
  sb.sessao = null;
  sb.acesso = { data: null, error: null };
  sb.signOut.mockReset().mockResolvedValue({ error: null });
  sb.consultaAcesso.mockReset();
  runtime.cards.mockReset().mockImplementation(async () => repoCards());
  runtime.pedidos.mockReset().mockImplementation(async () => repoPedidos());
  runtime.config.mockReset().mockImplementation(async () => repoConfig());
});
afterEach(() => { cleanup(); });

describe('visitante sem sessão abrindo a URL direta', () => {
  it.each([
    ['/', '%2F'],
    ['/cards', '%2Fcards'],
    ['/painel', '%2Fpainel'],
    ['/configuracoes', '%2Fconfiguracoes'],
    ['/?card=abc&aba=etapas', '%2F%3Fcard%3Dabc%26aba%3Detapas'],
    ['/?pedido=abc', '%2F%3Fpedido%3Dabc'],
    ['/cards-v2', '%2Fcards-v2'],
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
    '/?next=https://evil.example/x',
    '/?a=1&redirect=https://evil.example/x',
    '/configuracoes?u=//evil.example',
    '/configuracoes?u=%2F%2Fevil.example',
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
    expect(window.location.search).not.toContain('://');
    expect(window.location.search).not.toContain('//');
  });
});

describe('retorno do login (destino vindo da URL)', () => {
  it('autorizado em /login?redirect=/configuracoes volta para a rota pedida (controle positivo)', async () => {
    entrar('fundador-1', { role: 'founder', active: true });
    abrir('/login?redirect=%2Fconfiguracoes');
    expect(await screen.findByText('Configuração e revisões')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/configuracoes');
  });

  it.each(['https://evil.example/x', '//evil.example/x'])('autorizado em /login?redirect=%s não sai do domínio: cai na raiz, que é o painel', async externo => {
    const origem = window.location.origin;
    entrar('membro-1', { role: 'member', active: true });
    abrir(`/login?redirect=${encodeURIComponent(externo)}`);
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument();
    expect(window.location.origin).toBe(origem);
    expect(window.location.pathname).toBe('/');
  });

  it('login preserva um link antigo de card e termina no módulo Cards', async () => {
    entrar('membro-1', { role: 'member', active: true });
    const id = '11111111-1111-4111-8111-111111111111';
    const repo = repoCards();
    repo.listar.mockResolvedValue([{ id, titulo: 'Card autorizado', empresa: null, estado: 'EM_ANDAMENTO',
      dono: 'Helena', prazo: '2026-10-20', criado_em: '2026-10-17T12:00:00Z' }]);
    runtime.cards.mockResolvedValue(repo);
    abrir(`/login?redirect=${encodeURIComponent(`/?card=${id}&aba=etapas`)}`);
    expect(await screen.findByRole('heading', { name: 'Quadro de cards' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/cards');
    await waitFor(() => expect(window.location.search).toBe(`?card=${id}&aba=etapas`));
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
    it.each(['/', '/cards', '/configuracoes'])('%s mostra o bloqueio e não monta a rota nem o layout', async caminho => {
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
    abrir('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar sua sessão');
    expect(screen.queryByRole('button', { name: 'Sair e Voltar ao Início' })).toBeNull();
    expect(conteudoV2()).toHaveLength(0);
    expect(runtime.cards).not.toHaveBeenCalled();
  });

  it('"Sair e Voltar ao Início" encerra a sessão no serviço e, sem sessão, o app leva ao /login com o destino pedido', async () => {
    entrar('pessoa-1', { role: 'member', active: false });
    abrir('/configuracoes');
    fireEvent.click(await screen.findByRole('button', { name: 'Sair e Voltar ao Início' }));
    await waitFor(() => expect(sb.signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Bem-vindo ao seu espaço.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(new URLSearchParams(window.location.search).get('redirect')).toBe('/configuracoes');
    expect(screen.queryByRole('button', { name: 'Sair e Voltar ao Início' })).toBeNull();
  });
});

describe('membro autorizado nas rotas da v2', () => {
  it('membro (não fundador) em /configuracoes recebe "Acesso restrito" e nenhum editor; a rota não redireciona', async () => {
    entrar('membro-1', { role: 'member', active: true });
    abrir('/configuracoes');
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.getByText('Somente o fundador pode gerenciar a configuração da Helena v2.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar aos cards' })).toHaveAttribute('href', '/cards');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/configuracoes');
    expect(screen.queryByText('Configuração e revisões')).toBeNull();
    expect(screen.queryByText('Atualizar estado')).toBeNull();
    expect(screen.queryByLabelText('Importar configuração existente em JSON')).toBeNull();
    expect(runtime.config).not.toHaveBeenCalled();
  });

  it('administrador (role admin, não fundador) também recebe "Acesso restrito" em /configuracoes', async () => {
    entrar('admin-1', { role: 'admin', active: true });
    abrir('/configuracoes');
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.queryByText('Configuração e revisões')).toBeNull();
    expect(runtime.config).not.toHaveBeenCalled();
  });

  it('controle positivo: o fundador em /configuracoes vê o editor e o repositório é aberto', async () => {
    entrar('fundador-1', { role: 'founder', active: true });
    abrir('/configuracoes');
    expect(await screen.findByText('Configuração e revisões')).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma configuração cadastrada')).toBeInTheDocument();
    expect(screen.queryByText('Acesso restrito')).toBeNull();
    expect(runtime.config).toHaveBeenCalledTimes(1);
  });

  it('fundador abre pedido por /cards?pedido= após confirmação do repositório', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const pedido = { pedido_id: '22222222-2222-4222-8222-222222222222', request_id: id,
      estado: 'RECEBIDO', texto_inicial: 'Pedido pelo link', total_eventos: 1,
      criado_em: '2026-10-17T12:00:00Z', atualizado_em: '2026-10-17T12:00:00Z', origem_inicial: 'SITE' };
    const repo = repoPedidos();
    repo.ler.mockResolvedValue({ ...pedido, eventos: [{ origem: 'SITE', evento_id: 'site:1',
      texto: 'Pedido pelo link', recebido_em: pedido.criado_em }] });
    repo.lerProposta.mockResolvedValue({ ...pedido, proposta_helena: null, perguntas: [] });
    runtime.pedidos.mockResolvedValue(repo);
    entrar('fundador-1', { role: 'founder', active: true });
    abrir(`/cards?pedido=${id}`);
    expect(await screen.findByRole('article', { name: 'Histórico do pedido' })).toBeInTheDocument();
    expect(repo.ler).toHaveBeenCalledWith(id);
    await waitFor(() => expect(repo.lerProposta).toHaveBeenCalledWith(id));
    expect(window.location.pathname).toBe('/cards');
    expect(window.location.search).toBe(`?pedido=${id}`);
  });

  it('controle positivo: a raiz é o painel; o membro a vê sem abrir o repositório de cards', async () => {
    entrar('membro-1', { role: 'member', active: true });
    abrir('/');
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
    expect(runtime.cards).not.toHaveBeenCalled();
    expect(runtime.pedidos).not.toHaveBeenCalled();
    expect(runtime.config).not.toHaveBeenCalled();
  });

  it('fundador vê o painel real com cards, pedidos e configuração', async () => {
    entrar('fundador-1', { role: 'founder', active: true });
    abrir('/');
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cards recentes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pedidos recentes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Empresas e agentes' })).toBeInTheDocument();
    await waitFor(() => expect(runtime.cards).toHaveBeenCalledTimes(1));
    expect(runtime.pedidos).toHaveBeenCalledTimes(1);
    expect(runtime.config).toHaveBeenCalledTimes(1);
  });
});

describe('endereços antigos e rotas da v1', () => {
  it('/cards-v2 redireciona para /cards preservando a busca', async () => {
    entrar('membro-1', { role: 'member', active: true });
    const id = '11111111-1111-4111-8111-111111111111';
    const repo = repoCards();
    repo.listar.mockResolvedValue([{ id, titulo: 'Card visível', empresa: null, estado: 'EM_ANDAMENTO',
      dono: 'Helena', prazo: '2026-10-20', criado_em: '2026-10-17T12:00:00Z' }]);
    runtime.cards.mockResolvedValue(repo);
    abrir(`/cards-v2?card=${id}&aba=etapas`);
    expect(await screen.findByRole('heading', { name: 'Quadro de cards' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/cards');
    expect(window.location.search).toBe(`?card=${id}&aba=etapas`);
  });

  it('a raiz com ?card= abre Cards, que rejeita ID inválido da conta', async () => {
    entrar('membro-1', { role: 'member', active: true });
    abrir('/?card=invalido&aba=etapas');
    expect(await screen.findByRole('heading', { name: 'Quadro de cards' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/cards');
    expect(await screen.findByText('O card indicado na URL não está disponível para esta conta. Escolha um card do quadro.')).toBeInTheDocument();
    expect(window.location.search).toBe('?aba=etapas');
    expect(screen.queryByRole('heading', { name: 'Visão geral' })).toBeNull();
  });

  it('/painel redireciona para a raiz e mostra a visão geral', async () => {
    entrar('membro-1', { role: 'member', active: true });
    abrir('/painel');
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('link legado /?pedido= vai a /cards?pedido= e protege a consulta do membro', async () => {
    entrar('membro-1', { role: 'member', active: true });
    const id = '11111111-1111-4111-8111-111111111111';
    abrir(`/?pedido=${id}`);
    expect(await screen.findByText(/O acompanhamento por link está disponível apenas para a conta do fundador/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/cards');
    expect(window.location.search).toBe(`?pedido=${id}`);
    expect(runtime.pedidos).not.toHaveBeenCalled();
  });

  it('/configuracoes-v2 redireciona para /configuracoes', async () => {
    entrar('fundador-1', { role: 'founder', active: true });
    abrir('/configuracoes-v2');
    expect(await screen.findByText('Configuração e revisões')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/configuracoes');
  });

  it.each(['/comando', '/financeiro', '/crm', '/conversa', '/execucao', '/modulo/tarefas', '/sistema', '/oauth/consent'])(
    'a área recuperada %s restringe o membro sem redirecionar silenciosamente', async caminho => {
      entrar('membro-1', { role: 'member', active: true });
      abrir(caminho);
      expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
      expect(window.location.pathname).toBe(caminho);
    });
});
