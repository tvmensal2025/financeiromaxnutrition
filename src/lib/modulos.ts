export type Modulo = {
  tabela: string;
  titulo: string;
  grupo: string;
};

export const MODULOS: Modulo[] = [
  { grupo: "Direção", tabela: "foco_executivo", titulo: "Foco executivo" },
  { grupo: "Direção", tabela: "ideias", titulo: "Ideias" },
  { grupo: "Direção", tabela: "decisoes", titulo: "Decisões" },
  { grupo: "Direção", tabela: "memoria_mestre", titulo: "Memória" },
  { grupo: "Direção", tabela: "handoffs", titulo: "Passagens" },
  { grupo: "Direção", tabela: "estado_mestre", titulo: "Estado mestre" },
  { grupo: "Negócios", tabela: "portfolio", titulo: "Portfólio" },
  { grupo: "Negócios", tabela: "crm", titulo: "CRM" },
  { grupo: "Negócios", tabela: "clientes", titulo: "Clientes" },
  { grupo: "Negócios", tabela: "marketing", titulo: "Marketing" },
  { grupo: "Negócios", tabela: "produto", titulo: "Produto" },
  { grupo: "Negócios", tabela: "contratos", titulo: "Contratos" },
  { grupo: "Dinheiro", tabela: "financeiro", titulo: "Financeiro" },
  { grupo: "Dinheiro", tabela: "contas_financeiras", titulo: "Contas" },
  { grupo: "Dinheiro", tabela: "orcamento", titulo: "Orçamento" },
  { grupo: "Dinheiro", tabela: "plano_contas", titulo: "Plano de contas" },
  { grupo: "Dinheiro", tabela: "recorrencias", titulo: "Recorrências" },
  { grupo: "Execução", tabela: "projetos", titulo: "Projetos" },
  { grupo: "Execução", tabela: "tarefas", titulo: "Tarefas" },
  { grupo: "Execução", tabela: "calendario", titulo: "Calendário" },
  { grupo: "Execução", tabela: "obrigacoes", titulo: "Obrigações" },
  { grupo: "Pessoas", tabela: "agentes", titulo: "Agentes" },
  { grupo: "Pessoas", tabela: "equipe", titulo: "Equipe" },
  { grupo: "Pessoas", tabela: "pessoas", titulo: "Pessoas" },
  { grupo: "Pessoas", tabela: "atendimento", titulo: "Atendimento" },
  { grupo: "Pessoas", tabela: "fundador", titulo: "Fundador" },
  { grupo: "Controle", tabela: "riscos", titulo: "Riscos" },
  { grupo: "Controle", tabela: "governanca", titulo: "Governança" },
  { grupo: "Controle", tabela: "auditoria", titulo: "Auditoria" },
  { grupo: "Controle", tabela: "integracoes", titulo: "Integrações" },
  { grupo: "Controle", tabela: "automacoes", titulo: "Automações" },
  { grupo: "Controle", tabela: "configuracao", titulo: "Configuração" },
  { grupo: "Referência", tabela: "helena_guia", titulo: "Guia da Helena" },
  { grupo: "Referência", tabela: "helena_campos", titulo: "Mapa de campos" },
  { grupo: "Referência", tabela: "regras_formula", titulo: "Fórmulas" },
  { grupo: "Referência", tabela: "listas_dominio", titulo: "Listas" },
];

export const GRUPOS = [...new Set(MODULOS.map((m) => m.grupo))];

export const SEM_EXCLUSAO = new Set([
  "memoria_mestre",
  "decisoes",
  "auditoria",
  "auditoria_sistema",
  "helena_guia",
  "helena_campos",
  "regras_formula",
  "dicionario_dados",
]);

export const COLUNAS_SISTEMA = new Set([
  "linha_planilha",
  "criado_em",
  "atualizado_em",
  "created_at",
  "updated_at",
  "last_sync",
  "external_updated_at",
  "sync_status",
  "source_system",
  "idempotency_key",
  "integration_id",
  "external_id",
  "related_object_type",
  "related_object_id",
  "conferencia_integracao",
]);
