import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import CardV2Page from './CardV2Page';
import type { PedidoPublicacao, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';

const auth = vi.hoisted(() => ({ isFounder: false, userId: 'usuario-a' }));
vi.mock('@/auth', () => ({ useAuth: () => ({ isFounder: auth.isFounder, user: { id: auth.userId } }) }));
vi.mock('./EntradaPedidosV2', () => ({ EntradaPedidosV2: ({ identidade, pedidoInicial }: { identidade: string; pedidoInicial?: string | null }) =>
  <section data-testid="entrada-pedidos" data-identidade={identidade} data-pedido={pedidoInicial ?? ''}>Entrada unificada</section> }));
vi.mock('./PareamentoTelegramV2', () => ({ PareamentoTelegramV2: ({ identidade }: { identidade: string }) =>
  <section data-testid="pareamento-telegram" data-identidade={identidade}>Telegram</section> }));

function RotaAtual() { const { search } = useLocation(); return <span data-testid="rota-atual" hidden>{search}</span>; }
function renderPage(page: ReactElement, entrada = '/') {
  const tela = render(<MemoryRouter initialEntries={[entrada]}><RotaAtual />{page}</MemoryRouter>);
  return { ...tela, rerender(proxima: ReactElement) {
    tela.rerender(<MemoryRouter initialEntries={[entrada]}><RotaAtual />{proxima}</MemoryRouter>);
  } };
}

const card = (id: string, titulo: string) => ({ id, titulo, empresa: null, estado: 'EM_ANDAMENTO', dono: 'Helena', prazo: '2026-10-13', criado_em: '2026-10-12T12:00:00Z' });
function repositorio(parcial: Partial<RepositorioCardsV2> = {}): RepositorioCardsV2 {
  return {
    listar: vi.fn().mockResolvedValue([]),
    detalhar: vi.fn().mockResolvedValue({ etapas: [], entregas: [] }),
    situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: false, dia_brasilia: '2026-10-13', pedido: null }),
    pedirPublicacao: vi.fn().mockResolvedValue(undefined),
    solicitarCardReal: vi.fn().mockResolvedValue({ id: 'solicitacao-local', card_id: null }),
    consultarSolicitacaoPorChave: vi.fn().mockResolvedValue(null),
    listarSolicitacoesReais: vi.fn().mockResolvedValue([]),
    consultarSolicitacaoPorTarefa: vi.fn().mockResolvedValue(null),
    aplicarEventoFundador: vi.fn().mockResolvedValue({ resultado: 'APLICADO' }),
    consultarToqueFundador: vi.fn().mockResolvedValue(null),
    lerPerguntaEtapaFundador: vi.fn().mockResolvedValue(null),
    lerLeituraCardFundador: vi.fn().mockResolvedValue(null),
    ...parcial,
  };
}

beforeEach(() => { auth.isFounder = false; auth.userId = 'usuario-a'; });

it('remove cards da conta anterior imediatamente ao trocar a identidade', async () => {
  let resolverAntigo!: (value: Awaited<ReturnType<RepositorioCardsV2['listar']>>) => void;
  const antigo = new Promise<Awaited<ReturnType<RepositorioCardsV2['listar']>>>(resolve => { resolverAntigo = resolve; });
  const listar = vi.fn().mockImplementationOnce(() => antigo).mockResolvedValueOnce([]);
  const repo = repositorio({ listar });
  const tela = renderPage(<CardV2Page repositorio={repo} />);
  auth.userId = 'usuario-b';
  tela.rerender(<CardV2Page repositorio={repo} />);
  await act(async () => resolverAntigo([card('a', 'Card privado A')]));
  expect(await screen.findByText('Nenhum card disponível.')).toBeTruthy();
  expect(screen.queryByText('Card privado A')).toBeNull();
});

