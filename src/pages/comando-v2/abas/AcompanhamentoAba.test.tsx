import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import AcompanhamentoAba from './AcompanhamentoAba';
import { AGORA, card, etapa, montarDados, pedido } from '@/integrations/comando-v2/derivar-cards.fixtures';
import type { DadosComando } from '@/integrations/comando-v2/tipos';

const h = (n: number) => new Date(AGORA.getTime() + n * 3600_000).toISOString();

function dadosBase(): DadosComando {
  return montarDados({
    cards: [
      card('a', { titulo: 'Campanha de Natal' }),
      card('b', { titulo: 'Relatório fiscal', estado: 'ESPERANDO_FUNDADOR', motivo: 'DEPENDENCIA' }),
      card('e', { titulo: 'Plano eLiving', empresa: 'BIZ-005' }),
    ],
    etapas: [
      etapa('1', 'a', { estado: 'EXECUTANDO', prazo_ate: h(-2), atualizado_em: h(-0.1) }),
      etapa('2', 'a', { estado: 'REVISAO', autor: 'MAYA', revisores: ['BRUNO'], prazo_ate: h(10), atualizado_em: h(-3) }),
      etapa('3', 'a', { estado: 'EXECUTANDO', prazo_ate: h(20), atualizado_em: h(-0.2) }),
      etapa('4', 'a', { estado: 'NA_FILA' }),
      etapa('5', 'b', { estado: 'ESPERANDO_FUNDADOR', motivo: 'PERGUNTA' }),
      etapa('6', 'e', { estado: 'EXECUTANDO' }),
    ],
    pedidos: [
      pedido('p1', 'RECEBIDO', { texto_inicial: 'Quero um post novo' }),
      pedido('p2', 'PLANO_CONFIRMADO', { texto_inicial: 'Revisar o contrato', empresa_id: 'BIZ-005' }),
      pedido('p3', 'CARD_CRIADO', { card_id: 'a', texto_inicial: 'Já virou card' }),
    ],
  });
}
const montar = (dados = dadosBase(), empresa = 'GRUPO', abrirCard = vi.fn()) => { render(<AcompanhamentoAba dados={dados} empresa={empresa} abrirCard={abrirCard} />); return abrirCard; };

it('Execuções lista só etapas em execução ou revisão, com atrasadas e paradas em destaque', () => {
  montar();
  const painel = screen.getByRole('tabpanel');
  expect(within(painel).getAllByRole('listitem')).toHaveLength(4);
  expect(within(painel).queryByText('E-4 · Etapa 4')).toBeNull();
  const atrasada = within(painel).getByText('E-1 · Etapa 1').closest('li')!;
  expect(within(atrasada).getByText('Atrasada')).toBeTruthy();
  const parada = within(painel).getByText('E-2 · Etapa 2').closest('li')!;
  expect(within(parada).getByText('Parada há 3 h')).toBeTruthy();
  expect(within(parada).getByText(/Autor: MAYA · Revisor: BRUNO/)).toBeTruthy();
  expect(within(parada).getByText('Em revisão')).toBeTruthy();
  const normal = within(painel).getByText('E-3 · Etapa 3').closest('li')!;
  expect(within(normal).queryByText('Atrasada')).toBeNull();
  expect(within(normal).queryByText(/Parada/)).toBeNull();
  // atrasadas primeiro
  expect(within(painel).getAllByRole('listitem')[0].textContent).toContain('E-1 · Etapa 1');
});

it('cada linha tem "Abrir card"', () => {
  const abrir = montar();
  const linha = screen.getByText('E-3 · Etapa 3').closest('li')!;
  fireEvent.click(within(linha).getByRole('button', { name: /Abrir card/ }));
  expect(abrir).toHaveBeenCalledWith('a');
});

it('Decisões reúne cards, etapas e pedidos que ainda não viraram card', () => {
  const abrir = montar();
  fireEvent.click(screen.getByRole('tab', { name: /Decisões/ }));
  const cards = screen.getByRole('region', { name: 'Cards esperando você' });
  expect(within(cards).getByText('Relatório fiscal')).toBeTruthy();
  expect(within(cards).getByText(/Uma etapa da qual esta depende falhou/)).toBeTruthy();
  const etapas = screen.getByRole('region', { name: 'Etapas esperando você' });
  expect(within(etapas).getByText(/Há uma pergunta esperando a sua resposta/)).toBeTruthy();
  const pedidos = screen.getByRole('region', { name: 'Pedidos que ainda não viraram card' });
  expect(within(pedidos).getAllByRole('listitem')).toHaveLength(2);
  expect(within(pedidos).getByText('Quero um post novo')).toBeTruthy();
  expect(within(pedidos).getByText('Recebido')).toBeTruthy();
  expect(within(pedidos).getByText('Plano confirmado')).toBeTruthy();
  expect(within(pedidos).queryByText('Já virou card')).toBeNull();
  expect(within(pedidos).queryByRole('button', { name: /Abrir card/ })).toBeNull();
  fireEvent.click(within(cards).getByRole('button', { name: /Abrir card/ }));
  expect(abrir).toHaveBeenCalledWith('b');
});

it('as contagens das sub-abas vêm dos dados', () => {
  montar();
  expect(screen.getByRole('tab', { name: /Execuções/ }).textContent).toContain('4');
  expect(screen.getByRole('tab', { name: /Decisões/ }).textContent).toContain('4');
});

it('respeita o filtro de empresa', () => {
  montar(dadosBase(), 'BIZ-005');
  expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('E-6 · Etapa 6')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: /Decisões/ }));
  const pedidos = screen.getByRole('region', { name: 'Pedidos que ainda não viraram card' });
  expect(within(pedidos).getAllByRole('listitem')).toHaveLength(1);
  expect(within(pedidos).getByText('Revisar o contrato')).toBeTruthy();
});

it('erro em etapas mostra erro (e "—") em vez de zero, sem derrubar o bloco de pedidos', () => {
  montar(montarDados({ pedidos: [pedido('p1', 'RECEBIDO', { texto_inicial: 'Quero um post novo' })], estado: { ...montarDados().estado, etapas: 'erro' } }));
  expect(screen.getByText('Não foi possível ler esta lista')).toBeTruthy();
  expect(screen.getByRole('tab', { name: /Execuções/ }).textContent).toContain('—');
  expect(screen.queryByText('Nada em execução agora')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /Decisões/ }));
  expect(screen.getByText('Quero um post novo')).toBeTruthy();
  expect(screen.getByRole('tab', { name: /Decisões/ }).textContent).toContain('—');
});

it('vazio verdadeiro, carregando e amostra', () => {
  const { unmount } = render(<AcompanhamentoAba dados={montarDados({ amostra: true })} empresa="GRUPO" abrirCard={vi.fn()} />);
  expect(screen.getByText('Nada em execução agora')).toBeTruthy();
  expect(screen.getByText(/só uma amostra/)).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: /Decisões/ }));
  expect(screen.getByText('Nenhum card esperando uma decisão sua.')).toBeTruthy();
  expect(screen.getByText(/Nenhum pedido esperando virar card/)).toBeTruthy();
  unmount();
  render(<AcompanhamentoAba dados={montarDados({ estado: { ...montarDados().estado, etapas: 'carregando' } })} empresa="GRUPO" abrirCard={vi.fn()} />);
  expect(screen.getByRole('status', { name: 'Carregando execuções' })).toBeTruthy();
});
