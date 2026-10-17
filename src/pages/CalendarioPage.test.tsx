import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ agenda: vi.fn() }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  currentBusinessId: 'GRUPO', isConsolidated: true, selecionadas: ['BIZ-001', 'BIZ-004'], todasLigadas: true,
  nomeDe: (id: string) => (id === 'BIZ-001' ? 'iGreen' : 'eLiving'), loading: false, error: null,
}) }));
vi.mock('@/lib/agenda-unificada', async () => {
  const real = await vi.importActual<typeof import('@/lib/agenda-unificada')>('@/lib/agenda-unificada');
  return { ...real, carregarAgenda: mocks.agenda };
});
vi.mock('@/components/tarefas/TarefaAgendaModal', () => ({ TarefaAgendaModal: () => null }));
vi.mock('@/lib/tarefa-acoes', () => ({ concluirTarefa: vi.fn(), concluirTarefaPorId: vi.fn() }));

import CalendarioPage from './CalendarioPage';

const hoje = new Date();
const iso = (dias: number, hora = '09:00') => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${hora}:00`;
};

beforeEach(() => {
  mocks.agenda.mockResolvedValue({
    erro: '',
    semData: [],
    eventos: [
      { event_id: 'EVT-1', business_id: 'BIZ-001', titulo: 'Reunião semanal', tipo: 'REUNIAO', inicio: iso(0), origem: 'calendario', status: 'AGENDADO' },
      { event_id: 'EVT-TSK-T1', business_id: 'BIZ-004', titulo: 'Relatório mensal', tipo: 'TAREFA', inicio: iso(0, '10:00'), origem: 'tarefa', status: 'ABERTA', related_object_type: 'tarefas', related_object_id: 'T1' },
      { event_id: 'EVT-TSK-T2', business_id: 'BIZ-004', titulo: 'Tarefa antiga', tipo: 'TAREFA', inicio: iso(-3), origem: 'tarefa', status: 'CONCLUIDA', related_object_type: 'tarefas', related_object_id: 'T2' },
    ],
  });
});

it('mostra origem, resumo e o atalho para o cadastro do calendário', async () => {
  render(<MemoryRouter><CalendarioPage /></MemoryRouter>);
  const selo = await screen.findByRole('note', { name: 'Origem dos dados' });
  expect(selo).toHaveTextContent('calendario, tarefas');
  expect(selo).toHaveTextContent('3 itens');
  expect(screen.getByText(/Hoje: 2/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Cadastro/ })).toHaveAttribute('href', '/modulo/calendario');
});

it('filtra por tipo e oculta concluídos na agenda, com estado vazio que limpa os filtros', async () => {
  render(<MemoryRouter><CalendarioPage /></MemoryRouter>);
  await screen.findByRole('note', { name: 'Origem dos dados' });
  fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
  expect(screen.getByText('Tarefa antiga')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Ocultar concluídos'));
  expect(screen.queryByText('Tarefa antiga')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tipo de item'), { target: { value: 'calendario' } });
  expect(screen.getByText('Reunião semanal')).toBeInTheDocument();
  expect(screen.queryByText('Relatório mensal')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'BIZ-004' } });
  expect(screen.getByText('Nenhum evento com data neste recorte')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
  expect(screen.getByText('Reunião semanal')).toBeInTheDocument();
});

it('período "a partir de hoje" esconde itens passados da agenda', async () => {
  render(<MemoryRouter><CalendarioPage /></MemoryRouter>);
  await screen.findByRole('note', { name: 'Origem dos dados' });
  fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
  fireEvent.change(screen.getByLabelText('Período da agenda'), { target: { value: 'futuros' } });
  expect(screen.queryByText('Tarefa antiga')).not.toBeInTheDocument();
  expect(screen.getByText('Reunião semanal')).toBeInTheDocument();
});
