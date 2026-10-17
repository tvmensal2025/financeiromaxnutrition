import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ProcessoAba from './ProcessoAba';
import { AGORA, card, etapa, montarDados } from '@/integrations/comando-v2/derivar-cards.fixtures';
import type { DadosComando } from '@/integrations/comando-v2/tipos';

const h = (n: number) => new Date(AGORA.getTime() + n * 3600_000).toISOString();

function dadosBase(): DadosComando {
  return montarDados({
    cards: [card('a', { titulo: 'Campanha de Natal' }), card('e', { titulo: 'Plano eLiving', empresa: 'BIZ-005' })],
    etapas: [
      etapa('1', 'a', { estado: 'EXECUTANDO', prazo_ate: h(-2) }),
      etapa('2', 'a', { estado: 'NA_FILA' }),
      etapa('3', 'a', { estado: 'PRONTA' }),
      etapa('4', 'e', { estado: 'ESPERANDO_FUNDADOR', autor: 'MAYA', revisores: ['BRUNO'] }),
    ],
  });
}
const coluna = (nome: RegExp) => screen.getByRole('region', { name: nome });
const montar = (dados = dadosBase(), empresa = 'GRUPO', abrirCard = vi.fn()) => { render(<ProcessoAba dados={dados} empresa={empresa} abrirCard={abrirCard} />); return abrirCard; };

it('mostra as oito colunas com contagem e as etapas em cada uma', () => {
  montar();
  for (const nome of ['Aguardando etapas anteriores', 'Na fila', 'Em execução', 'Em validação', 'Em revisão', 'Esperando você', 'Aprovada', 'Pronta']) {
    expect(coluna(new RegExp(`^${nome}: `))).toBeTruthy();
  }
  expect(coluna(/^Em execução: 1 etapa$/)).toBeTruthy();
  expect(coluna(/^Na fila: 1 etapa$/)).toBeTruthy();
  expect(coluna(/^Em validação: 0 etapas$/)).toBeTruthy();
  const execucao = coluna(/^Em execução/);
  expect(within(execucao).getByText('E-1 · Etapa 1')).toBeTruthy();
  expect(within(execucao).getByText(/Autor: CAIO · Revisor: CLARA/)).toBeTruthy();
  expect(within(execucao).getByText('Atrasada')).toBeTruthy();
  expect(within(execucao).getByText('venceu há 2 h')).toBeTruthy();
  expect(within(coluna(/^Esperando você/)).getByText(/Plano eLiving · eLiving/)).toBeTruthy();
});

it('explica o ciclo da v2 com texto fixo', () => {
  montar();
  const ciclo = screen.getByRole('region', { name: 'Como funciona o ciclo' });
  for (const passo of ['Pedido', 'Leitura de volta', 'Sua confirmação', 'Validação do plano', 'Etapas', 'Card pronto']) {
    expect(within(ciclo).getByText(passo)).toBeTruthy();
  }
});

it('abre o card da etapa', () => {
  const abrir = montar();
  fireEvent.click(screen.getByRole('button', { name: /Abrir o card da etapa E-2/ }));
  expect(abrir).toHaveBeenCalledWith('a');
});

it('respeita o filtro de empresa', () => {
  montar(dadosBase(), 'BIZ-005');
  expect(coluna(/^Esperando você: 1 etapa$/)).toBeTruthy();
  expect(coluna(/^Em execução: 0 etapas$/)).toBeTruthy();
});

it('limita cada coluna e deixa ver mais', () => {
  const etapas = Array.from({ length: 8 }, (_, i) => etapa(`f${i}`, 'a', { estado: 'NA_FILA' }));
  montar(montarDados({ cards: [card('a')], etapas }));
  const fila = coluna(/^Na fila: 8 etapas$/);
  expect(within(fila).getAllByRole('button', { name: /Abrir o card da etapa/ })).toHaveLength(5);
  fireEvent.click(within(fila).getByRole('button', { name: 'Ver mais 3' }));
  expect(within(fila).getAllByRole('button', { name: /Abrir o card da etapa/ })).toHaveLength(8);
});

it('erro em etapas ou cards mostra erro, nunca colunas zeradas', () => {
  montar(montarDados({ estado: { ...montarDados().estado, etapas: 'erro' } }));
  expect(screen.getByText('Não foi possível carregar o processo')).toBeTruthy();
  expect(screen.getByText(/Não foi possível ler as etapas/)).toBeTruthy();
  expect(screen.queryByRole('region', { name: /^Na fila/ })).toBeNull();
});

it('carregando e vazio verdadeiro são mensagens diferentes', () => {
  const { unmount } = render(<ProcessoAba dados={montarDados({ estado: { ...montarDados().estado, cards: 'carregando' } })} empresa="GRUPO" abrirCard={vi.fn()} />);
  expect(screen.getByRole('status', { name: 'Carregando o processo' })).toBeTruthy();
  unmount();
  montar(montarDados({ amostra: true }));
  expect(screen.getByText('Nenhuma etapa por enquanto')).toBeTruthy();
  expect(screen.getByText(/só uma amostra/)).toBeTruthy();
});
