import { diaSaoPaulo } from "./comando";
/**
 * SISTEMA HELENA — CENTRAL DE EXECUÇÃO
 * Modelos, cálculos executivos ponderados e queries para o acompanhamento dos 21 agentes.
 * Fonte única de verdade: Supabase canônico.
 */
import { supabase } from "@/lib/supabase";

export type PrioridadeTarefa = "CRÍTICA" | "ALTA" | "MÉDIA" | "BAIXA";
export type StatusTarefa = "NÃO INICIADA" | "EM EXECUÇÃO" | "BLOQUEADA" | "CONCLUÍDA" | "CANCELADA";
export type StatusAgenteVisual = "TRABALHANDO" | "AGUARDANDO" | "BLOQUEADO" | "SEM TAREFA" | "DECISÃO PENDENTE" | "REVISÃO PENDENTE";

export function dataHojeBrasil(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export interface TarefaExecucao {
  task_id: string;
  project_id?: string | null;
  business_id: string;
  tarefa: string;
  tipo?: string | null;
  responsavel: string;
  prioridade: PrioridadeTarefa | string;
  prazo?: string | null;
  status: StatusTarefa | string;
  definicao_de_pronto?: string | null;
  evidencia?: string | null;
  bloqueio?: string | null;
  related_object?: string | null;
  related_object_type?: string | null;
  related_object_id?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

export interface MarcoExecucao {
  milestone_id: string;
  project_id: string;
  business_id: string;
  marco: string;
  descricao?: string | null;
  responsavel?: string | null;
  prazo?: string | null;
  status: string;
  criterio_de_aceite?: string | null;
  evidencia?: string | null;
  concluido_em?: string | null;
}

export interface ProjetoExecucao {
  project_id: string;
  business_id: string;
  projeto: string;
  tipo?: string | null;
  objetivo?: string | null;
  status: string;
  prioridade: string;
  responsavel: string;
  sponsor?: string | null;
  inicio?: string | null;
  prazo?: string | null;
  criterio_de_conclusao?: string | null;
  marco_atual?: string | null;
  dependencias?: string | null;
  risco_principal?: string | null;
  progresso_executivo: number; // Ex: 5.2
  progresso_tecnico: string; // Ex: "60.6%" ou "Não registrado"
  ultimo_diagnostico_tecnico?: string | null;
  tarefas_totais: number;
  concluidas: number;
  em_execucao: number;
  bloqueadas: number;
  proxima_entrega?: string | null;
  ultima_atualizacao?: string | null;
  marcos: MarcoExecucao[];
}

export interface HandoffExecucao {
  id: string;
  data_hora: string;
  de: string;
  para: string;
  business_id_area?: string | null;
  assunto: string;
  contexto_essencial?: string | null;
  pergunta_tarefa_transferida?: string | null;
  pendencias?: string | null;
  prioridade: string;
  prazo?: string | null;
  status: string;
  retorno_conclusao?: string | null;
  memoria_relacionada?: string | null;
  related_object_id?: string | null;
  scope_type?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

export interface AuditoriaExecucao {
  audit_id: string;
  data_hora: string;
  agente_usuario: string;
  acao: string;
  sheet?: string | null;
  object_id?: string | null;
  campo?: string | null;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  motivo?: string | null;
  fonte_evidencia?: string | null;
  sensibilidade?: string | null;
  criado_em?: string | null;
}

export interface AgenteExecucao {
  agent_id: string;
  numero: string;
  agente: string;
  cargo_funcao: string;
  missao?: string | null;
  quando_ativar?: string | null;
  area: string;
  provider: "CHATGPT" | "GROK" | "OTHER";
  connection_status: "CONNECTED" | "PLANNED" | "NOT_CONNECTED";
  capabilities: string[];
  status_visual: StatusAgenteVisual;
  tarefa_atual?: TarefaExecucao | null;
  tarefas_pendentes: number;
  concluidas_hoje: number;
  bloqueios: number;
  ultima_atividade?: string | null;
  ultimo_handoff_enviado?: HandoffExecucao | null;
  ultimo_handoff_recebido?: HandoffExecucao | null;
  revisao_pendente?: HandoffExecucao | null;
  tarefas_atribuidas: TarefaExecucao[];
  auditorias_realizadas: AuditoriaExecucao[];
}

export interface EventoTimeline {
  id: string;
  timestamp: string;
  tipo: "AUDITORIA" | "HANDOFF" | "TAREFA" | "MEMORIA" | "DECISAO";
  autor: string;
  titulo: string;
  descricao?: string | null;
  projeto?: string | null;
  empresa?: string | null;
  evidencia?: string | null;
}

export interface ItemAtencao {
  id: string;
  categoria: "DECISAO_FUNDADOR" | "DECISAO_HELENA" | "BLOQUEIO_AGENTE" | "RISCO_CRITICO" | "TAREFA_VENCIDA";
  titulo: string;
  descricao: string;
  responsavel: string;
  projeto?: string | null;
  empresa?: string | null;
  prazo?: string | null;
  impacto: "CRÍTICO" | "ALTO" | "MÉDIO";
  acao_necessaria: string;
  objeto_id?: string | null;
}

export interface IndicadoresOperacionais {
  tarefas_em_execucao: number;
  tarefas_bloqueadas: number;
  tarefas_atrasadas: number;
  concluidas_hoje: number;
  handoffs_pendentes: number;
  decisoes_pendentes: number;
  agentes_com_atividade_hoje: number;
  agentes_sem_atividade: number;
}

export interface FiltrosExecucao {
  empresaId: string; // "TODAS", "GRUPO", "BIZ-001", "BIZ-002", "BIZ-003"
  projetoId: string; // "TODOS", "PRJ-0001", "PRJ-0002"
  agenteId: string; // "TODOS", "AGT-01", etc.
  status: string; // "TODOS", "NÃO INICIADA", etc.
  prioridade: string; // "TODAS", "CRÍTICA", etc.
  periodo: "TODOS" | "HOJE" | "7_DIAS" | "30_DIAS";
}

// Pesos da metodologia executiva MEM-0023
export const PESOS_PRIORIDADE: Record<string, number> = {
  CRÍTICA: 5,
  CRITICA: 5,
  ALTA: 3,
  MÉDIA: 2,
  MEDIA: 2,
  BAIXA: 1,
};

/**
 * Calcula o progresso executivo ponderado conforme metodologia oficial MEM-0023:
 * (Soma dos pesos das tarefas CONCLUÍDAS ÷ Soma dos pesos de todas as tarefas exceto CANCELADA) × 100, truncado em 1 casa decimal.
 */
export function calcularProgressoExecutivo(tarefas: TarefaExecucao[]): number {
  const tarefasValidas = tarefas.filter((t) => t.status !== "CANCELADA");
  if (tarefasValidas.length === 0) return 0;

  let totalPontos = 0;
  let pontosConcluidos = 0;

  for (const t of tarefasValidas) {
    const prioridadeNorm = (t.prioridade || "MÉDIA").toUpperCase().trim();
    const peso = PESOS_PRIORIDADE[prioridadeNorm] || 1;
    totalPontos += peso;
    if (t.status === "CONCLUÍDA") {
      pontosConcluidos += peso;
    }
  }

  if (totalPontos === 0) return 0;
  const perc = (pontosConcluidos / totalPontos) * 100;
  // Truncado em 1 casa decimal conforme metodologia
  return Math.floor(perc * 10) / 10;
}

/**
 * Verifica se a tarefa está bloqueada.
 */
export function isTarefaBloqueada(t: TarefaExecucao): boolean {
  if (t.status === "BLOQUEADA") return true;
  if (t.status === "CONCLUÍDA" || t.status === "CANCELADA") return false;
  return Boolean(t.bloqueio && t.bloqueio.trim() !== "");
}

/**
 * Verifica se a tarefa está atrasada em relação à data informada (padrão: hoje).
 */
export function isTarefaAtrasada(t: TarefaExecucao, dataReferencia: string = diaSaoPaulo()): boolean {
  if (t.status === "CONCLUÍDA" || t.status === "CANCELADA") return false;
  if (!t.prazo || !/^\d{4}-\d{2}-\d{2}$/.test(t.prazo)) return false;
  return t.prazo < dataReferencia;
}

/**
 * Verifica se a tarefa foi concluída na data informada (padrão: hoje em Brasília; usa última atualização, não data de conclusão).
 */
export function isTarefaConcluidaHoje(t: TarefaExecucao, dataReferencia: string = diaSaoPaulo()): boolean {
  if (t.status !== "CONCLUÍDA") return false;
  if (t.atualizado_em) {
    const d = new Date(t.atualizado_em);
    if (!Number.isNaN(d.getTime()) && diaSaoPaulo(d) === dataReferencia) return true;
  }
  return false;
}

/**
 * Verifica se uma tarefa pertence ao agente especificado (por código ou nome).
 */
export function pertenceAoAgente(responsavel: string | undefined | null, agenteNome: string, agenteId: string): boolean {
  if (!responsavel) return false;
  const respNorm = responsavel.toLowerCase();
  const nomeNorm = agenteNome.toLowerCase();
  const idNorm = agenteId.toLowerCase();
  return respNorm.includes(nomeNorm) || respNorm.includes(idNorm);
}

/**
 * Determina o status visual operacional de um agente.
 */
export function determinarStatusVisualAgente(
  tarefasAgente: TarefaExecucao[],
  temDecisaoPendente: boolean = false
): StatusAgenteVisual {
  if (temDecisaoPendente) return "DECISÃO PENDENTE";
  const emExecucao = tarefasAgente.some((t) => t.status === "EM EXECUÇÃO" && !isTarefaBloqueada(t));
  if (emExecucao) return "TRABALHANDO";

  const bloqueada = tarefasAgente.some((t) => isTarefaBloqueada(t));
  if (bloqueada) return "BLOQUEADO";

  const pendente = tarefasAgente.some((t) => t.status === "NÃO INICIADA");
  if (pendente) return "AGUARDANDO";

  return "SEM TAREFA";
}

/**
 * Mapeamento estruturado das áreas dos 21 agentes.
 */
export function obterAreaAgente(agenteId: string): string {
  switch (agenteId) {
    case "AGT-01":
    case "AGT-02":
      return "Comando";
    case "AGT-03":
    case "AGT-06":
    case "AGT-11":
      return "Estratégia";
    case "AGT-04":
      return "PMO & Execução";
    case "AGT-05":
      return "Finanças";
    case "AGT-07":
    case "AGT-21":
      return "Administração & Pessoas";
    case "AGT-08":
    case "AGT-09":
      return "Tecnologia & IA";
    case "AGT-10":
    case "AGT-12":
      return "Produto & Design";
    case "AGT-13":
    case "AGT-14":
      return "Qualidade & Operações";
    case "AGT-15":
    case "AGT-16":
    case "AGT-17":
    case "AGT-18":
      return "Comercial & Growth";
    case "AGT-19":
    case "AGT-20":
      return "Atendimento & CS";
    default:
      return "Operações";
  }
}

/**
 * Extrai o indicador técnico registrado de um projeto a partir dos dados do Supabase.
 */
export function obterProgressoTecnico(projeto: any, auditorias: AuditoriaExecucao[]): string {
  if (projeto.project_id === "PRJ-0002") {
    // Audit AUD-0009 registrou baseline de 60.6% pelo Theo
    const audTecnica = auditorias.find(
      (a) => a.audit_id === "AUD-0009" || (a.agente_usuario === "Theo" && a.acao === "AUDITORIA_TECNICA")
    );
    if (audTecnica && audTecnica.valor_novo?.includes("60.6%")) {
      return "60.6%";
    }
    if (projeto.observacoes && projeto.observacoes.includes("60.6%")) {
      return "60.6%";
    }
  }
  return "Não registrado";
}

/**
 * Extrai o último diagnóstico técnico registrado.
 */
export function obterUltimoDiagnosticoTecnico(projeto: any, auditorias: AuditoriaExecucao[]): string {
  if (projeto.project_id === "PRJ-0002") {
    const aud = auditorias.find((a) => a.audit_id === "AUD-0009");
    if (aud && aud.valor_novo) {
      return aud.valor_novo;
    }
    return "Commit 6798ee7: Build, lint e tsc OK; Vitest 3597/2 falhas; deno check falha; segredos commitados (RunPod, R2/MinIO); 2 tabelas sem RLS.";
  }
  return projeto.objetivo || "Diagnóstico não registrado.";
}

/**
 * Consulta autenticada de todos os conjuntos de dados necessários para a Central de Execução.
 */
export async function carregarDadosCentralExecucao() {
  const [
    resAgentes,
    resConexoes,
    resProjetos,
    resMarcos,
    resTarefas,
    resHandoffs,
    resAuditoria,
    resMemoria,
    resRiscos,
    resDecisoes,
    resPortfolio,
  ] = await Promise.all([
    supabase.from("agentes").select("*").order("numero"),
    supabase.from("agent_connections").select("*"),
    supabase.from("projetos").select("*").order("project_id"),
    supabase.from("marcos").select("*").order("milestone_id"),
    supabase.from("tarefas").select("*").order("task_id"),
    supabase.from("handoffs").select("*").order("criado_em", { ascending: false }),
    supabase.from("auditoria").select("*").order("criado_em", { ascending: false }),
    supabase.from("memoria_mestre").select("*").order("criado_em", { ascending: false }),
    supabase.from("riscos").select("*").order("criado_em", { ascending: false }),
    supabase.from("decisoes").select("*").order("criado_em", { ascending: false }),
    supabase.from("portfolio").select("*").order("business_id"),
  ]);

  // Checagem estrita de erro de autenticação ou permissão (401, 403, 42501)
  const erros = [
    resAgentes.error,
    resConexoes.error,
    resProjetos.error,
    resMarcos.error,
    resTarefas.error,
    resHandoffs.error,
    resAuditoria.error,
    resMemoria.error,
    resRiscos.error,
    resDecisoes.error,
    resPortfolio.error,
  ].filter(Boolean);

  if (erros.length > 0) {
    const primeiroErro = erros[0]!;
    const isAuthError =
      primeiroErro.code === "42501" ||
      (primeiroErro as any).status === 401 ||
      (primeiroErro as any).status === 403 ||
      primeiroErro.message?.toLowerCase().includes("permission denied") ||
      primeiroErro.message?.toLowerCase().includes("jwt");

    return {
      sucesso: false as const,
      isAuthError,
      erroMensagem: primeiroErro.message || "Erro de permissão ou conexão com Supabase.",
      codigoErro: primeiroErro.code,
    };
  }

  return {
    sucesso: true as const,
    agentes: resAgentes.data || [],
    conexoes: resConexoes.data || [],
    projetos: resProjetos.data || [],
    marcos: resMarcos.data || [],
    tarefas: (resTarefas.data || []) as TarefaExecucao[],
    handoffs: (resHandoffs.data || []) as HandoffExecucao[],
    auditorias: (resAuditoria.data || []) as AuditoriaExecucao[],
    memoria: resMemoria.data || [],
    riscos: resRiscos.data || [],
    decisoes: resDecisoes.data || [],
    portfolio: resPortfolio.data || [],
    timestamp: new Date().toISOString(),
  };
}