it('descarta estado de fundador ao perder a permissão na mesma conta', async () => {
  auth.isFounder = true;
  sessionStorage.setItem('helena-v2-toque:usuario-a:card:privado', '{"cardId":"privado"}');
  const listar = vi.fn().mockResolvedValueOnce([card('privado', 'Card antes do downgrade')]).mockResolvedValueOnce([]);
  const repo = repositorio({ listar });
  const tela = renderPage(<CardV2Page repositorio={repo} />);
  expect(await screen.findByText('Card antes do downgrade')).toBeTruthy();
  expect(screen.getByTestId('entrada-pedidos')).toBeTruthy();
  expect(screen.getByTestId('pareamento-telegram')).toBeTruthy();
  expect(screen.getByLabelText('Solicitar card real')).toBeTruthy();
  auth.isFounder = false;
  tela.rerender(<CardV2Page repositorio={repo} />);
  expect(screen.queryByText('Card antes do downgrade')).toBeNull();
  expect(screen.queryByTestId('entrada-pedidos')).toBeNull();
  expect(screen.queryByTestId('pareamento-telegram')).toBeNull();
  expect(screen.queryByLabelText('Solicitar card real')).toBeNull();
  await waitFor(() => expect(sessionStorage.getItem('helena-v2-toque:usuario-a:card:privado')).toBeNull());
  expect(await screen.findByText('Nenhum card disponível.')).toBeTruthy();
});

