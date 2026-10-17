import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import EntregasAba from './EntregasAba';
import { dadosDeTeste } from '@/integrations/comando-v2/dados-de-teste-execucao';

const detalhar = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/cards-v2/runtime', () => ({ repositorioCardsV2DoApp: async () => ({ detalhar }) }));

it('mostra a galeria de entregas aprovadas e deixa claro que aprovada não é publicada', () => {
  render(<EntregasAba dados={dadosDeTeste()} empresa="GRUPO" abrirCard={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Entregas aprovadas' })).toBeTruthy();
  expect(screen.getByText(/Aprovada no portão 1 não quer dizer publicada/)).toBeTruthy();
  expect(screen.getByText('4 entregas aprovadas')).toBeTruthy();
});

it('mostra o nome da empresa filtrada', () => {
  render(<EntregasAba dados={dadosDeTeste()} empresa="BIZ-001" abrirCard={vi.fn()} />);
  expect(screen.getByText(/de Max Nutrition/)).toBeTruthy();
  expect(screen.getByText('1 entrega aprovada')).toBeTruthy();
});

it('sem função injetada, carrega o texto pelo repositório de cards da v2 (import dinâmico)', async () => {
  detalhar.mockResolvedValue({ etapas: [], entregas: [{ id: 3, etapa_id: 'e1', versao: 1, portao1: 'PASSOU', conteudo: { resumo: 'Texto do banco' }, criada_em: '2026-10-06T15:00:00Z' }] });
  render(<EntregasAba dados={dadosDeTeste()} empresa="BIZ-001" abrirCard={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Site da Max/ }));
  expect(await screen.findByText('Texto do banco')).toBeTruthy();
  expect(detalhar).toHaveBeenCalledWith('c5');
});
