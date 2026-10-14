import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ErroBancoCardsV2, type RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import { AcoesFundadorV2 } from './AcoesFundadorV2';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); });
const alvo = { maquina: 'card' as const, id: 'card-local', versao: 3, estado: 'ESPERANDO_CONFIRMACAO', motivo: 'NENHUM' };

it('confirma decisão explicitamente, envia versão e toque e relê o banco', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const aplicar = vi.fn().mockResolvedValue({ resultado: 'APLICADO' });
  const reler = vi.fn().mockResolvedValue(undefined);
  render(<AcoesFundadorV2 alvo={alvo} identidade="fundador-local" cardId="card-local" repositorio={{ aplicarEventoFundador: aplicar } as unknown as RepositorioCardsV2} onAtualizar={reler} />);
  fireEvent.change(screen.getByLabelText('Decisão do fundador'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar decisão' }));
  expect(aplicar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisão' }));
  await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(1));
  expect(aplicar.mock.calls[0][0]).toMatchObject({ maquina: 'card', alvo: 'card-local', evento: 'RESPONDER',
    parametros: { opcao: 'CONFIRMO' }, versaoVista: 3 });
  expect(aplicar.mock.calls[0][0].toque).toMatch(/^[0-9a-f-]{36}$/);
  expect(reler).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Ação registrada. Estado relido do banco.')).toBeTruthy();
});

it('mantém mesmo toque em falha ambígua e não anuncia aprovação em recusa SQL', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const aplicar = vi.fn().mockRejectedValueOnce(new Error('Conexão caiu')).mockRejectedValueOnce(new ErroBancoCardsV2('FONTES_MUDARAM', '40001'));
  const reler = vi.fn().mockResolvedValue(undefined);
  render(<AcoesFundadorV2 alvo={alvo} identidade="fundador-local" cardId="card-local" repositorio={{ aplicarEventoFundador: aplicar } as unknown as RepositorioCardsV2} onAtualizar={reler} />);
  fireEvent.change(screen.getByLabelText('Decisão do fundador'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar decisão' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisão' }));
  expect(await screen.findByText(/Não foi possível confirmar o resultado/)).toBeTruthy();
  expect(screen.getByLabelText('Decisão do fundador')).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente o mesmo toque' }));
  await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(2));
  expect(aplicar.mock.calls[1][0]).toEqual(aplicar.mock.calls[0][0]);
  expect(await screen.findByText(/O banco recusou a ação/)).toBeTruthy();
  expect(screen.queryByText(/Ação registrada/)).toBeNull();
  expect(reler).toHaveBeenCalledTimes(1);
});

it('duas aprovações humanas distintas em card pronto usam toques diferentes na mesma versão', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const aplicar = vi.fn().mockResolvedValue({ resultado: 'REACAO' });
  const repositorio = { aplicarEventoFundador: aplicar } as unknown as RepositorioCardsV2;
  render(<AcoesFundadorV2 alvo={{ ...alvo, estado: 'PRONTO' }} identidade="fundador-local" cardId="card-local" repositorio={repositorio} onAtualizar={vi.fn().mockResolvedValue(undefined)} />);
  for (let i = 0; i < 2; i++) {
    const select = screen.getByLabelText('Decisão do fundador');
    const opcao = Array.from((select as HTMLSelectElement).options).find(item => item.textContent === 'Registrar minha aprovação');
    fireEvent.change(select, { target: { value: opcao?.value } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar decisão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisão' }));
    await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(i + 1));
    await screen.findByText('Reação registrada no histórico. Estado relido do banco.');
  }
  expect(aplicar.mock.calls[0][0].versaoVista).toBe(3);
  expect(aplicar.mock.calls[1][0].versaoVista).toBe(3);
  expect(aplicar.mock.calls[0][0].toque).not.toBe(aplicar.mock.calls[1][0].toque);
});