it('mostra entrada unificada ao fundador antes da importação avançada de card', async () => {
  auth.isFounder = true;
  renderPage(<CardV2Page repositorio={repositorio()} />);
  await screen.findByText('Nenhum card disponível.');
  const entrada = screen.getByTestId('entrada-pedidos');
  const telegram = screen.getByTestId('pareamento-telegram');
  const importacao = screen.getByLabelText('Solicitar card real');
  expect(entrada.getAttribute('data-identidade')).toBe(auth.userId);
  expect(telegram.getAttribute('data-identidade')).toBe(auth.userId);
  expect(entrada.compareDocumentPosition(telegram) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(telegram.compareDocumentPosition(importacao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('encaminha ?pedido= ao módulo de pedidos só para o fundador, sem interpretar o ID como card', async () => {
  auth.isFounder = true;
  const pedidoId = '11111111-1111-4111-8111-111111111111';
  renderPage(<CardV2Page repositorio={repositorio()} />, `/?pedido=${pedidoId}`);
  await screen.findByText('Nenhum card disponível.');
  expect(screen.getByTestId('entrada-pedidos').getAttribute('data-pedido')).toBe(pedidoId);
  expect(screen.queryByText(/O card indicado na URL/)).toBeNull();
  expect(screen.getByTestId('rota-atual').textContent).toBe(`?pedido=${pedidoId}`);
});

it('membro com ?pedido= recebe restrição explícita e não monta a entrada', async () => {
  renderPage(<CardV2Page repositorio={repositorio()} />, '/?pedido=invalido');
  expect(await screen.findByText(/O acompanhamento por link está disponível apenas para a conta do fundador/)).toBeTruthy();
  expect(screen.queryByTestId('entrada-pedidos')).toBeNull();
});

it('mostra decisão do fundador com versão real apenas para card selecionado em estado permitido', async () => {
  auth.isFounder = true;
  const esperando = { ...card('card-real', 'Pedido sob revisão'), estado: 'ESPERANDO_CONFIRMACAO', motivo: 'NENHUM', versao: 4 };
  renderPage(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([esperando]),
    detalhar: vi.fn().mockResolvedValue({ etapas: [], entregas: [], acoes: [], ordem: { pedido_original: 'Pedido real carregado do banco.',
      como_e_o_pronto: [], nao_pode: [], fontes_que_pode_ler: [] } }) })} />);
  fireEvent.click(await screen.findByRole('button', { name: /Pedido sob revisão/ }));
  expect(await screen.findByText('Pedido real carregado do banco.')).toBeTruthy();
  expect(screen.getByLabelText('Decisão do fundador')).toBeTruthy();
  expect(screen.getByText('Pedido registrado')).toBeTruthy();
});

it('mostra vazio, erro e permite tentar novamente', async () => {
  const listar = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  renderPage(<CardV2Page repositorio={repositorio({ listar })} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível carregar');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('Nenhum card disponível.')).toBeTruthy();
});

it('descarta detalhe antigo após troca de card e mostra só entrega aprovada como texto', async () => {
  let resolverAntigo!: (value: Awaited<ReturnType<RepositorioCardsV2['detalhar']>>) => void;
  const antigo = new Promise<Awaited<ReturnType<RepositorioCardsV2['detalhar']>>>(resolve => { resolverAntigo = resolve; });
  const repo = repositorio({
    listar: vi.fn().mockResolvedValue([card('a', 'Card A'), card('b', 'Card B')]),
    detalhar: vi.fn().mockImplementation((id: string) => id === 'a' ? antigo : Promise.resolve({
      etapas: [{ id: 'e2', codigo: 'E2', nome: 'Parecer', estado: 'PRONTA', autor: 'Clara', dono: 'Helena', prazo_ate: null, revisores: ['Helena'], versao: 2, portao1_ok: true, entrega_fresca: true }],
      entregas: [{ id: 4, etapa_id: 'e2', versao: 2, portao1: 'PASSOU', conteudo: { resumo: '<img src=x onerror=alert(1)> Aprovado' }, criada_em: '2026-10-13T12:00:00Z' }],
    })),
  });
  renderPage(<CardV2Page repositorio={repo} />);
  fireEvent.click(await screen.findByRole('button', { name: /Card A/ }));
  fireEvent.click(screen.getByRole('button', { name: /Card B/ }));
  expect(await screen.findByText(/Aprovado/)).toBeTruthy();
  await act(async () => resolverAntigo({ etapas: [], entregas: [] }));
  expect(screen.getByText(/Aprovado/)).toBeTruthy();
  expect(document.querySelector('img')).toBeNull();
  expect(within(screen.getByRole('region', { name: 'Detalhes do card' })).getByText('Autor: Clara')).toBeTruthy();
});

it('mostra pedido de publicação só ao fundador confirmado pelo banco e atualiza status', async () => {
  auth.isFounder = true;
  const situacaoPublicacao = vi.fn()
    .mockResolvedValueOnce({ fundador: true, dia_brasilia: '2026-10-13', pedido: null })
    .mockResolvedValueOnce({ fundador: true, dia_brasilia: '2026-10-13', pedido: { pedido_em: '2026-10-13T12:00:00Z', dia_brasilia: '2026-10-13' } });
  const pedirPublicacao = vi.fn().mockResolvedValue(undefined);
  renderPage(<CardV2Page repositorio={repositorio({ situacaoPublicacao, pedirPublicacao })} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir publicação' }));
  await waitFor(() => expect(pedirPublicacao).toHaveBeenCalledTimes(1));
  const regiao = within(await screen.findByRole('region', { name: 'Publicação' }));
  expect(await regiao.findByText('Pedido registrado')).toBeTruthy();
  expect(regiao.queryByText(/no ar/i)).toBeNull();                 // pedido aceito nunca aparece como no ar
  expect(screen.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
});

it('não oferece publicação a membro ou se o banco falhar', async () => {
  auth.isFounder = false;
  const view = renderPage(<CardV2Page repositorio={repositorio({ situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: true, dia_brasilia: '2026-10-13', pedido: null }) })} />);
  await waitFor(() => expect(screen.queryByText('Carregando situação de publicação…')).toBeNull());
  expect(screen.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
  expect(screen.queryByLabelText('Arquivo de preparação privada')).toBeNull();
  view.unmount();
  auth.isFounder = true;
  renderPage(<CardV2Page repositorio={repositorio({ situacaoPublicacao: vi.fn().mockRejectedValue(new Error('offline')) })} />);
  expect(await screen.findByText(/Não foi possível consultar a publicação/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
});

it('permite repetir consulta de publicação e não anuncia sucesso sem confirmação', async () => {
  auth.isFounder = true;
  const situacaoPublicacao = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ fundador: true, dia_brasilia: '2026-10-13', pedido: null })
    .mockRejectedValueOnce(new Error('offline'));
  const repo = repositorio({ situacaoPublicacao, pedirPublicacao: vi.fn().mockResolvedValue(undefined) });
  renderPage(<CardV2Page repositorio={repo} />);
  expect(await screen.findByText(/Não foi possível consultar a publicação/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar novamente' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir publicação' }));
  expect(await screen.findByText(/Não foi possível confirmar o pedido/)).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Publicação' })).queryByText('Pedido registrado')).toBeNull();
});

it('recarrega o detalhe quando o card selecionado é clicado novamente', async () => {
  const detalhar = vi.fn()
    .mockResolvedValueOnce({ etapas: [{ id: 'e1', codigo: 'E1', nome: 'Primeira versão', estado: 'PRONTA', autor: 'Clara', dono: null, prazo_ate: null, revisores: [], versao: 1, portao1_ok: true, entrega_fresca: true }], entregas: [] })
    .mockResolvedValueOnce({ etapas: [{ id: 'e1', codigo: 'E1', nome: 'Versão atualizada', estado: 'PRONTA', autor: 'Clara', dono: null, prazo_ate: null, revisores: [], versao: 2, portao1_ok: true, entrega_fresca: true }], entregas: [] });
  renderPage(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([card('a', 'Card A')]), detalhar })} />);
  const botao = await screen.findByRole('button', { name: /Card A/ });
  fireEvent.click(botao);
  expect(await screen.findByText(/Primeira versão/)).toBeTruthy();
  fireEvent.click(botao);
  expect(await screen.findByText(/Versão atualizada/)).toBeTruthy();
  expect(detalhar).toHaveBeenCalledTimes(2);
});

