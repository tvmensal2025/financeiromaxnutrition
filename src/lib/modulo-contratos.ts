/** Explicit read contracts for the archived module catalog. These are historical
 * columns, not a claim about the live database schema. Unknown tables/columns
 * never become part of a query through runtime metadata. */
export type ContratoModulo = {
  id: string;
  business?: 'business_id' | 'business_id_area';
  global?: boolean;
  columns: readonly string[];
  search?: string;
  edit?: readonly string[];
  create?: boolean;
};

const contract = (id: string, fields: string, business?: ContratoModulo['business'], search?: string, edit?: string): ContratoModulo => ({
  id, business, columns: fields.split(' '), search, edit: edit?.split(' '),
});

export const CONTRATOS_MODULOS: Record<string, ContratoModulo> = {
  portfolio: contract('business_id', 'business_id negocio estagio objetivo_atual principal_gargalo responsavel_executivo row_version', undefined, 'negocio'),
  foco_executivo: { ...contract('id', 'id ordem escopo frente objetivo status criterio_de_saida responsavel row_version', undefined, 'objetivo'), global: true },
  estado_mestre: { ...contract('registro_id', 'registro_id area item estado_atual proxima_acao responsavel row_version', undefined, 'item'), global: true },
  decisoes: contract('decision_id', 'decision_id business_id data_hora escopo decisao motivo status row_version', 'business_id', 'decisao'),
  ideias: { ...contract('id', 'id business_id ideia motivo potencial decisao revisar_em responsavel row_version', 'business_id', 'ideia', 'ideia motivo potencial decisao revisar_em responsavel'), create: true },
  metas_kpis: contract('kpi_id', 'kpi_id business_id area kpi meta ultimo_valor status row_version', 'business_id', 'kpi'),
  marketing: { ...contract('campaign_id', 'campaign_id business_id campanha_experimento canal status inicio fim investimento_brl responsavel row_version', 'business_id', 'campanha_experimento', 'campanha_experimento canal status inicio fim responsavel'), create: true },
  clientes: contract('customer_id', 'customer_id business_id nome tipo status plano_produto ultimo_contato responsavel_cs row_version', 'business_id', 'nome'),
  atendimento: { ...contract('ticket_id', 'ticket_id business_id assunto categoria prioridade status sla_prazo responsavel row_version', 'business_id', 'assunto', 'assunto categoria prioridade status sla_prazo responsavel'), create: true },
  comunicacoes: contract('communication_id', 'communication_id business_id data_hora canal assunto resumo proxima_acao prazo responsavel row_version', 'business_id', 'assunto'),
  projetos: { ...contract('project_id', 'project_id business_id projeto objetivo status prioridade responsavel prazo row_version', 'business_id', 'projeto', 'projeto objetivo status prioridade responsavel prazo'), create: true },
  marcos: { ...contract('milestone_id', 'milestone_id business_id project_id marco descricao responsavel prazo status row_version', 'business_id', 'marco', 'marco descricao responsavel prazo status'), create: true },
  tarefas: contract('task_id', 'task_id business_id project_id tarefa responsavel prioridade prazo status bloqueio row_version', 'business_id', 'tarefa'),
  produto: { ...contract('product_item_id', 'product_item_id business_id item tipo prioridade status criterio_de_aceite responsavel data_alvo row_version', 'business_id', 'item', 'item tipo prioridade status criterio_de_aceite responsavel data_alvo'), create: true },
  contas_financeiras: contract('conta_id', 'conta_id business_id nome tipo instituicao moeda ativa row_version', 'business_id', 'nome'),
  orcamento: contract('budget_id', 'budget_id business_id periodo_inicio periodo_fim valor_orcado_brl valor_realizado_brl status row_version', 'business_id'),
  recorrencias: contract('recurrence_id', 'recurrence_id business_id nome tipo frequencia proxima_ocorrencia valor status row_version', 'business_id', 'nome'),
  plano_contas: contract('plano_conta_id', 'plano_conta_id codigo nome classe_dre fluxo_esperado ativo row_version', undefined, 'nome'),
  processos: { ...contract('process_id', 'process_id business_id processo area responsavel frequencia status proxima_revisao row_version', 'business_id', 'processo', 'processo area responsavel frequencia status proxima_revisao'), create: true },
  obrigacoes: contract('obligation_id', 'obligation_id business_id titulo tipo status prazo responsavel row_version', 'business_id'),
  fornecedores: contract('supplier_id', 'supplier_id business_id fornecedor_parceiro categoria status proximo_vencimento responsavel row_version', 'business_id', 'fornecedor_parceiro'),
  ativos: contract('asset_id', 'asset_id business_id nome tipo descricao status responsavel row_version', 'business_id', 'nome'),
  documentos: contract('document_id', 'document_id business_id titulo tipo descricao status responsavel sensibilidade row_version', 'business_id', 'titulo'),
  riscos: { ...contract('risk_id', 'risk_id business_id risco categoria probabilidade impacto status responsavel row_version', 'business_id', 'risco', 'risco categoria probabilidade impacto status responsavel'), create: true },
  governanca: contract('governance_id', 'governance_id ritual escopo cadencia dono status proxima_realizacao row_version', undefined, 'ritual'),
  incidentes: contract('incident_id', 'incident_id business_id titulo tipo severidade status responsavel row_version', 'business_id', 'titulo'),
  contratos: contract('contract_id', 'contract_id business_id contraparte tipo objeto inicio fim status responsavel row_version', 'business_id', 'objeto'),
  consentimentos: contract('consent_id', 'consent_id business_id tipo_purpose status concedido_em revogado_em expira_em row_version', 'business_id'),
  agentes: contract('agent_id', 'agent_id agente cargo_funcao missao status row_version', undefined, 'agente'),
  handoffs: contract('id', 'id business_id_area assunto de para prioridade prazo status row_version', 'business_id_area', 'assunto'),
  helena_guia: contract('ordem', 'ordem assunto regra row_version', undefined, 'assunto'),
  dicionario_dados: contract('registro_id', 'registro_id sheet campo tipo_logico descricao row_version', undefined, 'campo'),
  listas_dominio: contract('id', 'id lista valor ordem row_version', undefined, 'valor'),
  regras_formula: contract('id', 'id tabela coluna formula row_version', undefined, 'tabela'),
  protocolo_agentes: contract('protocolo_id', 'protocolo_id versao secao regra status row_version', undefined, 'secao'),
  crm: contract('opportunity_id', 'opportunity_id business_id empresa_lead etapa status responsavel proxima_acao data_proxima_acao valor_potencial row_version', 'business_id', 'empresa_lead'),
  calendario: contract('event_id', 'event_id business_id titulo tipo inicio fim status responsavel row_version', 'business_id', 'titulo'),
  financeiro: contract('finance_id', 'finance_id business_id competencia vencimento descricao fluxo valor_original moeda status row_version', 'business_id', 'descricao'),
  equipe: contract('agent_id', 'agent_id nome funcao responsabilidade_principal status row_version', undefined, 'nome'),
  fundador: contract('registro_id', 'registro_id data area padrao_objetivo compromisso resultado proxima_pratica status row_version', undefined, 'area'),
  helena_campos: contract('id', 'id tabela coluna nome_na_planilha chave calculado como_usar', undefined, 'coluna'),
  memoria_mestre: contract('id', 'id business_id_area data_hora tipo assunto proxima_acao status sensibilidade row_version', 'business_id_area', 'assunto'),
  // No freeform memory body is selected: old rows can contain unclassified credentials.
  pessoas: contract('person_id', 'person_id nome tipo funcao area status row_version', undefined, 'nome'),
  societario: { ...contract('stake_id', 'stake_id entity_id tipo_participacao percentual status row_version'), global: true },
  sistema_vivo: contract('registro_id', 'registro_id conceito regra_operacional responsavel row_version', undefined, 'conceito'),
  acessos: contract('access_id', 'access_id sistema tipo_acesso papel status responsavel row_version', undefined, 'sistema'),
  agent_connections: contract('id', 'id agent_id provider connection_status last_seen_at last_tested_at', undefined, 'agent_id'),
  agent_jobs: contract('job_id', 'job_id business_id task_id agent_id priority status scheduled_at started_at completed_at', 'business_id'),
  auditoria: contract('audit_id', 'audit_id data_hora agente_usuario acao sheet object_id sensibilidade', undefined, 'sheet'),
  auditoria_sistema: contract('test_id', 'test_id area teste resultado severidade ultimo_teste row_version', undefined, 'teste'),
  automacoes: contract('automation_id', 'automation_id business_id nome status responsavel ultima_execucao proxima_execucao row_version', 'business_id', 'nome'),
  backups: contract('backup_id', 'backup_id data_hora versao_sistema motivo status row_version'),
  integracoes: contract('integration_id', 'integration_id business_id sistema objeto direcao status ultima_sync proxima_sync row_version', 'business_id', 'sistema'),
  notification_outbox: contract('notification_id', 'notification_id business_id job_id channel status scheduled_at sent_at', 'business_id'),
  task_activity: contract('event_id', 'event_id business_id task_id event_type status_before status_after occurred_at', 'business_id'),
};
