import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EntradaPedidosV2 } from './EntradaPedidosV2';
import { salvarPedidoPendente } from '@/integrations/pedidos-v2/pendente';
import { ErroEntradaPedidos, type PedidoEntrada, type RepositorioPedidosV2 } from '@/integrations/pedidos-v2/repository';

vi.mock('@/integrations/pedidos-v2/runtime', () => ({ repositorioPedidosV2DoApp: vi.fn() }));
const requestId = '00000000-0000-4000-8000-000000000010';
const pedido: PedidoEntrada = { pedido_id: '00000000-0000-4000-8000-000000000020', request_id: requestId,
  estado: 'RECEBIDO', texto_inicial: 'Campanha da eLiving™', total_eventos: 1,
  criado_em: '2026-10-17T12:00:00Z', atualizado_em: '2026-10-17T12:00:00Z', origem_inicial: 'SITE' };
const detalhe = { ...pedido, eventos: [{ origem: 'SITE' as const, evento_id: `site:${requestId}`, texto: pedido.texto_inicial, recebido_em: pedido.criado_em }] };
function repositorio(parcial: Partial<RepositorioPedidosV2> = {}): RepositorioPedidosV2 {
  return { receber: vi.fn().mockResolvedValue(pedido), ler: vi.fn().mockResolvedValue(null),
    listar: vi.fn().mockResolvedValue({ limite: 50, itens: [] }), ...parcial };
}
beforeEach(() => { sessionStorage.clear(); vi.spyOn(crypto, 'randomUUID').mockReturnValue(requestId); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('registra texto livre, só anuncia recebimento confirmado e conserva o acompanhamento', async () => {
  const repo = repositorio();
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.change(screen.getByLabelText('Seu pedido'), { target: { value: '  Campanha da eLiving™  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
  expect(await screen.findByText('Pedido registrado para triagem')).toBeTruthy();
  expect(repo.receber).toHaveBeenCalledExactlyOnceWith({ requestId, eventoId: `site:${requestId}`, texto: 'Campanha da eLiving™' });
  expect(sessionStorage.getItem('helena-v2-entrada:fundador')).toBeNull();
  expect(screen.getByText(/Acompanhamento:/).textContent).toContain(requestId);
  expect(screen.getByText(/Nenhum trabalho foi executado/)).toBeTruthy();
});

it('evita envio duplicado durante uma resposta em andamento', async () => {
  let resolver!: (valor: PedidoEntrada) => void;
  const repo = repositorio({ receber: vi.fn().mockReturnValue(new Promise(resolve => { resolver = resolve; })) });
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.change(screen.getByLabelText('Seu pedido'), { target: { value: pedido.texto_inicial } });
  fireEvent.submit(screen.getByRole('button', { name: 'Registrar pedido' }).closest('form')!);
  fireEvent.submit(screen.getByRole('button', { name: 'Confirmando recebimento…' }).closest('form')!);
  expect(repo.receber).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Pedido registrado para triagem')).toBeNull();
  await act(async () => resolver(pedido));
});

it('recupera no banco uma resposta perdida sem registrar outro pedido', async () => {
  const repo = repositorio({ receber: vi.fn().mockRejectedValue(new Error('Conexão perdida')), ler: vi.fn().mockResolvedValue(detalhe) });
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.change(screen.getByLabelText('Seu pedido'), { target: { value: pedido.texto_inicial } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
  expect(await screen.findByText('Pedido registrado para triagem')).toBeTruthy();
  expect(repo.ler).toHaveBeenCalledWith(requestId);
  expect(repo.receber).toHaveBeenCalledTimes(1);
});

it('preserva recibo após falha e recarregamento, repetindo a mesma chave', async () => {
  const repo = repositorio({ receber: vi.fn().mockRejectedValueOnce(new Error('Conexão perdida')).mockResolvedValueOnce(pedido) });
  const tela = render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.change(screen.getByLabelText('Seu pedido'), { target: { value: pedido.texto_inicial } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
  expect(await screen.findByText('Ainda não foi possível confirmar o recebimento desta mensagem.')).toBeTruthy();
  const envio = JSON.parse(sessionStorage.getItem('helena-v2-entrada:fundador')!);
  tela.unmount();
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Recuperar pedido' }));
  expect(await screen.findByText('Pedido registrado para triagem')).toBeTruthy();
  expect(repo.receber).toHaveBeenNthCalledWith(2, envio);
});

it('não envia se o armazenamento local falhar', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
  const repo = repositorio();
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.change(screen.getByLabelText('Seu pedido'), { target: { value: pedido.texto_inicial } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
  expect(await screen.findByText(/Nenhum pedido foi enviado/)).toBeTruthy();
  expect(repo.receber).not.toHaveBeenCalled();
});

it('bloqueia recibo local danificado e mantém consulta do histórico', async () => {
  sessionStorage.setItem('helena-v2-entrada:fundador', '{inválido');
  const repo = repositorio({ listar: vi.fn().mockResolvedValue({ limite: 50, itens: [pedido] }) });
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  expect(await screen.findByText(/Não foi possível recuperar o recibo/)).toBeTruthy();
  expect(await screen.findByText(pedido.texto_inicial)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Registrar pedido' }) as HTMLButtonElement).disabled).toBe(true);
  expect(repo.receber).not.toHaveBeenCalled();
});

it('isola recibos e respostas atrasadas ao trocar a identidade', async () => {
  salvarPedidoPendente('conta-a', { requestId, eventoId: 'site:anterior', texto: 'Pedido privado A' }, sessionStorage);
  let resolver!: (valor: PedidoEntrada) => void;
  const repo = repositorio({ receber: vi.fn().mockReturnValue(new Promise(resolve => { resolver = resolve; })) });
  const tela = render(<EntradaPedidosV2 identidade="conta-a" repositorio={repo} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Recuperar pedido' }));
  tela.rerender(<EntradaPedidosV2 identidade="conta-b" repositorio={repo} />);
  await act(async () => resolver({ ...pedido, texto_inicial: 'Pedido privado A' }));
  expect((screen.getByLabelText('Seu pedido') as HTMLTextAreaElement).value).toBe('');
  expect(screen.queryByText('Pedido privado A')).toBeNull();
  expect(sessionStorage.getItem('helena-v2-entrada:conta-a')).toBeTruthy();
});

it('recusa texto vazio e mostra falha de listagem sem fingir fila vazia', async () => {
  const repo = repositorio({ listar: vi.fn().mockRejectedValueOnce(new Error('Consulta indisponível')).mockResolvedValueOnce({ limite: 50, itens: [] }) });
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  expect(await screen.findByText('Não foi possível consultar os pedidos.')).toBeTruthy();
  expect(screen.queryByText('Nenhum pedido registrado.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar pedidos' }));
  expect(await screen.findByText('Nenhum pedido registrado.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Registrar pedido' }) as HTMLButtonElement).disabled).toBe(true);
  expect(repo.receber).not.toHaveBeenCalled();
});

it('não confirma uma mensagem recusada só porque outro evento existe no mesmo acompanhamento', async () => {
  const repo = repositorio({ receber: vi.fn().mockRejectedValue(new ErroEntradaPedidos('23505')),
    ler: vi.fn().mockResolvedValue({ ...detalhe, eventos: [{ ...detalhe.eventos[0], evento_id: 'site:outro', texto: 'Conteúdo anterior' }] }) });
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.change(screen.getByLabelText('Seu pedido'), { target: { value: pedido.texto_inicial } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
  expect(await screen.findByText(/Este identificador já foi usado/)).toBeTruthy();
  expect(screen.queryByText('Pedido registrado para triagem')).toBeNull();
  expect(sessionStorage.getItem('helena-v2-entrada:fundador')).toBeTruthy();
});

it('guarda último acompanhamento e consulta histórico completo após recarga mesmo fora da lista', async () => {
  const repo = repositorio({ ler: vi.fn().mockResolvedValue({ ...detalhe, total_eventos: 2, eventos: [detalhe.eventos[0],
    { ...detalhe.eventos[0], origem: 'TELEGRAM', evento_id: 'telegram:42', texto: 'Acrescentar prazo de sexta-feira' }] }) });
  const tela = render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.change(screen.getByLabelText('Seu pedido'), { target: { value: pedido.texto_inicial } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
  expect(await screen.findByText('Pedido registrado para triagem')).toBeTruthy();
  tela.unmount();
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  expect((screen.getByLabelText('Consultar acompanhamento') as HTMLInputElement).value).toBe(requestId);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar pedido' }));
  expect(await screen.findByText('Acrescentar prazo de sexta-feira')).toBeTruthy();
  expect(repo.ler).toHaveBeenCalledWith(requestId);
  expect(repo.receber).toHaveBeenCalledTimes(1);
});

it('consulta ausente ou com erro não apaga um envio pendente e não expõe mensagens internas', async () => {
  salvarPedidoPendente('fundador', { requestId, eventoId: 'site:anterior', texto: 'Pedido pendente' }, sessionStorage);
  const repo = repositorio({ ler: vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('senha-interna-sintética')) });
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repo} />);
  fireEvent.change(screen.getByLabelText('Consultar acompanhamento'), { target: { value: requestId } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar pedido' }));
  expect(await screen.findByText('Pedido não encontrado para esta conta.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar pedido' }));
  expect(await screen.findByText('Não foi possível consultar este acompanhamento.')).toBeTruthy();
  expect(screen.queryByText('senha-interna-sintética')).toBeNull();
  expect(sessionStorage.getItem('helena-v2-entrada:fundador')).toBeTruthy();
  expect(repo.receber).not.toHaveBeenCalled();
});

it('distingue plano confirmado de card criado e só liga UUID válido ao Kanban', async () => {
  const metadados = { empresa_id: 'BIZ-003', empresa_confirmada: true,
    config_revision_id: '33333333-3333-4333-8333-333333333333', titulo_confirmado: 'Campanha da eLiving™',
    prazo_confirmado: '2026-10-30T12:00:00Z', plano_hash: 'a'.repeat(64) };
  const aguardando: PedidoEntrada = { ...pedido, ...metadados, pedido_id: '44444444-4444-4444-8444-444444444444',
    request_id: '55555555-5555-4555-8555-555555555555', estado: 'PLANO_CONFIRMADO', card_id: null };
  const criado: PedidoEntrada = { ...pedido, ...metadados, pedido_id: '66666666-6666-4666-8666-666666666666',
    request_id: '77777777-7777-4777-8777-777777777777', estado: 'CARD_CRIADO', card_id: '88888888-8888-4888-8888-888888888888' };
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repositorio({ listar: vi.fn().mockResolvedValue({ limite: 50, itens: [aguardando, criado] }) })} />);
  expect(await screen.findByText('Plano confirmado · aguardando criação do card')).toBeTruthy();
  expect(screen.getByText('Card criado · acompanhe no Kanban')).toBeTruthy();
  const links = screen.getAllByRole('link', { name: 'Abrir card no Kanban' }) as HTMLAnchorElement[];
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('href')).toBe(`/?card=${criado.card_id}`);
  expect(screen.queryByText(/No ar|Publicado|Trabalho concluído/i)).toBeNull();
});

it('não cria link quando um repositório injetado devolve card_id inválido', async () => {
  const estranho: PedidoEntrada = { ...pedido, estado: 'CARD_CRIADO', card_id: 'javascript:alert(1)' };
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repositorio({ listar: vi.fn().mockResolvedValue({ limite: 50, itens: [estranho] }) })} />);
  expect(await screen.findByText('Card criado · vínculo do card indisponível')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Abrir card no Kanban' })).toBeNull();
});

it('atualiza o recibo aberto quando a listagem confirma a criação posterior do card', async () => {
  const criado: PedidoEntrada = { ...pedido, estado: 'CARD_CRIADO', empresa_id: 'BIZ-003', empresa_confirmada: true,
    config_revision_id: '33333333-3333-4333-8333-333333333333', card_id: '88888888-8888-4888-8888-888888888888',
    titulo_confirmado: 'Campanha', prazo_confirmado: '2026-10-30T12:00:00Z', plano_hash: 'a'.repeat(64) };
  const listar = vi.fn().mockResolvedValueOnce({ limite: 50, itens: [] })
    .mockResolvedValueOnce({ limite: 50, itens: [criado] });
  render(<EntradaPedidosV2 identidade="fundador" repositorio={repositorio({ listar })} />);
  fireEvent.change(screen.getByLabelText('Seu pedido'), { target: { value: pedido.texto_inicial } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
  expect(await screen.findByText('Pedido identificado no banco')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: 'Abrir card no Kanban' })).toHaveLength(2);
  expect(screen.queryByText(/Nenhum trabalho foi executado/)).toBeNull();
});