it('permite ver todas as linhas e níveis profundos de uma entrega aprovada como texto', async () => {
  const campos = Object.fromEntries(Array.from({ length: 121 }, (_, i) => [`campo_${i}`, `valor ${i}`]));
  const profundo = { a: { b: { c: { d: { e: { f: { g: { h: '<script>alert(1)</script> texto profundo' } } } } } } } };
  const detalhe = { etapas: [{ id: 'e1', codigo: 'E1', nome: 'Pesquisa', estado: 'PRONTA', autor: 'Ravi', dono: null, prazo_ate: null, revisores: [], versao: 1, portao1_ok: true, entrega_fresca: true }],
    entregas: [{ id: 1, etapa_id: 'e1', versao: 1, portao1: 'PASSOU', conteudo: { ...campos, profundo }, criada_em: '2026-10-13T12:00:00Z' }] };
  renderPage(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([card('a', 'Card A')]), detalhar: vi.fn().mockResolvedValue(detalhe) })} />);
  fireEvent.click(await screen.findByRole('button', { name: /Card A/ }));
  expect(await screen.findByText('valor 0')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Mostrar todas/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Mostrar todas/ }));
  expect(screen.getByText('valor 120')).toBeTruthy();
  expect(screen.getByText(/texto profundo/)).toBeTruthy();
  expect(document.querySelector('script')).toBeNull();
});

