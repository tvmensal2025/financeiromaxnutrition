import { normalizar, type EventoComando, type JobComando } from "@/lib/comando";

export type OrigemJob = "WHATSAPP" | "HOMOLOGACAO" | "OUTROS";
export type FaseJob = "RASCUNHO" | "FILA" | "DESPACHADO" | "ASSUMIDO" | "EM_EXECUCAO" | "REVISAO" | "ENCERRADO" | "OUTROS";

export function origemJob(job: JobComando): OrigemJob {
  if (job.correlation_id?.startsWith("HOMOLOG-GATEWAY-")) return "HOMOLOGACAO";
  // O Gateway usa este prefixo ao criar jobs a partir do webhook do WhatsApp.
  if (job.job_id.startsWith("JOB-WPP-") && normalizar(job.objective).startsWith("ATENDIMENTO WHATSAPP:")) return "WHATSAPP";
  return "OUTROS";
}

export function eventosDoJob(job: JobComando, eventos: EventoComando[]) {
  return eventos.filter(evento => evento.job_id === job.job_id && (!evento.business_id || !job.business_id || evento.business_id === job.business_id));
}

export function faseJob(job: JobComando, eventos: EventoComando[]): FaseJob {
  const status = normalizar(job.status);
  if (["COMPLETED", "FAILED", "CANCELLED", "CANCELED"].includes(status) || job.completed_at) return "ENCERRADO";
  const reviewPending = job.result_payload && typeof job.result_payload === "object" && !Array.isArray(job.result_payload) && (job.result_payload as Record<string, unknown>).review_pending === true;
  if (status === "WAITING_HELENA" && reviewPending) return "REVISAO";
  if (job.started_at || ["STARTED", "RUNNING", "IN_PROGRESS"].includes(status) || eventos.some(e => normalizar(e.event_type) === "STARTED")) return "EM_EXECUCAO";
  if (job.claimed_at || status === "CLAIMED" || eventos.some(e => normalizar(e.event_type) === "CLAIMED")) return "ASSUMIDO";
  if (eventos.some(e => normalizar(e.event_type) === "DISPATCHED")) return "DESPACHADO";
  if (status === "READY") return "FILA";
  if (status === "DRAFT") return "RASCUNHO";
  return "OUTROS";
}

type RevisaoJob = Pick<JobComando, "status" | "approval_status" | "approval_required" | "result_payload">;

export function revisaoConfirmada(job: RevisaoJob) {
  const payload = job.result_payload && typeof job.result_payload === "object" && !Array.isArray(job.result_payload)
    ? job.result_payload as Record<string, unknown> : null;
  return job.approval_required && normalizar(job.status) === "COMPLETED"
    && normalizar(job.approval_status) === "APPROVED"
    && typeof payload?.reviewed_by === "string" && !!payload.reviewed_by.trim()
    && payload.review_pending !== true;
}

export function rotuloRevisao(job: RevisaoJob) {
  if (!job.approval_required) return "Não exigida no job";
  if (revisaoConfirmada(job)) return "Aprovada";
  const payload = job.result_payload && typeof job.result_payload === "object" && !Array.isArray(job.result_payload)
    ? job.result_payload as Record<string, unknown> : null;
  if (normalizar(job.status) === "WAITING_HELENA" && payload?.review_pending === true) return "Pendente";
  if (normalizar(job.status) === "DRAFT" && typeof payload?.reviewed_by === "string") return "Ajustes solicitados";
  if (normalizar(job.status) === "COMPLETED") return "Aceite não comprovado";
  if (["PENDING", "APPROVED"].includes(normalizar(job.approval_status))) return "Pendente";
  return job.approval_status || "Sem status";
}

export type EtapaEntrega = "Na fila" | "Em produção" | "Em revisão" | "Ajustes solicitados" | "Aprovadas" | "Aceite a conferir" | "Bloqueadas";

export function etapaEntrega(job: RevisaoJob): EtapaEntrega {
  const status = normalizar(job.status);
  const payload = job.result_payload && typeof job.result_payload === "object" && !Array.isArray(job.result_payload)
    ? job.result_payload as Record<string, unknown> : null;
  if (revisaoConfirmada(job)) return "Aprovadas";
  if (status === "COMPLETED") return "Aceite a conferir";
  if (status === "WAITING_HELENA" && payload?.review_pending === true) return "Em revisão";
  if (status === "DRAFT" && typeof payload?.reviewed_by === "string" && typeof payload?.review_reason === "string") return "Ajustes solicitados";
  if (["DRAFT", "READY"].includes(status)) return "Na fila";
  if (["FAILED", "CANCELLED", "CANCELED", "WAITING_USER", "WAITING_HELENA"].includes(status)) return "Bloqueadas";
  return "Em produção";
}

export function desfechoJob(job: JobComando) {
  const status = normalizar(job.status);
  if (!["COMPLETED", "FAILED", "CANCELLED", "CANCELED"].includes(status) && !job.completed_at) return null;
  if (["FAILED", "CANCELLED", "CANCELED"].includes(status)) return "Encerrado com falha ou cancelamento";
  const resultado = normalizar(job.result_summary);
  if (origemJob(job) === "WHATSAPP" && resultado.includes("TESTE DO FUNDADOR") && resultado.includes("ENCERRADO SEM RESPOSTA AO CLIENTE")) return "Teste encerrado sem resposta ao cliente";
  if (origemJob(job) === "HOMOLOGACAO" && resultado.includes("HELENA_GATEWAY_TEST = APROVADO")) return "Teste do Gateway aprovado";
  if (revisaoConfirmada(job)) return "Entrega revisada e aprovada";
  if (status === "COMPLETED" || job.completed_at) return "Concluído no sistema; aceite não comprovado";
  return null;
}

export const rotuloFase: Record<FaseJob, string> = {
  RASCUNHO: "Rascunho", FILA: "Na fila", DESPACHADO: "Despachado", ASSUMIDO: "Assumido", EM_EXECUCAO: "Em execução", REVISAO: "Em revisão", ENCERRADO: "Encerrado", OUTROS: "Estado a conferir",
};
