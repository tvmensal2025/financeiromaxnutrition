import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

const mockJobs = [
  {
    job_id: 'JOB-001',
    task_id: 'TSK-001',
    business_id: 'BIZ-002',
    agent_id: 'AGT-17',
    correlation_id: null,
    objective: 'Copy de vendas Max Nutrition',
    status: 'COMPLETED',
    approval_required: false,
    approval_status: 'APPROVED',
    result_summary: 'Material completo de lançamento com 3 posts e copy aprovada.',
    result_payload: {
      caption: 'Descubra a nova linha Max Nutrition com alta pureza e desempenho.',
      strategy: 'Ativação de público fitness e saúde.',
      instructions: 'Publicar no Instagram às 18h.',
      delivery_audience: 'FOUNDER',
      delivery_stage: 'FINAL',
      reviewed_by: 'AGT-01',
      review_pending: false,
    },
    evidence_refs: ['MEM-HR-0123456789abcdef0123456789abcdef'],
    created_at: '2026-10-04T12:00:00Z',
    updated_at: '2026-10-04T14:00:00Z',
  },
  {
    job_id: 'JOB-002',
    task_id: 'TSK-002',
    business_id: 'BIZ-003',
    agent_id: 'AGT-12',
    correlation_id: null,
    objective: 'Design visual das artes de feed',
    status: 'IN_PROGRESS',
    approval_required: true,
    approval_status: 'PENDING',
    result_summary: 'Artes em rendering no modelo de IA.',
    result_payload: null,
    evidence_refs: [],
    created_at: '2026-10-04T13:00:00Z',
    updated_at: '2026-10-04T14:10:00Z',
  },
];

vi.mock('@/contexts/BusinessContext', () => ({
  useBusiness: () => ({
    currentBusinessId: 'BIZ-002',
    empresas: [
      { business_id: 'BIZ-001', nome: 'iGreen Energy' },
      { business_id: 'BIZ-002', nome: 'Max Nutrition Saúde' },
      { business_id: 'BIZ-003', nome: 'Humano Digital' },
    ],
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'agent_jobs') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col, val) => {
            const filtered = mockJobs.filter(j => j.business_id === val);
            return Promise.resolve({ data: filtered, error: null });
          }),
          then: vi.fn((resolve) => resolve({ data: mockJobs, error: null })),
        };
      }
      if (table === 'tarefas') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { task_id: 'TSK-001', business_id: 'BIZ-002', tarefa: 'Criar copy Max Nutrition', definicao_de_pronto: 'Copy pronta' },
            ],
            error: null,
          }),
        };
      }
      if (table === 'agentes') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { agent_id: 'AGT-01', agente: 'Helena' },
              { agent_id: 'AGT-17', agente: 'Isabela' },
              { agent_id: 'AGT-12', agente: 'Victor' },
            ],
            error: null,
          }),
        };
      }
      if (table === 'memoria_mestre') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  },
}));

vi.mock('@/lib/media-client', () => ({
  signedMedia: vi.fn().mockResolvedValue([]),
}));

import EntregasPage from './EntregasPage';

describe('EntregasPage — Caixa de Entregas & Materiais da Equipe', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/entregas']}>
        <EntregasPage />
      </MemoryRouter>
    );
  }

  it('renderiza o cabeçalho executivo e o seletor de modos', async () => {
    renderPage();
    expect(await screen.findByText('Sua caixa de entregas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Material pronto para usar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Todos os Materiais da Equipe/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acompanhar produção/i })).toBeInTheDocument();
  });

  it('permite alternar para a visão de Todos os Materiais da Equipe', async () => {
    renderPage();
    const btnTodos = await screen.findByRole('button', { name: /Todos os Materiais da Equipe/i });
    fireEvent.click(btnTodos);
    expect(btnTodos).toHaveClass('bg-emerald-800');
  });

  it('permite alternar para Ver Todas as Empresas', async () => {
    renderPage();
    const btnEmpresas = await screen.findByRole('button', { name: /Ver Todas as Empresas/i });
    fireEvent.click(btnEmpresas);
    expect(await screen.findByText(/Mostrando Todas as Empresas/i)).toBeInTheDocument();
  });
});