it('atualiza lista e detalhe do card selecionado sem recarregar a página', async () => {
  const listar = vi.fn().mockResolvedValueOnce([card('a', 'Card A')]).mockResolvedValueOnce([card('a', 'Card atualizado')]);
  const detalhar = vi.fn().mockResolvedValueOnce({ etapas: [], entregas: [] }).mockResolvedValueOnce({ etapas: [{ id: 'e1', codigo: 'E1', nome: 'Etapa atual', estado: 'PRONTA', autor: 'Clara', dono: null, prazo_ate: null, revisores: [], versao: 1, portao1_ok: true, entrega_fresca: true }], entregas: [] });
  renderPage(<CardV2Page repositorio={repositorio({ listar, detalhar })} />);
  fireEvent.click(await screen.findByRole('button', { name: /Card A/ }));
  expect(await screen.findByText('Este card ainda não tem etapas.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar cards' }));
  expect(await screen.findByText(/Etapa atual/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Card atualizado/ })).toBeTruthy();
  expect(listar).toHaveBeenCalledTimes(2);
  expect(detalhar).toHaveBeenCalledTimes(2);
});

it('agrupa todos os estados do card em colunas e mantém finais distintos de publicação', async () => {
  const estados = [
    ['a', 'RASCUNHO', 'Preparar'], ['b', 'VALIDANDO_PLANO', 'Validar'],
    ['c', 'ESPERANDO_CONFIRMACAO', 'Confirmar'], ['d', 'ESPERANDO_FUNDADOR', 'Decidir'],
    ['e', 'EM_ANDAMENTO', 'Executar'], ['f', 'PRONTO', 'Entrega pronta'],
    ['g', 'CANCELADO', 'Cancelado'], ['h', 'ENCERRADO_COM_FALHA', 'Falhou'],
  ] as const;
  const cards = estados.map(([id, estado, titulo]) => ({ ...card(id, titulo), estado, motivo: estado === 'ESPERANDO_FUNDADOR' ? 'DEPENDENCIA' : 'NENHUM' }));
  renderPage(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue(cards) })} />);
  const quadro = within(await screen.findByRole('region', { name: 'Quadro Kanban dos cards' }));
  const esperar = within(quadro.getByRole('region', { name: 'Aguardando você: 2 cards' }));
  expect(esperar.getByRole('button', { name: /Confirmar/ })).toBeTruthy();
  expect(esperar.getByRole('button', { name: /Decidir/ }).textContent).toContain('Dependência');
  expect(within(quadro.getByRole('region', { name: 'Preparação: 2 cards' })).getByRole('button', { name: /Validar/ })).toBeTruthy();
  expect(within(quadro.getByRole('region', { name: 'Pronto: 1 card' })).getByRole('button', { name: /Entrega pronta/ }).textContent).toContain('Pronto');
  expect(within(quadro.getByRole('region', { name: 'Encerrado: 2 cards' })).getByRole('button', { name: /Falhou/ }).textContent).toContain('Encerrado com falha');
  expect(quadro.queryByText(/No ar/)).toBeNull();
});

it('abre apenas UUID visível pela URL e atualiza a URL ao selecionar outro card', async () => {
  const primeiro = '11111111-1111-4111-8111-111111111111';
  const segundo = '22222222-2222-4222-8222-222222222222';
  const detalhar = vi.fn().mockResolvedValue({ etapas: [], entregas: [] });
  const repo = repositorio({ listar: vi.fn().mockResolvedValue([card(primeiro, 'Card da URL'), card(segundo, 'Outro card')]), detalhar });
  renderPage(<CardV2Page repositorio={repo} />, `/?card=${primeiro}&origem=telegram`);
  expect(await screen.findByText('Este card ainda não tem etapas.')).toBeTruthy();
  expect(detalhar).toHaveBeenCalledWith(primeiro);
  fireEvent.click(screen.getByRole('button', { name: /Outro card/ }));
  await waitFor(() => expect(detalhar).toHaveBeenCalledWith(segundo));
  expect(screen.getByTestId('rota-atual').textContent).toContain(`card=${segundo}`);
  expect(screen.getByTestId('rota-atual').textContent).toContain('origem=telegram');
});

