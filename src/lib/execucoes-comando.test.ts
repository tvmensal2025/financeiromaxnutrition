import { describe, expect, it } from "vitest";
import { desfechoJob, etapaEntrega, faseJob, origemJob, revisaoConfirmada, rotuloRevisao } from "./execucoes-comando";
import type { EventoComando, JobComando } from "./comando";

const base: JobComando = {
  job_id: "JOB-1", task_id: null, agent_id: "AGT-20", business_id: "BIZ-001",
  objective: "Atendimento WhatsApp: mensagem", status: "READY", priority: "MEDIA", correlation_id: null,
  available_at: null, claimed_at: null, started_at: null, completed_at: null,
  attempt_count: 0, max_attempts: 3, approval_required: false, approval_status: "NOT_REQUIRED",
  result_summary: null, evidence_refs: [], error_message: null,
  created_at: "2026-09-26T01:00:00Z", updated_at: "2026-09-26T01:00:00Z",
};

describe("leitura dos jobs da sala de comando", () => {
  it("separa a entrada de WhatsApp na fila de execução comprovada", () => {
    const whatsapp = { ...base, job_id: "JOB-WPP-EXEMPLO" };
    expect(origemJob(whatsapp)).toBe("WHATSAPP");
    expect(faseJob(whatsapp, [])).toBe("FILA");
    expect(desfechoJob(whatsapp)).toBeNull();
    const despacho: EventoComando = { event_id: "E1", job_id: whatsapp.job_id, agent_id: "AGT-20", business_id: "BIZ-001", event_type: "DISPATCHED", status: null, message: null, created_at: "2026-09-26T01:01:00Z" };
    expect(faseJob(whatsapp, [despacho])).toBe("DESPACHADO");
    expect(faseJob({ ...whatsapp, started_at: "2026-09-26T01:02:00Z" }, [despacho])).toBe("EM_EXECUCAO");
  });

  it("identifica o lote de homologação e o teste do fundador encerrado sem resposta", () => {
    const homologacao = { ...base, job_id: "JOB-20260925-TESTE", objective: "Homologar conexão individual com o Helena Gateway MCP", correlation_id: "HOMOLOG-GATEWAY-ALL20-20260925", business_id: null };
    expect(origemJob(homologacao)).toBe("HOMOLOGACAO");
    expect(faseJob(homologacao, [])).toBe("FILA");
    const encerrado = { ...base, job_id: "JOB-WPP-TESTE", status: "COMPLETED", completed_at: "2026-09-26T02:00:00Z", result_summary: "TESTE DO FUNDADOR — encerrado sem resposta ao cliente" };
    expect(faseJob(encerrado, [])).toBe("ENCERRADO");
    expect(desfechoJob(encerrado)).toBe("Teste encerrado sem resposta ao cliente");
    expect(desfechoJob({ ...encerrado, result_summary: "Resposta entregue" })).toBe("Concluído no sistema; aceite não comprovado");
  });

  it("mostra aprovação apenas quando o job exige revisão e o banco a registra", () => {
    const draft = { ...base, status: "DRAFT" };
    expect(faseJob(draft, [])).toBe("RASCUNHO");
    expect(etapaEntrega(draft)).toBe("Aguardando liberação");
    expect(etapaEntrega({ ...base, status: "READY" })).toBe("Na fila");
    const emRevisao = { ...base, status: "WAITING_HELENA", approval_required: true, approval_status: "PENDING", result_payload: { review_pending: true, reviewer_agent_id: "AGT-06" } };
    expect(faseJob(emRevisao, [])).toBe("REVISAO");
    expect(faseJob({ ...emRevisao, result_payload: null }, [])).toBe("OUTROS");
    expect(rotuloRevisao({ ...emRevisao, approval_status: "APPROVED" })).toBe("Pendente");
    expect(revisaoConfirmada({ ...emRevisao, approval_status: "APPROVED" })).toBe(false);
    expect(etapaEntrega({ ...emRevisao, approval_status: "APPROVED" })).toBe("Em revisão");
    expect(etapaEntrega({ ...emRevisao, status: "DRAFT", result_payload: { review_pending: false, reviewed_by: "AGT-03", review_reason: "Faltam artes" } })).toBe("Ajustes solicitados");
    const aprovado = { ...emRevisao, status: "COMPLETED", completed_at: "2026-09-27T11:28:01Z", approval_status: "APPROVED", result_summary: "Checklist interno", result_payload: { review_pending: false, reviewed_by: "AGT-06" } };
    expect(desfechoJob(aprovado)).toBe("Entrega revisada e aprovada");
    expect(etapaEntrega(aprovado)).toBe("Aprovadas");
    expect(desfechoJob({ ...aprovado, approval_status: "PENDING" })).toBe("Concluído no sistema; aceite não comprovado");
    expect(etapaEntrega({ ...aprovado, approval_status: "PENDING" })).toBe("Aceite a conferir");
    expect(desfechoJob({ ...aprovado, result_payload: { review_pending: true } })).toBe("Concluído no sistema; aceite não comprovado");
  });
});
