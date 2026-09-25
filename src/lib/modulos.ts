export type EscopoModulo = "BUSINESS" | "GLOBAL" | "MISTO";

export type Modulo = {
  tabela: string;
  titulo: string;
  grupo: string;
  escopo: EscopoModulo;
  rota?: string;
  descricao?: string;
};

export const MODULOS: Modulo[] = [
  // COMANDO
  { grupo: "Comando", tabela: "portfolio", titulo: "Portfólio de Negócios", escopo: "BUSINESS", rota: "/portfolio", descricao: "Os 3 negócios do grupo: iGreen, Saúde e Humano Digital" },
  { grupo: "Comando", tabela: "foco_executivo", titulo: "Foco Executivo", escopo: "MISTO", descricao: "Prioridade número 1 com WIP Executivo = 1" },
  { grupo: "Comando", tabela: "estado_mestre", titulo: "Estado Mestre", escopo: "MISTO", descricao: "Visão executiva do estado do sistema e do portfólio" },
  { grupo: "Comando", tabela: "decisoes", titulo: "Ledger de Decisões", escopo: "MISTO", descricao: "Registro canônico de deliberações e diretrizes" },
  { grupo: "Comando", tabela: "ideias", titulo: "Banco de Ideias", escopo: "BUSINESS", descricao: "Filtro executivo de ideias: Agora, Depois, Validar" },
  { grupo: "Comando", tabela: "metas_kpis", titulo: "Metas & KPIs", escopo: "MISTO", descricao: "Indicadores principais de desempenho do grupo" },

  // RECEITA
  { grupo: "Receita", tabela: "crm", titulo: "CRM & Vendas", escopo: "BUSINESS", rota: "/crm", descricao: "Funil de vendas, negociações abertas e conversão" },
  { grupo: "Receita", tabela: "marketing", titulo: "Marketing", escopo: "BUSINESS", descricao: "Campanhas, experimentos e CAC atribuído" },
  { grupo: "Receita", tabela: "clientes", titulo: "Clientes", escopo: "BUSINESS", descricao: "Carteira ativa, MRR, ativação e retenção" },
  { grupo: "Receita", tabela: "atendimento", titulo: "Atendimento & Suporte", escopo: "BUSINESS", descricao: "Tickets de atendimento, chamados e SLA" },
  { grupo: "Receita", tabela: "comunicacoes", titulo: "Comunicações", escopo: "BUSINESS", descricao: "Régua de mensagens e contatos com clientes" },

  // EXECUÇÃO
  { grupo: "Execução", tabela: "projetos", titulo: "Projetos", escopo: "BUSINESS", descricao: "Iniciativas estratégicas por unidade de negócio" },
  { grupo: "Execução", tabela: "marcos", titulo: "Marcos", escopo: "BUSINESS", descricao: "Marcos intermediários de progresso dos projetos" },
  { grupo: "Execução", tabela: "tarefas", titulo: "Tarefas", escopo: "BUSINESS", descricao: "Itens acionáveis com dono, prazo e evidência" },
  { grupo: "Execução", tabela: "calendario", titulo: "Calendário", escopo: "BUSINESS", rota: "/calendario", descricao: "Compromissos, follow-ups e agenda executiva" },
  { grupo: "Execução", tabela: "produto", titulo: "Produto & Features", escopo: "BUSINESS", descricao: "Backlog de produto, releases e hipóteses" },

  // FINANÇAS
  { grupo: "Finanças", tabela: "financeiro", titulo: "Caixa & Lançamentos", escopo: "BUSINESS", rota: "/financeiro", descricao: "Lançamentos financeiros, entradas e saídas liquidadas" },
  { grupo: "Finanças", tabela: "contas_financeiras", titulo: "Contas Bancárias", escopo: "BUSINESS", descricao: "Contas de liquidação por empresa" },
  { grupo: "Finanças", tabela: "orcamento", titulo: "Orçamento", escopo: "BUSINESS", descricao: "Planejamento orçamentário anual e mensal" },
  { grupo: "Finanças", tabela: "recorrencias", titulo: "Recorrências", escopo: "BUSINESS", descricao: "Receitas e despesas com recorrência contratual" },
  { grupo: "Finanças", tabela: "plano_contas", titulo: "Plano de Contas", escopo: "GLOBAL", descricao: "Estrutura contábil e gerencial padronizada" },

  // OPERAÇÃO
  { grupo: "Operação", tabela: "processos", titulo: "Processos", escopo: "MISTO", descricao: "Procedimentos operacionais padrão (POPs)" },
  { grupo: "Operação", tabela: "obrigacoes", titulo: "Obrigações & Compliance", escopo: "BUSINESS", descricao: "Prazos fiscais, tributários e contratuais" },
  { grupo: "Operação", tabela: "fornecedores", titulo: "Fornecedores", escopo: "BUSINESS", descricao: "Parceiros de suprimento e serviços terceirizados" },
  { grupo: "Operação", tabela: "ativos", titulo: "Ativos", escopo: "BUSINESS", descricao: "Patrimônio, ferramentas e licenças" },
  { grupo: "Operação", tabela: "documentos", titulo: "Documentos", escopo: "BUSINESS", descricao: "Acervo de documentos corporativos e comprovações" },

  // RISCO & GOVERNANÇA
  { grupo: "Risco & Governança", tabela: "riscos", titulo: "Matriz de Riscos", escopo: "BUSINESS", descricao: "Identificação, impacto, probabilidade e mitigação" },
  { grupo: "Risco & Governança", tabela: "governanca", titulo: "Rituais de Governança", escopo: "MISTO", descricao: "Rituais executivos diários, semanais e mensais" },
  { grupo: "Risco & Governança", tabela: "incidentes", titulo: "Incidentes", escopo: "BUSINESS", descricao: "Registro de anomalias operacionais e RCA" },
  { grupo: "Risco & Governança", tabela: "contratos", titulo: "Contratos", escopo: "BUSINESS", descricao: "Instrumentos jurídicos e acordos formais" },
  { grupo: "Risco & Governança", tabela: "consentimentos", titulo: "Consentimentos & LGPD", escopo: "BUSINESS", descricao: "Bases legais e privacidade de dados" },
  { grupo: "Risco & Governança", tabela: "societario", titulo: "Societário", escopo: "MISTO", descricao: "Quotas, atos constitutivos e governança societária" },

  // EQUIPE
  { grupo: "Equipe", tabela: "equipe", titulo: "Equipe Digital", escopo: "GLOBAL", rota: "/equipe", descricao: "Helena (CEO Virtual) e os 20 especialistas" },
  { grupo: "Equipe", tabela: "agentes", titulo: "Catálogo de Agentes", escopo: "GLOBAL", descricao: "Especificação das 21 funções corporativas" },
  { grupo: "Equipe", tabela: "handoffs", titulo: "Passagens (Handoffs)", escopo: "MISTO", descricao: "Transferência estruturada de missões e contexto" },
  { grupo: "Equipe", tabela: "memoria_mestre", titulo: "Memória Mestre", escopo: "MISTO", descricao: "Registro de contexto persistente da Helena" },
  { grupo: "Equipe", tabela: "pessoas", titulo: "Pessoas & Contatos", escopo: "MISTO", descricao: "Colaboradores, consultores e parceiros" },
  { grupo: "Equipe", tabela: "fundador", titulo: "Fundador", escopo: "GLOBAL", descricao: "Diretrizes e preferências executivas do fundador" },

  // SISTEMA
  { grupo: "Sistema", tabela: "integracoes", titulo: "Integrações", escopo: "MISTO", descricao: "Conexões externas: Evolution, Supabase, Grok, etc." },
  { grupo: "Sistema", tabela: "automacoes", titulo: "Automações", escopo: "MISTO", descricao: "Gatilhos, regras e fluxos automatizados" },
  { grupo: "Sistema", tabela: "agent_jobs", titulo: "Fila de Tarefas dos Agentes", escopo: "GLOBAL", descricao: "Fila técnica de execução dos especialistas" },
  { grupo: "Sistema", tabela: "agent_connections", titulo: "Conexões dos Agentes", escopo: "GLOBAL", descricao: "Status real dos providers (ChatGPT, Grok Bot, etc.)" },
  { grupo: "Sistema", tabela: "notification_outbox", titulo: "Fila de Notificações", escopo: "GLOBAL", descricao: "Outbox de mensagens WhatsApp via Evolution API" },
  { grupo: "Sistema", tabela: "auditoria", titulo: "Auditoria de Operações", escopo: "GLOBAL", descricao: "Log append-only de alterações críticas" },
  { grupo: "Sistema", tabela: "auditoria_sistema", titulo: "Auditoria do Sistema", escopo: "GLOBAL", descricao: "Logs técnicos de integridade e infraestrutura" },
  { grupo: "Sistema", tabela: "acessos", titulo: "Controle de Acessos", escopo: "GLOBAL", descricao: "Permissões de usuários e papéis organizacionais" },
  { grupo: "Sistema", tabela: "backups", titulo: "Backups & Snapshots", escopo: "GLOBAL", descricao: "Histórico de salvamentos e restaurações" },
  { grupo: "Sistema", tabela: "configuracao", titulo: "Configurações Gerais", escopo: "GLOBAL", descricao: "Parâmetros globais do Sistema Helena" },

  // REFERÊNCIA
  { grupo: "Referência", tabela: "helena_guia", titulo: "Guia da Helena", escopo: "GLOBAL", descricao: "Princípios operacionais e código de conduta da Helena" },
  { grupo: "Referência", tabela: "helena_campos", titulo: "Dicionário de Campos", escopo: "GLOBAL", descricao: "Mapeamento oficial das colunas da V8" },
  { grupo: "Referência", tabela: "dicionario_dados", titulo: "Dicionário de Dados", escopo: "GLOBAL", descricao: "Especificação semântica e técnica das entidades" },
  { grupo: "Referência", tabela: "regras_formula", titulo: "Regras de Negócio", escopo: "GLOBAL", descricao: "Fórmulas de DRE, fluxo de caixa e validações" },
  { grupo: "Referência", tabela: "listas_dominio", titulo: "Listas de Domínio", escopo: "GLOBAL", descricao: "Enums e valores válidos para campos de estado" },
  { grupo: "Referência", tabela: "sistema_vivo", titulo: "Sistema Vivo", escopo: "GLOBAL", descricao: "Arquitetura e estado de saúde da plataforma" },
  { grupo: "Referência", tabela: "protocolo_agentes", titulo: "Protocolo dos Agentes", escopo: "GLOBAL", descricao: "Convenção de chamadas e formato de handoff" },
];

export const GRUPOS = [...new Set(MODULOS.map((m) => m.grupo))];

export function obterModulo(tabela: string): Modulo | undefined {
  return MODULOS.find((m) => m.tabela === tabela);
}

export function obterEscopoModulo(tabela: string): EscopoModulo {
  const mod = MODULOS.find((m) => m.tabela === tabela);
  return mod?.escopo || "BUSINESS";
}

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
