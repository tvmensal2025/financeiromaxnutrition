import { supabase } from '@/lib/supabase';

export type VersaoRegistro = number | string;
export const TABELAS_PROTEGIDAS = new Set(["equipe","sistema_vivo","listas_dominio","helena_guia","backups","acessos","comunicacoes","pessoas","fundador","financeiro","documentos","marketing","obrigacoes","atendimento","clientes","riscos","crm","contas_financeiras","contratos","handoffs","portfolio","governanca","estado_mestre","foco_executivo","fluxo_caixa","recorrencias","decisoes","agentes","memoria_mestre","consentimentos","auditoria_sistema","regras_formula","orcamento","guia_operacao","entidades","ativos","societario","metas_kpis","incidentes","fornecedores","produto","automacoes","projetos","calendario","tarefas","ideias","processos","dicionario_dados","integracoes","plano_contas","dre_mensal","protocolo_agentes","marcos","configuracao"]);
export const MENSAGEM_CONFLITO = 'Outra conversa ou pessoa alterou este registro. Seu rascunho foi preservado. Reabra a versão atual e compare antes de salvar.';
const SISTEMA = new Set(['row_version', 'criado_em', 'created_at', 'atualizado_em', 'updated_at']);

// A versão vem da leitura que originou a intenção; nunca buscar outra para repetir um conflito.
export async function escreverRegistro(
  tabela: string, id: string, versao: unknown, alteracoes: Record<string, unknown> = {}, excluir = false,
) {
  if (!/^[1-9][0-9]*$/.test(String(versao ?? ''))) {
    return { data: null, error: { code: 'VERSAO_AUSENTE', message: 'Versão não disponível. Reabra o registro antes de alterá-lo.' } };
  }
  const changes = Object.fromEntries(Object.entries(alteracoes).filter(([key]) => !SISTEMA.has(key)));
  const { data, error } = await supabase.rpc('helena_write_record', {
    p_table: tabela, p_id: id, p_expected_version: versao, p_changes: changes, p_delete: excluir,
  });
  if (error) return { data: null, error: { ...error, message: error.code === '40001' ? MENSAGEM_CONFLITO : error.message } };
  if (!data) return { data: null, error: { code: 'SEM_CONFIRMACAO', message: 'O banco não confirmou a alteração. Consulte o registro antes de tentar novamente.' } };
  return { data: data as Record<string, unknown>, error: null };
}
