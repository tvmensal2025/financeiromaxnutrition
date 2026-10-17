import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import PainelV2Page from './PainelV2Page';
import type { CardV2, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import type { PedidoEntrada, RepositorioPedidosV2 } from '@/integrations/pedidos-v2/repository';
import type { ConfigDetail, RepositorioConfigV2 } from '@/integrations/config-v2/repository';

const auth = vi.hoisted(() => ({ userId: 'fundador-a', isFounder: true }));
vi.mock('@/auth', () => ({ useAuth: () => ({ user: { id: auth.userId }, isFounder: auth.isFounder }) }));

const card = (id: string, estado: string): CardV2 => ({ id, titulo: `Card ${id}`, empresa: 'BIZ-003', estado,
  dono: 'Helena', prazo: '2026-10-19T12:00:00Z', criado_em: '2026-10-17T12:00:00Z' });
const pedido = (id: string, estado: PedidoEntrada['estado']): PedidoEntrada => ({
  pedido_id: id, request_id: id, estado, texto_inicial: `Pedido ${id}`, total_eventos: 1,
  criado_em: '2026-10-17T12:00:00Z', atualizado_em: '2026-10-17T12:00:00Z', origem_inicial: 'SITE',
  card_id: estado === 'CARD_CRIADO' ? 'card-pronto' : null,
});
const detalhe: ConfigDetail = { id: 'rev-1', nome: 'Revisão ativa', versao: 1, estado: 'VALIDADA', ativa: true,
  tecnica: false, hash_sha256: null, criada_em: '2026-10-17T12:00:00Z', validada_em: null, aposentada_em: null,
  conteudo: { 'helena-v2/organograma.yaml': { empresas: {
    'BIZ-003': { nome: 'Humano Digital', pacote: { estado: 'CONFIRMADO' } },
  }, agentes: [{ id: 'AGT-01', nome: 'Helena', estado: 'ESTAGIO' }] } } };
function repositorios() {
  const cards = { listar: vi.fn<RepositorioCardsV2['listar']>().mockResolvedValue([]) } as unknown as RepositorioCardsV2;
  const pedidos = { listar: vi.fn<RepositorioPedidosV2['listar']>().mockResolvedValue({ limite: 50, itens: [] }) } as unknown as RepositorioPedidosV2;
  const config = { listar: vi.fn<RepositorioConfigV2['listar']>().mockResolvedValue([{ ...detalhe }]),
    ler: vi.fn<RepositorioConfigV2['ler']>().mockResolvedValue(detalhe) } as unknown as RepositorioConfigV2;
  return { cards, pedidos, config };
}
function montar(repos: ReturnType<typeof repositorios>) {
  const pagina = () => <MemoryRouter><PainelV2Page repositorioCards={repos.cards}
    repositorioPedidos={repos.pedidos} repositorioConfig={repos.config}/></MemoryRouter>;
  const tela = render(pagina());
  return { ...tela, atualizar: () => tela.rerender(pagina()) };
}
beforeEach(() => { auth.userId = 'fundador-a'; auth.isFounder = true; });

it('resume apenas a amostra real de cards e pedidos, com decisão e links válidos', async () => {
  const repos = repositorios();
  const cardId = '11111111-1111-4111-8111-111111111111';
  const pedidoId = '22222222-2222-4222-8222-222222222222';
  vi.mocked(repos.cards.listar).mockResolvedValue([{ ...card(cardId, 'ESPERANDO_CONFIRMACAO'), titulo: 'Decisão do fundador' }, card('andando', 'EM_ANDAMENTO'), card('feito', 'PRONTO')]);
  vi.mocked(repos.pedidos.listar).mockResolvedValue({ limite: 50, itens: [pedido(pedidoId, 'RECEBIDO'), pedido('pedido-b', 'CARD_CRIADO')] });
  montar(repos);
  expect(await screen.findByText('3')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getAllByText('1')).toHaveLength(2);
  expect(screen.getByRole('link', { name: /Ver primeiro card/ }).getAttribute('href')).toBe(`/cards?card=${cardId}`);
  expect(screen.getByRole('link', { name: 'Abrir quadro de cards' }).getAttribute('href')).toBe('/cards');
  expect(screen.getByRole('link', { name: 'Abrir acompanhamento' }).getAttribute('href')).toBe(`/cards?pedido=${pedidoId}`);
  expect(screen.getByText('Recebido para triagem; ainda não virou card.')).toBeTruthy();
  expect(screen.getByText(/Estes são cadastros e estados previstos/)).toBeTruthy();
  expect(screen.getByText('Humano Digital')).toBeTruthy();
  expect(screen.getByText('Configuração: estágio')).toBeTruthy();
  expect(screen.getByText(/números descrevem apenas esta amostra visível/)).toBeTruthy();
});

it('mantém falhas separadas de zero e permite repetir apenas a leitura que falhou', async () => {
  const repos = repositorios();
  vi.mocked(repos.cards.listar).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  vi.mocked(repos.pedidos.listar).mockResolvedValue({ limite: 50, itens: [pedido('pedido-a', 'RECEBIDO')] });
  montar(repos);
  expect(await screen.findByText('Não foi possível consultar os cards. Tente atualizar.')).toBeTruthy();
  expect(screen.queryByText('Nenhum card disponível.')).toBeNull();
  expect(screen.getByText('Pedido pedido-a')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar cards' }));
  expect(await screen.findByText('Nenhum card disponível.')).toBeTruthy();
  expect(repos.cards.listar).toHaveBeenCalledTimes(2);
  expect(repos.pedidos.listar).toHaveBeenCalledTimes(1);
});

it('membro não aciona leituras reservadas nem vê os dados antigos do fundador', async () => {
  const repos = repositorios();
  vi.mocked(repos.cards.listar).mockResolvedValue([card('privado', 'ESPERANDO_FUNDADOR')]);
  const tela = montar(repos);
  expect((await screen.findAllByText('Card privado')).length).toBeGreaterThan(0);
  auth.isFounder = false;
  tela.atualizar();
  expect(screen.queryByText('Card privado')).toBeNull();
  expect(screen.getByText(/reservado à conta do fundador/)).toBeTruthy();
  const leituras = [repos.cards.listar, repos.pedidos.listar, repos.config.listar].map(fn => vi.mocked(fn).mock.calls.length);
  await act(async () => { await Promise.resolve(); });
  expect([repos.cards.listar, repos.pedidos.listar, repos.config.listar].map(fn => vi.mocked(fn).mock.calls.length)).toEqual(leituras);
});

it('membro direto não consulta dados e troca de identidade descarta resposta antiga', async () => {
  const repos = repositorios();
  auth.isFounder = false;
  const membro = montar(repos);
  expect(screen.getByText(/reservado à conta do fundador/)).toBeTruthy();
  expect(repos.cards.listar).not.toHaveBeenCalled();
  expect(repos.pedidos.listar).not.toHaveBeenCalled();
  expect(repos.config.listar).not.toHaveBeenCalled();
  membro.unmount();

  auth.isFounder = true;
  let resolver!: (cards: CardV2[]) => void;
  vi.mocked(repos.cards.listar).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; })).mockResolvedValueOnce([]);
  const tela = montar(repos);
  auth.userId = 'fundador-b';
  tela.atualizar();
  await act(async () => resolver([card('antigo', 'EM_ANDAMENTO')]));
  expect(await screen.findByText('Nenhum card disponível.')).toBeTruthy();
  expect(screen.queryByText('Card antigo')).toBeNull();
});

