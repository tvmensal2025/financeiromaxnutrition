import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
const state = vi.hoisted(() => ({ business: 'BIZ-003', jobs: [] as any[] }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({ currentBusinessId: state.business, empresas: [{ business_id: 'BIZ-003', nome: 'Humano Digital' }] }) }));
vi.mock('@/components/DeliveryGallery', () => ({ DeliveryGallery: () => null }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => {
  let business = '';
  const query: any = { select: () => query, order: () => query, range: () => query, in: () => query, eq: (_: string, value: string) => { business = value; return query; }, then: (resolve: (value: unknown) => void) => Promise.resolve({ data: table === 'agent_jobs' ? state.jobs.filter(job => !business || job.business_id === business) : [], error: null }).then(resolve) };
  return query;
} } }));
import EntregasPage from './EntregasPage';
beforeEach(() => {
  state.business = 'BIZ-003';
  state.jobs = ['Primeira etapa', 'Segunda etapa'].map((title, index) => ({ job_id: `job-${index}`, business_id: 'BIZ-003', objective: title, status: index ? 'BLOCKED' : 'COMPLETED', approval_required: true, approval_status: 'APPROVED', result_payload: { reviewed_by: 'AGT-01', review_pending: false }, evidence_refs: [], created_at: '2026-10-03T12:00:00Z' }));
});
afterEach(cleanup);

describe('delivery recipient navigation', () => {
  it('does not call an approved internal stage a final delivery', async () => {
    render(<MemoryRouter><EntregasPage /></MemoryRouter>);
    expect(await screen.findByText(/2 registros de produção consultados/)).toBeInTheDocument();
    expect(screen.queryByText('Primeira etapa')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Acompanhar produção' }));
    expect(screen.getByText('Etapa aprovada')).toBeInTheDocument();
  });
  it('opens the newly selected delivery instead of restoring the previous URL job', async () => {
    render(<MemoryRouter><EntregasPage /></MemoryRouter>);
    await screen.findByText(/2 registros de produção consultados/);
    fireEvent.click(screen.getByRole('button', { name: 'Acompanhar produção' }));
    fireEvent.click(screen.getByText('Primeira etapa'));
    expect(within(screen.getByRole('dialog')).getByText('Primeira etapa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Segunda etapa'));
    expect(within(screen.getByRole('dialog')).getByText('Segunda etapa')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByText('Primeira etapa')).not.toBeInTheDocument();
  });
  it('copies only the prepared caption and shows a useful fallback on clipboard failure', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    state.jobs[0].result_payload = { publication: { title: 'Campanha', caption: 'Texto preparado para o público.', strategy: 'Estratégia', instructions: 'Uso interno', alt_text: 'Pessoa trabalhando' } };
    render(<MemoryRouter><EntregasPage /></MemoryRouter>);
    await screen.findByText(/2 registros de produção consultados/);
    fireEvent.click(screen.getByRole('button', { name: 'Acompanhar produção' }));
    fireEvent.click(screen.getByText('Campanha'));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar texto' }));
    await screen.findByRole('button', { name: 'Copiado' });
    expect(writeText).toHaveBeenCalledWith('Texto preparado para o público.');
    fireEvent.click(screen.getByRole('button', { name: 'Copiado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecione o texto abaixo e copie');
  });
  it('resets hidden filters when returning to final materials or changing company', async () => {
    const view = render(<MemoryRouter><EntregasPage /></MemoryRouter>);
    await screen.findByText(/2 registros de produção consultados/);
    fireEvent.click(screen.getByRole('button', { name: 'Acompanhar produção' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloqueadas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Material pronto para usar' }));
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    state.business = 'BIZ-002'; view.rerender(<MemoryRouter><EntregasPage /></MemoryRouter>);
    await screen.findByText(/0 registros de produção consultados/);
    fireEvent.click(screen.getByRole('button', { name: 'Acompanhar produção' }));
    expect(screen.queryByText('Primeira etapa')).not.toBeInTheDocument();
  });
});
