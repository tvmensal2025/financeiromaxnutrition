import { supabase } from '@/lib/supabase';
import { CONTRATOS_MODULOS } from '@/lib/modulo-contratos';

export type VersaoRegistro = number | string;
export const TABELAS_PROTEGIDAS = new Set(["equipe","sistema_vivo","listas_dominio","helena_guia","backups","acessos","comunicacoes","pessoas","fundador","financeiro","documentos","marketing","obrigacoes","atendimento","clientes","riscos","crm","contas_financeiras","contratos","handoffs","portfolio","governanca","estado_mestre","foco_executivo","fluxo_caixa","recorrencias","decisoes","agentes","memoria_mestre","consentimentos","auditoria_sistema","regras_formula","orcamento","guia_operacao","entidades","ativos","societario","metas_kpis","incidentes","fornecedores","produto","automacoes","projetos","calendario","tarefas","ideias","processos","dicionario_dados","integracoes","plano_contas","dre_mensal","protocolo_agentes","marcos","configuracao"]);
export const MENSAGEM_CONFLITO = 'Outra conversa ou pessoa alterou este registro. Seu rascunho foi preservado. Reabra a versão atual e compare antes de salvar.';
// PT409 é o código atual do conflito de versão; 40001 fica aceito para respostas antigas.
export const ehConflitoDeVersao = (code: unknown) => code === 'PT409' || code === '40001';
const SISTEMA = new Set(['row_version', 'criado_em', 'created_at', 'atualizado_em', 'updated_at']);
const ESCOPO_IMUTAVEL = new Set(['business_id', 'business_id_area', 'scope_type', 'source_system']);

// A versão vem da leitura que originou a intenção; nunca buscar outra para repetir um conflito.
export async function escreverRegistro(
  tabela: string, id: string, versao: unknown, alteracoes: Record<string, unknown> = {}, excluir = false,
) {
  if (!TABELAS_PROTEGIDAS.has(tabela)) {
    return { data: null, error: { code: 'TABELA_NAO_PERMITIDA', message: 'Tabela não autorizada para escrita protegida.' } };
  }
  if (!id || typeof id !== 'string') {
    return { data: null, error: { code: 'CHAVE_AUSENTE', message: 'Identificador do registro não disponível.' } };
  }
  if (!/^[1-9][0-9]*$/.test(String(versao ?? ''))) {
    return { data: null, error: { code: 'VERSAO_AUSENTE', message: 'Versão não disponível. Reabra o registro antes de alterá-lo.' } };
  }
  const chavePrimaria = CONTRATOS_MODULOS[tabela]?.id;
  if (!chavePrimaria) {
    return { data: null, error: { code: 'CHAVE_NAO_CONFIGURADA', message: 'Chave primária não configurada para esta tabela.' } };
  }
  if (Object.keys(alteracoes).some(key => key === chavePrimaria || ESCOPO_IMUTAVEL.has(key))) {
    return { data: null, error: { code: 'CHAVE_IMUTAVEL', message: 'Identificadores e chaves do registro não podem ser alterados.' } };
  }
  if (excluir && Object.keys(alteracoes).length > 0) {
    return { data: null, error: { code: 'EXCLUSAO_COM_ALTERACOES', message: 'Uma exclusão não aceita alterações simultâneas.' } };
  }
  const changes = Object.fromEntries(Object.entries(alteracoes).filter(([key]) => !SISTEMA.has(key)));
  const { data, error } = await supabase.rpc('helena_write_record', {
    p_table: tabela, p_id: id, p_expected_version: versao, p_changes: changes, p_delete: excluir,
  });
  if (error) return { data: null, error: { ...error, message: ehConflitoDeVersao(error.code) ? MENSAGEM_CONFLITO : error.message } };
  if (!data) return { data: null, error: { code: 'SEM_CONFIRMACAO', message: 'O banco não confirmou a alteração. Consulte o registro antes de tentar novamente.' } };
  return { data: data as Record<string, unknown>, error: null };
}