it.each(['invalido', '33333333-3333-4333-8333-333333333333'])('não abre card ausente ou URL inválida: %s', async id => {
  const detalhar = vi.fn();
  renderPage(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([card('11111111-1111-4111-8111-111111111111', 'Visível')]), detalhar })} />, `/?card=${id}&origem=telegram`);
  expect(await screen.findByText(/O card indicado na URL não está disponível/)).toBeTruthy();
  expect(detalhar).not.toHaveBeenCalled();
  expect(screen.getByTestId('rota-atual').textContent).toBe('?origem=telegram');
});

it('recusa parâmetro card duplicado mesmo quando o primeiro UUID está visível', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const detalhar = vi.fn();
  renderPage(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([card(id, 'Visível')]), detalhar })} />,
    `/?card=${id}&card=outro&origem=telegram`);
  expect(await screen.findByText(/O card indicado na URL não está disponível/)).toBeTruthy();
  expect(detalhar).not.toHaveBeenCalled();
  expect(screen.getByTestId('rota-atual').textContent).toBe('?origem=telegram');
});

it('destaca espera da etapa sem tirar o card da coluna Em trabalho', async () => {
  const esperando = { ...card('a', 'Trabalho com pergunta'), estado: 'EM_ANDAMENTO' };
  const repo = repositorio({ listar: vi.fn().mockResolvedValue([esperando]), detalhar: vi.fn().mockResolvedValue({
    etapas: [{ id: 'etapa-a', codigo: 'E1', nome: 'Pesquisa', estado: 'ESPERANDO_FUNDADOR', motivo: 'PERGUNTA', autor: 'Ravi', dono: 'FUNDADOR', prazo_ate: null, revisores: [], versao: 2, portao1_ok: false, entrega_fresca: false }],
    entregas: [], acoes: [],
  }) });
  renderPage(<CardV2Page repositorio={repo} />);
  fireEvent.click(await screen.findByRole('button', { name: /Trabalho com pergunta/ }));
  expect((await screen.findByRole('region', { name: 'Decisões pendentes do fundador' })).textContent).toContain('Etapa E1: Esperando fundador · motivo Pergunta');
  expect(within(screen.getByRole('region', { name: 'Em trabalho: 1 card' })).getByRole('button', { name: /Trabalho com pergunta/ })).toBeTruthy();
});

// --- Texto verdadeiro por estado do pedido de publicação (migration 0018) ---------------------------------------------
const pedidoHoje = (extra: Partial<PedidoPublicacao> = {}): PedidoPublicacao =>
  ({ id: 7, pedido_em: '2026-10-13T12:00:00Z', dia_brasilia: '2026-10-13', ...extra });
async function mostrarPublicacao(pedido: PedidoPublicacao | null, extra: Partial<RepositorioCardsV2> = {}) {
  auth.isFounder = true;
  renderPage(<CardV2Page repositorio={repositorio({
    situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: true, dia_brasilia: '2026-10-13', pedido }), ...extra })} />);
  const regiao = within(await screen.findByRole('region', { name: 'Publicação' }));
  await waitFor(() => expect(regiao.queryByText('Carregando situação de publicação…')).toBeNull());
  return regiao;
}

