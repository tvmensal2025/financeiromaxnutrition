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
  expect(screen.queryByText('Nenhum pedido em triagem.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar pedidos' }));
  expect(await screen.findByText('Nenhum pedido em triagem.')).toBeTruthy();
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
