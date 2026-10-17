import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: mock }));

import { escreverRegistro, MENSAGEM_CONFLITO } from './escrita-protegida';

beforeEach(() => vi.clearAllMocks());

describe('escrita protegida', () => {
  it('rejeita tabelas fora da lista antes de chamar a RPC', async () => {
    expect((await escreverRegistro('app_access', 'u1', 2, { role: 'founder' })).error?.code).toBe('TABELA_NAO_PERMITIDA');
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 0, -1, '', 'abc'])('exige a versão lida: %s', async version => {
    expect((await escreverRegistro('tarefas', 'T1', version, { status: 'CONCLUÍDA' })).error?.code).toBe('VERSAO_AUSENTE');
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('não permite mudar chaves e não envia campos do sistema', async () => {
    expect((await escreverRegistro('portfolio', 'BIZ-001', 3, { business_id: 'BIZ-002' })).error?.code).toBe('CHAVE_IMUTAVEL');
    expect(mock.rpc).not.toHaveBeenCalled();
    mock.rpc.mockResolvedValue({ data: { task_id: 'T1', row_version: 4 }, error: null });
    await escreverRegistro('tarefas', 'T1', 3, { status: 'FEITA', row_version: 900, atualizado_em: 'falso' });
    expect(mock.rpc).toHaveBeenCalledWith('helena_write_record', expect.objectContaining({
      p_table: 'tarefas', p_id: 'T1', p_expected_version: 3, p_changes: { status: 'FEITA' }, p_delete: false,
    }));
  });

  it('aceita vínculos financeiros editáveis e preserva cada chave estrangeira enviada', async () => {
    mock.rpc.mockResolvedValue({ data: { finance_id: 'FIN-1', row_version: 4 }, error: null });
    const changes = { conta_id: 'CONTA-2', conta_destino_id: 'CONTA-3', plano_conta_id: 'PLANO-4' };
    expect((await escreverRegistro('financeiro', 'FIN-1', 3, changes)).error).toBeNull();
    expect(mock.rpc.mock.calls[0][1].p_changes).toEqual(changes);
    expect(changes).toEqual({ conta_id: 'CONTA-2', conta_destino_id: 'CONTA-3', plano_conta_id: 'PLANO-4' });
  });

  it('bloqueia a chave primária e o escopo empresarial sem bloquear referências de tarefas', async () => {
    for (const changes of [{ finance_id: 'FIN-2' }, { business_id: 'BIZ-002' }, { business_id_area: 'BIZ-002' }, { source_system: 'OUTRO' }]) {
      expect((await escreverRegistro('financeiro', 'FIN-1', 3, changes)).error?.code).toBe('CHAVE_IMUTAVEL');
    }
    expect((await escreverRegistro('tarefas', 'TASK-1', 3, { task_id: 'TASK-2' })).error?.code).toBe('CHAVE_IMUTAVEL');
    expect(mock.rpc).not.toHaveBeenCalled();
    mock.rpc.mockResolvedValue({ data: { task_id: 'TASK-1', row_version: 4 }, error: null });
    expect((await escreverRegistro('tarefas', 'TASK-1', 3, { project_id: 'PROJ-2' })).error).toBeNull();
    expect(mock.rpc.mock.calls[0][1].p_changes).toEqual({ project_id: 'PROJ-2' });
  });

  it('mantém o rascunho após conflito sem repetir a gravação', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: 'PT409', message: 'conflict' } });
    const draft = { tarefa: 'Rascunho' };
    expect((await escreverRegistro('tarefas', 'T1', 8, draft)).error?.message).toBe(MENSAGEM_CONFLITO);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(draft).toEqual({ tarefa: 'Rascunho' });
  });

  it('não confirma sucesso sem linha retornada', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: null });
    expect((await escreverRegistro('tarefas', 'T1', 8, { status: 'FEITA' })).error?.code).toBe('SEM_CONFIRMACAO');
  });
});