it('estado PEDIDA (ou pedido sem estado, de banco anterior à 0018): "Pedido registrado" e nunca "no ar"', async () => {
  for (const pedido of [pedidoHoje({ estado: 'PEDIDA' }), pedidoHoje()]) {
    const regiao = await mostrarPublicacao(pedido);
    expect(regiao.getByText('Pedido registrado')).toBeTruthy();
    expect(regiao.getByText(/ainda não foi publicado/)).toBeTruthy();
    expect(regiao.queryByText(/no ar/i)).toBeNull();
    expect(regiao.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
    cleanup();
  }
});

it('estado EM_EXECUCAO: "Publicando…", sem versão e sem "no ar"', async () => {
  const regiao = await mostrarPublicacao(pedidoHoje({ estado: 'EM_EXECUCAO', iniciada_em: '2026-10-13T12:05:00Z' }));
  expect(regiao.getByText('Publicando…')).toBeTruthy();
  expect(regiao.getByText(/Ainda não terminou/)).toBeTruthy();
  expect(regiao.queryByText(/no ar/i)).toBeNull();
  expect(regiao.queryByText(/versão/i)).toBeNull();
});

it('estado PUBLICADA: "No ar (versão X)" e o destino informado', async () => {
  const regiao = await mostrarPublicacao(pedidoHoje({ estado: 'PUBLICADA', destino: 'FALSO_DE_TESTE', versao_publicada: 'v-12',
    iniciada_em: '2026-10-13T12:05:00Z', concluida_em: '2026-10-13T12:06:00Z' }));
  expect(regiao.getByText('No ar (versão v-12)')).toBeTruthy();
  expect(regiao.getByText('Destino: FALSO_DE_TESTE')).toBeTruthy();
  expect(regiao.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
});

it('estado FALHOU: "Falhou: motivo", sem "no ar" e sem versão', async () => {
  const regiao = await mostrarPublicacao(pedidoHoje({ estado: 'FALHOU', erro: 'RuntimeError: destino recusou', falhou_em: '2026-10-13T12:06:00Z',
    versao_publicada: null }));
  expect(regiao.getByText('Falhou: RuntimeError: destino recusou')).toBeTruthy();
  expect(regiao.getByText('Este pedido não consta como publicado.')).toBeTruthy();
  expect(regiao.queryByText(/no ar/i)).toBeNull();
  cleanup();
  const vazio = await mostrarPublicacao(pedidoHoje({ estado: 'FALHOU', erro: null }));
  expect(vazio.getByText('Falhou: motivo não informado')).toBeTruthy();
});

it('estado REVERTIDA: "Revertida", sem "no ar"', async () => {
  const regiao = await mostrarPublicacao(pedidoHoje({ estado: 'REVERTIDA', versao_publicada: 'v-12', destino: 'FALSO_DE_TESTE',
    revertida_em: '2026-10-13T13:00:00Z', concluida_em: '2026-10-13T12:06:00Z' }));
  expect(regiao.getByText('Revertida')).toBeTruthy();
  expect(regiao.getByText('A versão v-12 foi revertida.')).toBeTruthy();
  expect(regiao.queryByText(/no ar/i)).toBeNull();
});

it('estado desconhecido nunca vira "no ar" e a tela avisa', async () => {
  const regiao = await mostrarPublicacao(pedidoHoje({ estado: 'ENVIADA_AO_CEU', versao_publicada: 'v-1' }));
  expect(regiao.getByText('Situação do pedido não reconhecida')).toBeTruthy();
  expect(regiao.getByText('Não trate este pedido como publicado.')).toBeTruthy();
  expect(regiao.queryByText(/no ar/i)).toBeNull();
});

it('só PUBLICADA mostra "No ar": nos demais estados, mesmo com versão preenchida, o texto não aparece', async () => {
  for (const estado of ['PEDIDA', 'EM_EXECUCAO', 'FALHOU', 'REVERTIDA', 'OUTRO']) {
    const regiao = await mostrarPublicacao(pedidoHoje({ estado, versao_publicada: 'v-9', destino: 'x', concluida_em: '2026-10-13T12:06:00Z' }));
    expect(regiao.queryByText(/no ar/i), estado).toBeNull();
    cleanup();
  }
});

it('botão de pedir só com fundador confirmado e sem pedido hoje; com pedido, só "Atualizar situação"', async () => {
  const semPedido = await mostrarPublicacao(null);
  expect(semPedido.getByRole('button', { name: 'Pedir publicação' })).toBeTruthy();
  expect(semPedido.queryByRole('button', { name: 'Atualizar situação' })).toBeNull();
  cleanup();
  for (const estado of ['PEDIDA', 'EM_EXECUCAO', 'PUBLICADA', 'FALHOU', 'REVERTIDA']) {
    const regiao = await mostrarPublicacao(pedidoHoje({ estado }));
    expect(regiao.queryByRole('button', { name: 'Pedir publicação' }), estado).toBeNull();
    expect(regiao.getByRole('button', { name: 'Atualizar situação' }), estado).toBeTruthy();
    cleanup();
  }
});

it('"Atualizar situação" relê o banco e troca "Publicando…" pelo estado verdadeiro', async () => {
  auth.isFounder = true;
  const situacaoPublicacao = vi.fn()
    .mockResolvedValueOnce({ fundador: true, dia_brasilia: '2026-10-13', pedido: pedidoHoje({ estado: 'EM_EXECUCAO' }) })
    .mockResolvedValueOnce({ fundador: true, dia_brasilia: '2026-10-13', pedido: pedidoHoje({ estado: 'FALHOU', erro: 'ConnectionError: fora do ar' }) });
  renderPage(<CardV2Page repositorio={repositorio({ situacaoPublicacao })} />);
  const regiao = within(await screen.findByRole('region', { name: 'Publicação' }));
  expect(await regiao.findByText('Publicando…')).toBeTruthy();
  fireEvent.click(regiao.getByRole('button', { name: 'Atualizar situação' }));
  expect(await regiao.findByText('Falhou: ConnectionError: fora do ar')).toBeTruthy();
  expect(regiao.queryByText('Publicando…')).toBeNull();
  expect(situacaoPublicacao).toHaveBeenCalledTimes(2);
});

it('membro não vê a área de publicação, nem com pedido no banco', async () => {
  auth.isFounder = false;
  renderPage(<CardV2Page repositorio={repositorio({
    situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: true, dia_brasilia: '2026-10-13', pedido: pedidoHoje({ estado: 'PUBLICADA', versao_publicada: 'v-1' }) }) })} />);
  await screen.findByText('Nenhum card disponível.');
  expect(screen.queryByRole('region', { name: 'Publicação' })).toBeNull();
  expect(screen.queryByText(/no ar/i)).toBeNull();
});

