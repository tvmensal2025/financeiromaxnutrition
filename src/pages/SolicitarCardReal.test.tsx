import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SolicitarCardReal } from './SolicitarCardReal';
import type { RepositorioCardsV2 } from '@/integrations/cards-v2/repository';

// Envelope sintético somente para este teste local; nenhum dado entra no produto.
function jsonDeTeste() {
  const hash = 'a'.repeat(64);
  const tarefa = { task_id: 'TSK-TESTE', business_id: 'BIZ-TESTE', tarefa: 'Pedido literal do teste.' };
  return JSON.stringify({ estado: 'AGUARDANDO_CONFIRMACAO', tarefa_id: tarefa.task_id, business_id: tarefa.business_id,
    pendencias: [{ campo: 'prazo', motivo: 'Confirmar prazo no teste local.' }],
    dados_reais: { decisoes: [], entradas_externas: {}, fontes_importadas: {
      'FON-PEDIDO-TSK-TESTE': tarefa.tarefa, 'FON-JOB-TESTE': 'Documento privado só do teste',
    },
      pedido: { empresa: tarefa.business_id, plano: { empresas: [tarefa.business_id] },
        pacote_da_empresa: { estado: 'CONFIRMADO' },
        ordem_de_servico: { empresa: tarefa.business_id, pedido_original: tarefa.tarefa,
          definicao_de_pronto_na_fonte: 'Entrega revisada no teste.', prazo: null,
          como_e_o_pronto: [], nao_pode: [], fontes_que_pode_ler: [] } },
      captura: { fonte: 'management_read_only', projeto: { ref: 'projeto-teste' }, business_id: tarefa.business_id,
        tarefa, empresa: { business_id: tarefa.business_id }, proveniencia: { hash_sha256: hash } },
      proveniencia: { tarefa_id: tarefa.task_id, business_id: tarefa.business_id, project_ref: 'projeto-teste', hash_sha256: hash },
    } });
}

function arquivo(conteudo = jsonDeTeste(), nome = 'preparacao.json', tipo = 'application/json') {
  const file = new File([conteudo], nome, { type: tipo });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(conteudo) });
  return file;
}

function repo(solicitar = vi.fn().mockResolvedValue({ id: 'solicitacao-teste', card_id: null }),
  consultar = vi.fn().mockResolvedValue(null)) {
  return { solicitarCardReal: solicitar, consultarSolicitacaoPorChave: consultar,
    listarSolicitacoesReais: vi.fn().mockResolvedValue([]), consultarSolicitacaoPorTarefa: vi.fn().mockResolvedValue(null) } as unknown as RepositorioCardsV2;
}

