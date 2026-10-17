import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PropostaPedidoV2 } from './PropostaPedidoV2';
import { ErroEntradaPedidos, type DetalhePedidoEntrada, type LeituraPropostaPedido,
  type PedidoEntrada, type RepositorioPedidosV2 } from '@/integrations/pedidos-v2/repository';

const requestId = '11111111-1111-4111-8111-111111111111';
const propostaId = '22222222-2222-4222-8222-222222222222';
const pedido: PedidoEntrada = { pedido_id: '33333333-3333-4333-8333-333333333333', request_id: requestId,
  estado: 'RECEBIDO', texto_inicial: 'Preparar campanha', total_eventos: 1,
  criado_em: '2026-10-17T12:00:00Z', atualizado_em: '2026-10-17T12:00:00Z', origem_inicial: 'SITE' };
const evento = { origem: 'SITE' as const, evento_id: 'site:inicial', texto: pedido.texto_inicial, recebido_em: pedido.criado_em };
const detalhe: DetalhePedidoEntrada = { ...pedido, eventos: [evento] };
const proposta: NonNullable<LeituraPropostaPedido['proposta_helena']> = {
  id: propostaId, tipo: 'PROPOR', perguntas: [], resumo: 'Campanha com revisão do texto',
  empresa_id: 'BIZ-003', titulo: 'Campanha eLiving', prazo: '2026-10-30T12:00:00Z',
  plano: { empresas: ['BIZ-003'], etapas: [{ id: 'etapa-1', servico: 'SRV-ESTRATEGIA',
    objetivo: 'Definir mensagem central', entradas: [], depende_de: [] }] },
  config_revision_id: '44444444-4444-4444-8444-444444444444', eventos_hash: 'a'.repeat(64),
  criado_em: '2026-10-17T12:05:00Z', atual: true, validacao_metadados: {},
};
const leitura: LeituraPropostaPedido = { ...pedido, proposta_helena: proposta, perguntas: [] };
function repo(parcial: Partial<RepositorioPedidosV2> = {}): RepositorioPedidosV2 {
  return { receber: vi.fn().mockResolvedValue(pedido), ler: vi.fn().mockResolvedValue(detalhe),
    listar: vi.fn().mockResolvedValue({ limite: 50, itens: [pedido] }),
    lerProposta: vi.fn().mockResolvedValue(leitura), confirmarProposta: vi.fn().mockResolvedValue(pedido), ...parcial };
}
function abrir(repositorio: RepositorioPedidosV2, identidade = 'fundador') {
  return render(<PropostaPedidoV2 identidade={identidade} requestId={requestId} repositorio={repositorio} aoAtualizar={vi.fn()} />);
}
beforeEach(() => { sessionStorage.clear(); vi.spyOn(crypto, 'randomUUID').mockReturnValue('55555555-5555-4555-8555-555555555555'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('mostra empresa, serviço, etapas, prazo, fontes e ambiguidades antes da confirmação explícita', async () => {
  const repositorio = repo();
  abrir(repositorio);
  expect(await screen.findByText('Campanha com revisão do texto')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Proposta do pedido' }).textContent).toContain('Empresa: BIZ-003');
  expect(screen.getByRole('region', { name: 'Proposta do pedido' }).textContent).toContain('SRV-ESTRATEGIA · Definir mensagem central');
  expect(screen.getByRole('region', { name: 'Proposta do pedido' }).textContent).toContain('30/10/2026, 09:00:00 (horário de Brasília)');
  expect(screen.getByText('Preparar campanha')).toBeTruthy();
  expect(screen.getByText(/Ambiguidades pendentes:/)).toBeTruthy();
  expect(repositorio.confirmarProposta).not.toHaveBeenCalled();
});

it('não confirma proposta obsoleta ou bloqueada; permite pedir alteração no mesmo pedido', async () => {
  const repositorio = repo({ lerProposta: vi.fn().mockResolvedValue({ ...leitura,
    proposta_helena: { ...proposta, atual: false, validacao_metadados: { bloqueio: 'PEDIDO_FONTE_LEIS_AUSENTE' } } }) });
  abrir(repositorio);
  const botao = await screen.findByRole('button', { name: 'Confirmar esta proposta' }) as HTMLButtonElement;
  expect(botao.disabled).toBe(true);
  expect(screen.getByText(/ficou desatualizada/)).toBeTruthy();
  expect(screen.getByText(/Falta uma fonte de leis/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Enviar resposta ou alteração' })).toBeTruthy();
  expect(repositorio.confirmarProposta).not.toHaveBeenCalled();
});

it('recupera resposta após perda de rede e remount sem criar outro evento', async () => {
  const repositorio = repo({ receber: vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockResolvedValueOnce(pedido),
    ler: vi.fn().mockResolvedValue(detalhe) });
  const tela = abrir(repositorio);
  await screen.findByText('Campanha com revisão do texto');
  fireEvent.change(screen.getByLabelText('Responder ou pedir alteração'), { target: { value: 'Alterar prazo para novembro' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta ou alteração' }));
  expect(await screen.findByText('Ainda não foi possível confirmar esta resposta.')).toBeTruthy();
  const salvo = JSON.parse(sessionStorage.getItem(`helena-v2-esclarecimento:fundador:${requestId}`)!);
  expect(salvo.eventoId).toBe('site:esclarecimento:55555555-5555-4555-8555-555555555555');
  tela.unmount();
  abrir(repositorio);
  fireEvent.click(await screen.findByRole('button', { name: 'Recuperar resposta' }));
  await waitFor(() => expect(sessionStorage.getItem(`helena-v2-esclarecimento:fundador:${requestId}`)).toBeNull());
  expect(repositorio.receber).toHaveBeenNthCalledWith(1, salvo);
  expect(repositorio.receber).toHaveBeenNthCalledWith(2, salvo);
  expect(repositorio.confirmarProposta).not.toHaveBeenCalled();
});

it('confere estado no banco quando a resposta de confirmação se perde', async () => {
  const confirmado: DetalhePedidoEntrada = { ...detalhe, estado: 'PLANO_CONFIRMADO',
    empresa_id: 'BIZ-003', empresa_confirmada: true, config_revision_id: proposta.config_revision_id,
    titulo_confirmado: proposta.titulo, prazo_confirmado: proposta.prazo, plano_hash: 'b'.repeat(64), card_id: null };
  const repositorio = repo({ confirmarProposta: vi.fn().mockRejectedValue(new Error('sem rede')),
    ler: vi.fn().mockResolvedValueOnce(detalhe).mockResolvedValueOnce(confirmado) });
  const aoAtualizar = vi.fn();
  render(<PropostaPedidoV2 identidade="fundador" requestId={requestId} repositorio={repositorio} aoAtualizar={aoAtualizar} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar esta proposta' }));
  await waitFor(() => expect(aoAtualizar).toHaveBeenCalledWith(confirmado));
  expect(repositorio.confirmarProposta).toHaveBeenCalledExactlyOnceWith(requestId, propostaId);
});

it('mostra rejeição por versão obsoleta e atualiza a proposta antes de permitir nova ação', async () => {
  const lerProposta = vi.fn().mockResolvedValueOnce(leitura).mockResolvedValueOnce({ ...leitura,
    proposta_helena: { ...proposta, atual: false } });
  const repositorio = repo({ lerProposta, confirmarProposta: vi.fn().mockRejectedValue(new ErroEntradaPedidos('40001', 'confirmarProposta')) });
  abrir(repositorio);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar esta proposta' }));
  expect(await screen.findByText(/A proposta mudou/)).toBeTruthy();
  await waitFor(() => expect((screen.getByRole('button', { name: 'Confirmar esta proposta' }) as HTMLButtonElement).disabled).toBe(true));
  expect(repositorio.confirmarProposta).toHaveBeenCalledTimes(1);
});

it('isola resposta pendente por identidade no remount', async () => {
  const repositorio = repo({ receber: vi.fn().mockRejectedValue(new Error('sem rede')) });
  const tela = abrir(repositorio, 'conta-a');
  await screen.findByText('Campanha com revisão do texto');
  fireEvent.change(screen.getByLabelText('Responder ou pedir alteração'), { target: { value: 'Resposta privada A' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta ou alteração' }));
  expect(await screen.findByText('Ainda não foi possível confirmar esta resposta.')).toBeTruthy();
  tela.unmount();
  abrir(repositorio, 'conta-b');
  await screen.findByText('Campanha com revisão do texto');
  expect((screen.getByLabelText('Responder ou pedir alteração') as HTMLTextAreaElement).value).toBe('');
  expect(screen.queryByText('Resposta privada A')).toBeNull();
  expect(sessionStorage.getItem(`helena-v2-esclarecimento:conta-a:${requestId}`)).toBeTruthy();
});