// --- Ordem da página e rótulos legíveis -------------------------------------------------------------------------------
it('fundador vê o Kanban antes das seções de pedido, Telegram e solicitação, que ficam recolhidas', async () => {
  auth.isFounder = true;
  renderPage(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([card('a', 'Card do quadro')]) })} />);
  const quadro = await screen.findByRole('region', { name: 'Quadro Kanban dos cards' });
  const alvos = [screen.getByTestId('entrada-pedidos'), screen.getByTestId('pareamento-telegram'), screen.getByRole('region', { name: 'Solicitar card real' })];
  for (const alvo of alvos) {
    expect(quadro.compareDocumentPosition(alvo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alvo.closest('details')?.hasAttribute('open')).toBe(false);
  }
});

it('?pedido= abre a seção de pedidos para o fundador acompanhar o histórico', async () => {
  auth.isFounder = true;
  renderPage(<CardV2Page repositorio={repositorio()} />, '/?pedido=11111111-1111-4111-8111-111111111111');
  const entrada = await screen.findByTestId('entrada-pedidos');
  expect(entrada.closest('details')?.hasAttribute('open')).toBe(true);
  expect(screen.getByTestId('pareamento-telegram').closest('details')?.hasAttribute('open')).toBe(false);
});

it('mostra estado e motivo em português no quadro, mantendo o código cru só como dica', async () => {
  const esperando = { ...card('a', 'Aguardando decisão'), estado: 'ESPERANDO_CONFIRMACAO', motivo: 'HELENA_FALHOU' };
  renderPage(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([esperando]) })} />);
  const botao = await screen.findByRole('button', { name: /Aguardando decisão/ });
  expect(botao.textContent).toContain('Esperando confirmação');
  expect(botao.textContent).toContain('Motivo: Helena falhou');
  expect(botao.textContent).not.toMatch(/[A-Z]+_[A-Z]+/);
  expect(botao.querySelector('[data-estado-card="ESPERANDO_CONFIRMACAO"]')).toBeTruthy();
});
