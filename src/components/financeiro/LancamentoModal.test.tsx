import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), onFechar: vi.fn(), onSalvo: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mocks.rpc(...args) } }));
vi.mock('@/auth', () => ({ useAuth: () => ({ user: { id: 'founder' }, isFounder: true }) }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({
  currentBusinessId: 'BIZ-001', isConsolidated: false, selecionadas: ['BIZ-001'],
  empresas: [{ id: 'BIZ-001', business_id: 'BIZ-001', nome: 'Empresa', sigla: 'E' }],
}) }));

import { LancamentoModal } from './LancamentoModal';
import { MENSAGEM_CONFLITO } from '@/lib/escrita-protegida';

const props = {
  aberto: true,
  onFechar: mocks.onFechar,
  onSalvo: mocks.onSalvo,
  lancamentoParaEditar: {
    finance_id: 'FIN-001', business_id: 'BIZ-001', row_version: 4,
    descricao: 'Serviço', valor_original: '15.00', moeda: 'BRL',
    fluxo: 'SAÍDA', status: 'ABERTO', conta_id: 'CONTA-1', plano_conta_id: 'PLANO-1',
  },
  contasDisponiveis: [
    { conta_id: 'CONTA-1', business_id: 'BIZ-001', nome: 'Conta 1' },
    { conta_id: 'CONTA-2', business_id: 'BIZ-001', nome: 'Conta 2' },
  ],
  planosDisponiveis: [{ plano_conta_id: 'PLANO-1', nome: 'Plano 1' }],
};

beforeEach(() => { vi.clearAllMocks(); });

describe('edição financeira protegida', () => {
  it('envia versão e FKs editáveis ao RPC sem business_id', async () => {
    mocks.rpc.mockResolvedValue({ data: { finance_id: 'FIN-001', row_version: 5 }, error: null });
    render(<LancamentoModal {...props} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Conta de Origem' }), { target: { value: 'CONTA-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith('helena_write_record', expect.objectContaining({
      p_table: 'financeiro', p_id: 'FIN-001', p_expected_version: 4,
      p_changes: expect.objectContaining({ conta_id: 'CONTA-2', plano_conta_id: 'PLANO-1' }),
    }));
    expect(mocks.rpc.mock.calls[0][1].p_changes).not.toHaveProperty('business_id');
    expect(mocks.onSalvo).toHaveBeenCalledOnce();
    expect(mocks.onFechar).toHaveBeenCalledOnce();
  });

  it('mantém o rascunho aberto em conflito de versão', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PT409', message: 'version conflict' } });
    render(<LancamentoModal {...props} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Descrição do Lançamento/i }), { target: { value: 'Serviço revisado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByText(MENSAGEM_CONFLITO)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Descrição do Lançamento/i })).toHaveValue('Serviço revisado');
    expect(mocks.onSalvo).not.toHaveBeenCalled();
    expect(mocks.onFechar).not.toHaveBeenCalled();
  });
});