it('dois cliques rápidos na confirmação geram apenas um evento', async () => {
  vi.stubGlobal('crypto', webcrypto);
  let concluir!: (valor: { resultado: string }) => void;
  const aplicar = vi.fn().mockImplementation(() => new Promise<{ resultado: string }>(resolve => { concluir = resolve; }));
  render(<AcoesFundadorV2 alvo={alvo} identidade="fundador-local" cardId="card-local" repositorio={{ aplicarEventoFundador: aplicar } as unknown as RepositorioCardsV2}
    onAtualizar={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.change(screen.getByLabelText('Decisão do fundador'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar decisão' }));
  const confirmar = screen.getByRole('button', { name: 'Confirmar decisão' });
  fireEvent.click(confirmar);
  fireEvent.click(confirmar);
  await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(1));
  concluir({ resultado: 'APLICADO' });
  expect(await screen.findByText('Ação registrada. Estado relido do banco.')).toBeTruthy();
});

it('após recarga reconcilia toque pendente e só permite retomar escolha idêntica', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const aplicar = vi.fn().mockRejectedValueOnce(new Error('Conexão caiu')).mockResolvedValueOnce({ resultado: 'APLICADO' });
  const consultar = vi.fn().mockResolvedValue(null);
  const repo = { aplicarEventoFundador: aplicar, consultarToqueFundador: consultar } as unknown as RepositorioCardsV2;
  const reler = vi.fn().mockResolvedValue(undefined);
  const primeira = render(<AcoesFundadorV2 alvo={alvo} identidade="fundador-local" cardId="card-local" repositorio={repo} onAtualizar={reler} />);
  fireEvent.change(screen.getByLabelText('Decisão do fundador'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar decisão' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisão' }));
  expect(await screen.findByText(/Não foi possível confirmar o resultado/)).toBeTruthy();
  const toqueOriginal = aplicar.mock.calls[0][0].toque;
  primeira.unmount();
  render(<AcoesFundadorV2 alvo={alvo} identidade="fundador-local" cardId="card-local" repositorio={repo} onAtualizar={reler} />);
  expect(await screen.findByText(/Reescolha exatamente a mesma decisão/)).toBeTruthy();
  expect(consultar).toHaveBeenCalledWith('card-local', toqueOriginal);
  fireEvent.change(screen.getByLabelText('Decisão do fundador'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar retomada do mesmo toque' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisão' }));
  expect(await screen.findByText(/Esta escolha difere da decisão pendente/)).toBeTruthy();
  expect(aplicar).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Decisão do fundador'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar retomada do mesmo toque' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisão' }));
  await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(2));
  expect(aplicar.mock.calls[1][0].toque).toBe(toqueOriginal);
});

it('após recarga mostra resultado e momento do histórico sem reenviar ação já gravada', async () => {
  const toque = '12345678-1234-1234-1234-123456789abc';
  sessionStorage.setItem('helena-v2-toque:fundador-local:card:card-local', JSON.stringify({
    cardId: 'card-local', toque, impressao: 'a'.repeat(64),
  }));
  const aplicar = vi.fn();
  const consulta = vi.fn().mockResolvedValue({ historico_id: 4, resultado: 'REACAO', momento: '2026-10-13T12:00:00Z',
    maquina: 'card', alvo_id: 'card-local', evento: 'APROVAR' });
  render(<AcoesFundadorV2 alvo={alvo} identidade="fundador-local" cardId="card-local" repositorio={{
    aplicarEventoFundador: aplicar, consultarToqueFundador: consulta,
  } as unknown as RepositorioCardsV2} onAtualizar={vi.fn().mockResolvedValue(undefined)} />);
  expect(await screen.findByText(/Toque anterior REACAO registrado em 2026-10-13T12:00:00Z/)).toBeTruthy();
  expect(sessionStorage.getItem('helena-v2-toque:fundador-local:card:card-local')).toBeNull();
  expect(aplicar).not.toHaveBeenCalled();
});

it('bloqueia envio quando o navegador não consegue guardar o identificador para retry', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Armazenamento indisponível'); });
  const aplicar = vi.fn();
  render(<AcoesFundadorV2 alvo={alvo} identidade="fundador-local" cardId="card-local"
    repositorio={{ aplicarEventoFundador: aplicar } as unknown as RepositorioCardsV2} onAtualizar={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Decisão do fundador'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar decisão' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisão' }));
  expect(await screen.findByText('Armazenamento indisponível')).toBeTruthy();
  expect(aplicar).not.toHaveBeenCalled();
});
