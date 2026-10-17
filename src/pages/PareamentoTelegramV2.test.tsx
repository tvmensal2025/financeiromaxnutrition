import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PareamentoTelegramV2 } from './PareamentoTelegramV2';
import type { CodigoPareamentoTelegramV2, RepositorioPareamentoTelegramV2, StatusPareamentoTelegramV2 } from '@/integrations/telegram-v2/repository';

vi.mock('@/integrations/telegram-v2/runtime', () => ({ repositorioPareamentoTelegramV2DoApp: vi.fn() }));
const semVinculo: StatusPareamentoTelegramV2 = { vinculado: false, chat_id: null, usuario_id: null,
  vinculado_em: null, codigo_pendente: false, codigo_expira_em: null };
const vinculado: StatusPareamentoTelegramV2 = { ...semVinculo, vinculado: true,
  chat_id: '-100123456789012345', usuario_id: '123456789012345678', vinculado_em: '2026-10-17T12:00:00Z' };
const codigo = (expira_em: string): CodigoPareamentoTelegramV2 => ({ codigo: 'a'.repeat(48), expira_em });
function repositorio(parcial: Partial<RepositorioPareamentoTelegramV2> = {}): RepositorioPareamentoTelegramV2 {
  return { consultar: vi.fn().mockResolvedValue(semVinculo), gerar: vi.fn().mockResolvedValue(codigo(new Date(Date.now() + 600_000).toISOString())),
    revogar: vi.fn().mockResolvedValue(semVinculo), ...parcial };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('não anuncia vínculo antes de consultar o banco e mostra apenas metadados da conta vinculada', async () => {
  let resolver!: (valor: StatusPareamentoTelegramV2) => void;
  const repo = repositorio({ consultar: vi.fn().mockReturnValue(new Promise(resolve => { resolver = resolve; })) });
  render(<PareamentoTelegramV2 identidade="fundador" repositorio={repo} />);
  expect(screen.queryByText(/Telegram vinculado conforme/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Gerar código de pareamento' })).toBeNull();
  await act(async () => resolver(vinculado));
  expect(screen.getByText(/Telegram vinculado conforme consulta ao banco/)).toBeTruthy();
  expect(screen.getByText(/-100123456789012345/)).toBeTruthy();
  expect(screen.queryByText('a'.repeat(48))).toBeNull();
});

it('mostra código apenas na tela, nunca no link do bot nem no armazenamento', async () => {
  const escritaSessao = vi.spyOn(Storage.prototype, 'setItem');
  const repo = repositorio();
  render(<PareamentoTelegramV2 identidade="fundador" repositorio={repo} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar código de pareamento' }));
  expect(await screen.findByLabelText('Código de pareamento')).toBeTruthy();
  const link = screen.getByRole('link', { name: '@hermes_helena_oficial_bot' }) as HTMLAnchorElement;
  expect(link.href).toBe('https://t.me/hermes_helena_oficial_bot');
  expect(link.href).not.toContain('a'.repeat(48));
  expect(screen.getByText(/vincular/)).toBeTruthy();
  expect(escritaSessao).not.toHaveBeenCalled();
});

it('retira código vencido da tela sem supor que houve vínculo', async () => {
  vi.useFakeTimers();
  const inicio = Date.now();
  vi.setSystemTime(inicio);
  const repo = repositorio({ gerar: vi.fn().mockResolvedValue(codigo(new Date(inicio + 3_000).toISOString())) });
  render(<PareamentoTelegramV2 identidade="fundador" repositorio={repo} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Gerar código de pareamento' }));
  await act(async () => {});
  expect(screen.getByLabelText('Código de pareamento')).toBeTruthy();
  await act(async () => { vi.advanceTimersByTime(4_000); });
  expect(screen.queryByLabelText('Código de pareamento')).toBeNull();
  expect(screen.getByText(/O código expirou/)).toBeTruthy();
  expect(screen.queryByText(/Telegram vinculado conforme/)).toBeNull();
});

it('retira código que o banco já não reconhece como pendente', async () => {
  const consultar = vi.fn().mockResolvedValue(semVinculo);
  render(<PareamentoTelegramV2 identidade="fundador" repositorio={repositorio({ consultar })} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar código de pareamento' }));
  expect(await screen.findByLabelText('Código de pareamento')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar vínculo' }));
  await waitFor(() => expect(screen.queryByLabelText('Código de pareamento')).toBeNull());
  expect(consultar).toHaveBeenCalledTimes(2);
});

it('na resposta perdida de gerar consulta status sem refazer automaticamente a geração', async () => {
  const consultar = vi.fn().mockResolvedValueOnce(semVinculo)
    .mockResolvedValueOnce({ ...semVinculo, codigo_pendente: true, codigo_expira_em: new Date(Date.now() + 600_000).toISOString() });
  const gerar = vi.fn().mockRejectedValue(new Error('detalhe interno'));
  render(<PareamentoTelegramV2 identidade="fundador" repositorio={repositorio({ consultar, gerar })} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar código de pareamento' }));
  expect(await screen.findByText(/Há um código pendente emitido anteriormente/)).toBeTruthy();
  expect(gerar).toHaveBeenCalledTimes(1);
  expect(consultar).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/detalhe interno/)).toBeNull();
  expect(screen.queryByLabelText('Código de pareamento')).toBeNull();
});

it('revoga somente após confirmação explícita e relê o banco se a resposta se perder', async () => {
  const consultar = vi.fn().mockResolvedValueOnce(vinculado).mockResolvedValueOnce(semVinculo);
  const revogar = vi.fn().mockRejectedValue(new Error('resposta perdida'));
  render(<PareamentoTelegramV2 identidade="fundador" repositorio={repositorio({ consultar, revogar })} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Revogar vínculo' }));
  expect(screen.getByText(/impedirá que este chat seja reconhecido/)).toBeTruthy();
  expect(revogar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar revogação' }));
  expect(await screen.findByText('Nenhum Telegram vinculado nesta conta.')).toBeTruthy();
  expect(revogar).toHaveBeenCalledTimes(1);
  expect(consultar).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Telegram vinculado conforme/)).toBeNull();
});

it('descarta código de resposta atrasada após troca de identidade', async () => {
  let resolver!: (valor: CodigoPareamentoTelegramV2) => void;
  const gerar = vi.fn().mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  const repo = repositorio({ gerar });
  const tela = render(<PareamentoTelegramV2 identidade="conta-a" repositorio={repo} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar código de pareamento' }));
  tela.rerender(<PareamentoTelegramV2 identidade="conta-b" repositorio={repo} />);
  await act(async () => resolver(codigo(new Date(Date.now() + 600_000).toISOString())));
  await waitFor(() => expect(screen.getByText('Nenhum Telegram vinculado nesta conta.')).toBeTruthy());
  expect(screen.queryByLabelText('Código de pareamento')).toBeNull();
});
