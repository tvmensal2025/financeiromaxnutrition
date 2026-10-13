import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import CardV2Page from './CardV2Page';
import type { RepositorioCardsV2 } from '@/integrations/cards-v2/repository';

const auth = vi.hoisted(() => ({ isFounder: false }));
vi.mock('@/auth', () => ({ useAuth: () => ({ isFounder: auth.isFounder }) }));

const card = (id: string, titulo: string) => ({ id, titulo, empresa: null, estado: 'EM_ANDAMENTO', dono: 'Helena', prazo: '2026-10-13', criado_em: '2026-10-12T12:00:00Z' });
function repositorio(parcial: Partial<RepositorioCardsV2> = {}): RepositorioCardsV2 {
  return {
    listar: vi.fn().mockResolvedValue([]),
    detalhar: vi.fn().mockResolvedValue({ etapas: [], entregas: [] }),
    situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: false, dia_brasilia: '2026-10-13', pedido: null }),
    pedirPublicacao: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  };
}

beforeEach(() => { auth.isFounder = false; });

it('mostra vazio, erro e permite tentar novamente', async () => {
  const listar = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  render(<CardV2Page repositorio={repositorio({ listar })} />);
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
  render(<CardV2Page repositorio={repo} />);
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
  render(<CardV2Page repositorio={repositorio({ situacaoPublicacao, pedirPublicacao })} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir publicação' }));
  await waitFor(() => expect(pedirPublicacao).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(/Pedido de hoje registrado/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
});

it('não oferece publicação a membro ou se o banco falhar', async () => {
  auth.isFounder = false;
  const view = render(<CardV2Page repositorio={repositorio({ situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: true, dia_brasilia: '2026-10-13', pedido: null }) })} />);
  await waitFor(() => expect(screen.queryByText('Carregando situação de publicação…')).toBeNull());
  expect(screen.queryByRole('button', { name: 'Pedir publicação' })).toBeNull();
  view.unmount();
  auth.isFounder = true;
  render(<CardV2Page repositorio={repositorio({ situacaoPublicacao: vi.fn().mockRejectedValue(new Error('offline')) })} />);
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
  render(<CardV2Page repositorio={repo} />);
  expect(await screen.findByText(/Não foi possível consultar a publicação/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar novamente' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir publicação' }));
  expect(await screen.findByText(/Não foi possível confirmar o pedido/)).toBeTruthy();
  expect(screen.queryByText(/Pedido de hoje registrado/)).toBeNull();
});

it('recarrega o detalhe quando o card selecionado é clicado novamente', async () => {
  const detalhar = vi.fn()
    .mockResolvedValueOnce({ etapas: [{ id: 'e1', codigo: 'E1', nome: 'Primeira versão', estado: 'PRONTA', autor: 'Clara', dono: null, prazo_ate: null, revisores: [], versao: 1, portao1_ok: true, entrega_fresca: true }], entregas: [] })
    .mockResolvedValueOnce({ etapas: [{ id: 'e1', codigo: 'E1', nome: 'Versão atualizada', estado: 'PRONTA', autor: 'Clara', dono: null, prazo_ate: null, revisores: [], versao: 2, portao1_ok: true, entrega_fresca: true }], entregas: [] });
  render(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([card('a', 'Card A')]), detalhar })} />);
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
  render(<CardV2Page repositorio={repositorio({ listar: vi.fn().mockResolvedValue([card('a', 'Card A')]), detalhar: vi.fn().mockResolvedValue(detalhe) })} />);
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
  render(<CardV2Page repositorio={repositorio({ listar, detalhar })} />);
  fireEvent.click(await screen.findByRole('button', { name: /Card A/ }));
  expect(await screen.findByText('Este card ainda não tem etapas.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar cards' }));
  expect(await screen.findByText(/Etapa atual/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Card atualizado/ })).toBeTruthy();
  expect(listar).toHaveBeenCalledTimes(2);
  expect(detalhar).toHaveBeenCalledTimes(2);
});