async function importar(file = arquivo(), repositorio = repo()) {
  render(<SolicitarCardReal repositorio={repositorio} identidade="fundador-teste" onCardCriado={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Arquivo de preparação privada'), { target: { files: [file] } });
  await screen.findByText('Pedido literal do teste.');
}

function preencher() {
  fireEvent.change(screen.getByLabelText('Prazo confirmado com data, hora e fuso'), { target: { value: '2030-10-20T15:00:00-03:00' } });
  fireEvent.change(screen.getByLabelText('Critério 1'), { target: { value: 'Entrega verificável no teste' } });
  fireEvent.change(screen.getByLabelText('Quem confere'), { target: { value: 'IA' } });
  fireEvent.change(screen.getByLabelText('Risco'), { target: { value: 'ALTO' } });
  fireEvent.click(screen.getByLabelText('Não há restrições adicionais a registrar'));
  fireEvent.change(screen.getByLabelText('Fontes externas autorizadas'), { target: { value: 'https://www.gov.br/assunto' } });
  fireEvent.click(screen.getByLabelText(/Conferi a tarefa, empresa/));
}

afterEach(() => vi.unstubAllGlobals());

it('recusa arquivo não JSON, inválido ou grande sem enviar nada ao banco', async () => {
  const solicitar = vi.fn();
  const repositorio = repo(solicitar);
  render(<SolicitarCardReal repositorio={repositorio} identidade="fundador-teste" onCardCriado={vi.fn()} />);
  const input = screen.getByLabelText('Arquivo de preparação privada');
  fireEvent.change(input, { target: { files: [arquivo('{}', 'captura.txt', 'text/plain')] } });
  expect(await screen.findByText(/com até 1 MB/)).toBeTruthy();
  fireEvent.change(input, { target: { files: [arquivo('{')] } });
  expect(await screen.findByText(/não contém JSON válido/)).toBeTruthy();
  const grande = arquivo(' '.repeat(1_000_001));
  fireEvent.change(input, { target: { files: [grande] } });
  expect(await screen.findByText(/até 1 MB/)).toBeTruthy();
  expect(solicitar).not.toHaveBeenCalled();
});

it('exige conferência explícita e envia somente quatro campos editados com revisão resolvida no servidor', async () => {
  const solicitar = vi.fn().mockResolvedValue({ id: 'solicitacao-teste', card_id: null });
  const repositorio = repo(solicitar);
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-teste' });
  await importar(arquivo(), repositorio);
  expect(screen.getByLabelText('Prazo confirmado com data, hora e fuso')).toHaveProperty('value', '');
  expect(screen.getByText('Confirmar prazo no teste local.')).toBeTruthy();
  expect(screen.getByText(/FON-JOB-TESTE/)).toBeTruthy();
  expect(screen.queryByText(/Documento privado só do teste/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar e solicitar card real' }));
  expect(await screen.findByText(/Confirme de um a cinco critérios/)).toBeTruthy();
  expect(solicitar).not.toHaveBeenCalled();
  preencher();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar e solicitar card real' }));
  await waitFor(() => expect(solicitar).toHaveBeenCalledTimes(1));
  const pedido = solicitar.mock.calls[0][0];
  expect(pedido).toMatchObject({ tarefaId: 'TSK-TESTE', prazo: '2030-10-20T15:00:00-03:00',
    configRevisionId: null, chaveIdempotencia: 'uuid-teste' });
  expect(pedido.dadosReais.captura.tarefa.tarefa).toBe('Pedido literal do teste.');
  expect(pedido.dadosReais.pedido.ordem_de_servico).toMatchObject({
    como_e_o_pronto: [{ id: 'CARD-1', texto: 'Entrega verificável no teste', quem_confere: 'IA', risco: 'ALTO' }],
    nao_pode: [], fontes_que_pode_ler: ['https://www.gov.br/assunto'],
  });
  expect(await screen.findByText(/Aguarda processamento/)).toBeTruthy();
});

it('após falha ambígua consulta o registro RLS e conserva a chave no retry', async () => {
  const solicitar = vi.fn().mockRejectedValueOnce(new Error('Conexão perdida')).mockResolvedValueOnce({ id: 'pedido-teste', card_id: null });
  const consultar = vi.fn().mockResolvedValue(null);
  const repositorio = repo(solicitar, consultar);
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-estavel' });
  await importar(arquivo(), repositorio);
  preencher();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar e solicitar card real' }));
  expect(await screen.findByText(/Nenhuma confirmação foi encontrada/)).toBeTruthy();
  expect(screen.getByLabelText('Arquivo de preparação privada')).toHaveProperty('disabled', true);
  expect(screen.getByLabelText('Prazo confirmado com data, hora e fuso')).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Tentar confirmar a mesma solicitação' }));
  expect(consultar).toHaveBeenCalledWith('uuid-estavel');
  await waitFor(() => expect(solicitar).toHaveBeenCalledTimes(2));
  expect(solicitar.mock.calls[1][0].chaveIdempotencia).toBe('uuid-estavel');
});

it('mantém edição e importação bloqueadas após falha dupla até retry da mesma solicitação', async () => {
  const solicitar = vi.fn().mockRejectedValueOnce(new Error('Conexão perdida')).mockResolvedValueOnce({ id: 'pedido-teste', card_id: null });
  const consultar = vi.fn().mockRejectedValueOnce(new Error('Consulta indisponível'));
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-estavel' });
  const repositorio = repo(solicitar, consultar);
  await importar(arquivo(), repositorio);
  preencher();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar e solicitar card real' }));
  expect(await screen.findByText(/Não foi possível confirmar se o pedido foi registrado/)).toBeTruthy();
  const file = screen.getByLabelText('Arquivo de preparação privada');
  const prazo = screen.getByLabelText('Prazo confirmado com data, hora e fuso');
  expect(file).toHaveProperty('disabled', true);
  expect(prazo).toHaveProperty('disabled', true);
  fireEvent.change(file, { target: { files: [arquivo()] } });
  fireEvent.change(prazo, { target: { value: '2031-10-20T15:00:00-03:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tentar confirmar a mesma solicitação' }));
  await waitFor(() => expect(solicitar).toHaveBeenCalledTimes(2));
  expect(solicitar.mock.calls[1][0]).toEqual(solicitar.mock.calls[0][0]);
});

it('após recarga encontra a solicitação da tarefa pela RLS e impede novo envio', async () => {
  const solicitar = vi.fn();
  const existente = { id: 'pedido-registrado', chave_origem: 'TSK-TESTE', card_id: null, criado_em: '2026-10-13T12:00:00Z' };
  const repositorio = repo(solicitar);
  repositorio.listarSolicitacoesReais = vi.fn().mockResolvedValue([existente]);
  repositorio.consultarSolicitacaoPorTarefa = vi.fn().mockResolvedValue(existente);
  await importar(arquivo(), repositorio);
  expect(await screen.findByText(/Esta tarefa já tem a solicitação pedido-registrado/)).toBeTruthy();
  expect(screen.getByText(/Solicitações registradas desta conta/)).toBeTruthy();
  preencher();
  expect(screen.getByRole('button', { name: 'Confirmar e solicitar card real' })).toHaveProperty('disabled', true);
  expect(solicitar).not.toHaveBeenCalled();
});

it('não mostra histórico da conta anterior quando uma consulta antiga termina após troca de identidade', async () => {
  let resolverAntigo!: (lista: unknown[]) => void;
  const antigo = new Promise<unknown[]>(resolve => { resolverAntigo = resolve; });
  const repositorio = repo();
  repositorio.listarSolicitacoesReais = vi.fn().mockReturnValueOnce(antigo).mockResolvedValueOnce([]);
  const tela = render(<SolicitarCardReal repositorio={repositorio} identidade="usuario-a" onCardCriado={vi.fn()} />);
  tela.rerender(<SolicitarCardReal repositorio={repositorio} identidade="usuario-b" onCardCriado={vi.fn()} />);
  resolverAntigo([{ id: 'pedido-privado-a', chave_origem: 'TSK-A', criado_em: '2026-10-13T00:00:00Z', card_id: null }]);
  await waitFor(() => expect(repositorio.listarSolicitacoesReais).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(/pedido-privado-a/)).toBeNull();
});
