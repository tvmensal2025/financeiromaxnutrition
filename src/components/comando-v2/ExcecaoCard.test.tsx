import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ExcecaoCard from './ExcecaoCard';
import type { Excecao } from '@/integrations/comando-v2/supervisao-v2';

const AGORA = new Date('2026-10-17T15:00:00Z');
const base: Excecao = {
  id: 'PRAZO_VENCIDO:c1', regra: 'PRAZO_VENCIDO', severidade: 'ALTA', titulo: 'Contrato', detalhe: 'O prazo deste card venceu.',
  cardId: 'c1', empresa: 'BIZ-003', desde: '2026-10-17T12:00:00Z',
};

it('mostra severidade, regra, texto, empresa e tempo, e abre o card pelo botão de 44 px', () => {
  const abrir = vi.fn();
  render(<ul><ExcecaoCard excecao={base} agora={AGORA} nomeEmpresa="Humano Digital" abrirCard={abrir} /></ul>);
  expect(screen.getByText('Severidade alta')).toBeTruthy();
  expect(screen.getByText('Prazo vencido')).toBeTruthy();
  expect(screen.getByText('Humano Digital')).toBeTruthy();
  expect(screen.getByText('há 3 h')).toBeTruthy();
  const botao = screen.getByRole('button', { name: 'Abrir card: Contrato' });
  expect(botao.className).toContain('min-h-11');
  fireEvent.click(botao);
  expect(abrir).toHaveBeenCalledWith('c1');
});

it('sem card (pedido) não oferece botão e sem empresa diz isso', () => {
  render(<ul><ExcecaoCard excecao={{ ...base, cardId: undefined, regra: 'PEDIDO_SEM_CARD', severidade: 'MEDIA', empresa: undefined }} agora={AGORA} abrirCard={vi.fn()} /></ul>);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('Ainda não há card para abrir.')).toBeTruthy();
  expect(screen.getByText('Empresa não definida')).toBeTruthy();
  expect(screen.getByText('Severidade média')).toBeTruthy();
});
