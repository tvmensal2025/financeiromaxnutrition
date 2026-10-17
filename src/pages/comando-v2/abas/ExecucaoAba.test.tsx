import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import ExecucaoAba from './ExecucaoAba';
import { card, dadosDeTeste } from '@/integrations/comando-v2/dados-de-teste-execucao';
import type { DadosComando } from '@/integrations/comando-v2/tipos';

function montar(dados: DadosComando, empresa = 'GRUPO') {
  const abrirCard = vi.fn();
  render(<MemoryRouter><ExecucaoAba dados={dados} empresa={empresa} abrirCard={abrirCard} /></MemoryRouter>);
  return { abrirCard };
}
const bloco = (nome: string) => screen.getByRole('region', { name: nome });
const contagem = (nome: string) => within(bloco(nome)).queryByLabelText(/^\d+ (item|itens)$/)?.textContent ?? null;

it('mostra cada bloco da central com a contagem e os itens', () => {
  montar(dadosDeTeste());
  expect(screen.getByRole('heading', { name: 'Central de execução' })).toBeTruthy();
  expect(contagem('Esperando você')).toBe('2');
  expect(contagem('Em trabalho')).toBe('2');
  expect(contagem('Em revisão')).toBe('1');
  expect(contagem('Pedidos em preparo')).toBe('2');
  expect(contagem('Falhas e travas')).toBe('3');
  expect(contagem('Atrasados')).toBe('1');
  const espera = within(bloco('Esperando você'));
  expect(espera.getByText('Campanha de outubro')).toBeTruthy();
  expect(espera.getByText('Aguarda sua decisão')).toBeTruthy();
  expect(within(bloco('Em revisão')).getByText('Revisor: Rafael')).toBeTruthy();
  expect(within(bloco('Em trabalho')).getAllByText('Humano Digital').length).toBeGreaterThan(0);
  expect(within(bloco('Atrasados')).getByText('Atrasado há 7 dias')).toBeTruthy();
  expect(within(bloco('Pedidos em preparo')).getByText('Recebido para triagem; ainda não virou card.')).toBeTruthy();
});

it('abre o card pelo título do item e não cria botão para pedido ainda sem card', () => {
  const { abrirCard } = montar(dadosDeTeste());
  fireEvent.click(within(bloco('Esperando você')).getByRole('button', { name: 'Abrir card: Campanha de outubro' }));
  expect(abrirCard).toHaveBeenCalledWith('c1');
  expect(within(bloco('Pedidos em preparo')).queryAllByRole('button', { name: /Abrir card/ })).toHaveLength(0);
});

it('limita a 5 itens e libera "ver todos"', () => {
  const dados = dadosDeTeste();
  for (let i = 0; i < 6; i++) dados.cards.push(card(`x${i}`, { titulo: `Extra ${i}`, estado: 'ESPERANDO_FUNDADOR' }));
  montar(dados);
  const espera = within(bloco('Esperando você'));
  expect(contagem('Esperando você')).toBe('8');
  expect(espera.getAllByRole('listitem')).toHaveLength(5);
  const ver = espera.getByRole('button', { name: /Ver todos \(8\)/ });
  expect(ver.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(ver);
  expect(espera.getAllByRole('listitem')).toHaveLength(8);
  fireEvent.click(espera.getByRole('button', { name: /Ver menos/ }));
  expect(espera.getAllByRole('listitem')).toHaveLength(5);
});

it('filtra por agente e avisa que pedidos não têm agente', () => {
  montar(dadosDeTeste());
  fireEvent.change(screen.getByLabelText('Filtrar por agente'), { target: { value: 'REVISOR' } });
  expect(contagem('Em revisão')).toBe('1');
  expect(contagem('Em trabalho')).toBe('0');
  expect(within(bloco('Em trabalho')).getByText('Nenhuma etapa em execução neste momento.')).toBeTruthy();
  expect(contagem('Pedidos em preparo')).toBe('2');
  expect(within(bloco('Pedidos em preparo')).getByText(/filtro de agente não muda este bloco/)).toBeTruthy();
});

it('respeita o filtro de empresa', () => {
  montar(dadosDeTeste(), 'BIZ-003');
  expect(contagem('Esperando você')).toBe('1');
  expect(contagem('Pedidos em preparo')).toBe('1');
  expect(within(bloco('Pedidos em preparo')).getByText(/1 pedido ainda sem empresa fica fora do filtro de empresa/)).toBeTruthy();
  expect(screen.getByText(/cards de Humano Digital/)).toBeTruthy();
});

it('mostra erro, e nunca zero, quando a leitura falhou; e carregando quando ainda lê', () => {
  const dados = dadosDeTeste();
  dados.estado = { ...dados.estado, cards: 'erro', pedidos: 'carregando' };
  montar(dados);
  expect(screen.getByText('Não foi possível ler: Esperando você')).toBeTruthy();
  expect(contagem('Esperando você')).toBeNull();
  expect(screen.getByText('Não foi possível ler: Em trabalho')).toBeTruthy();
  expect(screen.queryByText('Nenhuma etapa em execução neste momento.')).toBeNull();
  expect(within(bloco('Pedidos em preparo')).getByRole('status', { name: /Carregando pedidos em preparo/ })).toBeTruthy();
  const resumo = screen.getByLabelText('Resumo da execução');
  expect(within(resumo).getAllByText('—').length).toBeGreaterThanOrEqual(4);
});

it('diz a verdade quando está vazio de verdade', () => {
  const dados = dadosDeTeste();
  dados.cards = []; dados.etapas = []; dados.pedidos = [];
  montar(dados);
  expect(contagem('Esperando você')).toBe('0');
  expect(screen.getByText('Nada esperando por você agora.')).toBeTruthy();
  expect(screen.getByText('Nenhum pedido em preparo.')).toBeTruthy();
});

it('avisa quando é amostra', () => {
  const dados = dadosDeTeste();
  dados.amostra = true;
  montar(dados);
  expect(screen.getByText(/Amostra: a leitura foi cortada por limite/)).toBeTruthy();
});

it('explica ações externas e publicação sem inventar número e leva aos cards', () => {
  montar(dadosDeTeste());
  const externas = within(bloco('Ações externas e publicação'));
  expect(externas.getByText(/são vistos dentro de cada card/)).toBeTruthy();
  expect(externas.queryByLabelText(/itens?$/)).toBeNull();
  expect(externas.getByRole('link', { name: /Ver cards/ }).getAttribute('href')).toBe('/cards');
});