it('catálogo indisponível não inventa empresa/agente nem esconde pedidos e cards', async () => {
  const repos = repositorios();
  vi.mocked(repos.config.ler).mockRejectedValue(new Error('indisponível'));
  montar(repos);
  const secao = screen.getByRole('region', { name: 'Empresas e agentes' });
  expect(await within(secao).findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Humano Digital')).toBeNull();
  expect(await screen.findByText('Nenhum card disponível.')).toBeTruthy();
  expect(screen.getByText('Nenhum pedido recente.')).toBeTruthy();
});

it('não apresenta catálogo de revisão que deixou de ser a ativa entre as duas leituras', async () => {
  const repos = repositorios();
  vi.mocked(repos.config.ler).mockResolvedValueOnce({ ...detalhe, ativa: false }).mockResolvedValueOnce(detalhe);
  montar(repos);
  const secao = screen.getByRole('region', { name: 'Empresas e agentes' });
  expect(await within(secao).findByRole('alert')).toBeTruthy();
  expect(within(secao).queryByText('Humano Digital')).toBeNull();
  fireEvent.click(within(secao).getByRole('button', { name: 'Atualizar' }));
  expect(await within(secao).findByText('Humano Digital')).toBeTruthy();
  expect(repos.config.ler).toHaveBeenCalledTimes(2);
});
