import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { CardV2, LeituraCardFundadorV2 as RegistroLeitura, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import { LeituraCardFundadorV2 } from './LeituraCardFundadorV2';

const card = (motivo: string): CardV2 => ({ id: 'card-local', titulo: 'Pedido registrado', empresa: null,
  estado: 'ESPERANDO_CONFIRMACAO', dono: 'FUNDADOR', prazo: '2026-10-20T12:00:00Z',
  criado_em: '2026-10-13T12:00:00Z', motivo, versao: 4 });
const leitura: RegistroLeitura = { card_id: 'card-local', versao: 4, motivo_atual: 'NENHUM',
  chave: 2, historico_id: 9, momento: '2026-10-13T12:00:00Z', escolha: { tipo: 'SERVICO', id: 'SRV-COPY' },
  leitura_de_volta: { o_que_quer: 'Objetivo que Helena registrou', como_e_o_pronto: ['Pronto interpretado'], nao_pode: ['Restrição interpretada'] } };
const repo = (valor: RegistroLeitura | null) => ({ lerLeituraCardFundador: vi.fn().mockResolvedValue(valor),
  consultarToqueFundador: vi.fn().mockResolvedValue(null) }) as unknown as RepositorioCardsV2;
const montar = (motivo: string, repositorio: RepositorioCardsV2, pedidoOriginalDisponivel = true) => render(<LeituraCardFundadorV2 card={card(motivo)}
  identidade="fundador-local" pedidoOriginalDisponivel={pedidoOriginalDisponivel} repositorio={repositorio} onAtualizar={vi.fn()} />);
const opcoes = () => Array.from((screen.getByLabelText('Decisão do fundador') as HTMLSelectElement).options, opcao => opcao.textContent);

it('só libera CONFIRMO após mostrar a interpretação durável de Helena, distinta do pedido original', async () => {
  const repositorio = repo(leitura);
  montar('NENHUM', repositorio);
  expect(opcoes()).not.toContain('Confirmo o pedido');
  expect(await screen.findByText('Objetivo que Helena registrou')).toBeTruthy();
  expect(screen.getByText('Pronto interpretado')).toBeTruthy();
  expect(screen.getByText('Restrição interpretada')).toBeTruthy();
  expect(screen.getByText(/Escolha informada pela Helena: serviço SRV-COPY/)).toBeTruthy();
  await waitFor(() => expect(opcoes()).toContain('Confirmo o pedido'));
  expect(repositorio.lerLeituraCardFundador).toHaveBeenCalledWith('card-local');
});

it('recusa confirmação se a leitura não for comprovada para a versão atual', async () => {
  montar('NENHUM', repo({ ...leitura, versao: 3 }));
  expect(await screen.findByText(/não foi comprovada para a versão atual/)).toBeTruthy();
  expect(opcoes()).not.toContain('Confirmo o pedido');
  expect(opcoes()).toContain('Cancelar card');
});

it('recusa interpretação incompleta sem critério de pronto', async () => {
  montar('NENHUM', repo({ ...leitura, leitura_de_volta: { o_que_quer: 'Objetivo real', como_e_o_pronto: [], nao_pode: [] } }));
  expect(await screen.findByText(/não foi comprovada para a versão atual/)).toBeTruthy();
  expect(opcoes()).not.toContain('Confirmo o pedido');
});

it('recusa identificador numérico que perderia precisão no navegador', async () => {
  montar('NENHUM', repo({ ...leitura, historico_id: Number.MAX_SAFE_INTEGER + 1 }));
  expect(await screen.findByText(/não foi comprovada para a versão atual/)).toBeTruthy();
  expect(opcoes()).not.toContain('Confirmo o pedido');
});

it('explica ausência de leitura após falha de Helena e permite conferência manual do pedido registrado', () => {
  const repositorio = repo(null);
  montar('HELENA_FALHOU', repositorio);
  expect(screen.getByText(/Helena não concluiu a leitura de volta/)).toBeTruthy();
  expect(opcoes()).toContain('Confirmo o pedido');
  expect(repositorio.lerLeituraCardFundador).not.toHaveBeenCalled();
});

it('não oferece CONFIRMO sem o pedido original para conferência manual', () => {
  montar('HELENA_FALHOU', repo(null), false);
  expect(screen.getByText(/pedido original não está disponível/)).toBeTruthy();
  expect(opcoes()).not.toContain('Confirmo o pedido');
});

it('rotula leitura original ao repetir confirmação depois de falha de validação', async () => {
  montar('VALIDADOR_FALHOU', repo({ ...leitura, motivo_atual: 'VALIDADOR_FALHOU' }));
  expect(await screen.findByText('Objetivo que Helena registrou')).toBeTruthy();
  expect(screen.getByText(/interpretação original da Helena/)).toBeTruthy();
  expect(opcoes()).toContain('Confirmo o pedido');
});
