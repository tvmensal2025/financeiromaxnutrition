import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: mock }));
import { escreverRegistro, MENSAGEM_CONFLITO } from './escrita-protegida';
import { atualizarTarefa } from './tarefa-acoes';

beforeEach(() => vi.clearAllMocks());
describe('Escrita com versão da leitura', () => {
  it('não procura uma versão nova nem repete a gravação depois de conflito', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'conflict' } });
    const draft = { tarefa: 'Meu rascunho', prazo: '2026-10-10' };
    const result = await escreverRegistro('tarefas', 'T1', 8, draft);
    expect(result.error?.message).toBe(MENSAGEM_CONFLITO);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith('helena_write_record', expect.objectContaining({p_expected_version:8,p_changes:draft}));
    expect(mock.from).not.toHaveBeenCalled();
    expect(draft).toEqual({ tarefa: 'Meu rascunho', prazo: '2026-10-10' });
  });
  it.each([undefined, null, 0, -1, '', 'abc'])('impede alteração sem versão válida: %s', async version => {
    const result = await escreverRegistro('tarefas', 'T1', version, {status:'CONCLUÍDA'});
    expect(result.error?.code).toBe('VERSAO_AUSENTE');
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('retorna somente a linha confirmada e sua nova versão', async () => {
    const saved = {task_id:'T1',row_version:12,status:'CONCLUÍDA'};
    mock.rpc.mockResolvedValue({data:saved,error:null});
    const result = await escreverRegistro('tarefas','T1',8,{status:'CONCLUÍDA',row_version:999,atualizado_em:'inventado'});
    expect(result.data).toEqual(saved);
    expect(mock.rpc.mock.calls[0][1].p_changes).toEqual({status:'CONCLUÍDA'});
  });
  it('exclusão usa a versão exibida na confirmação', async () => {
    mock.rpc.mockResolvedValue({data:{row_version:8},error:null});
    await escreverRegistro('portfolio','BIZ-TEST',8,{},true);
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({p_expected_version:8,p_delete:true});
  });
  it('não anuncia sucesso quando o banco não confirma nenhuma linha', async () => {
    mock.rpc.mockResolvedValue({data:null,error:null});
    expect((await escreverRegistro('tarefas','T1',8,{status:'CONCLUÍDA'})).error?.code).toBe('SEM_CONFIRMACAO');
  });
  it('um conflito na tarefa não propaga dados antigos para a agenda', async () => {
    mock.rpc.mockResolvedValue({data:null,error:{code:'40001',message:'conflict'}});
    const result = await atualizarTarefa('T1',{prazo:'2026-10-10'},{task_id:'T1',business_id:'BIZ-001',tarefa:'Teste',row_version:8});
    expect(result.erro).toBe(MENSAGEM_CONFLITO);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.from).not.toHaveBeenCalled();
  });
});
