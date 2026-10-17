import { describe, expect, it } from "vitest";
import { requerFundador, atribuidoA, atrasada, diaSaoPaulo, encerrada, fonteResultado, noEscopo, agruparStatus, pendenciasCadastro, temInformacao, type TarefaComando } from "./comando";

const tarefa = (extra: Partial<TarefaComando> = {}): TarefaComando => ({ task_id: "T1", tarefa: "Teste", business_id: "BIZ-002", project_id: null, responsavel: "Theo", status: "NÃO INICIADA", prioridade: "ALTA", prazo: "2026-09-25", evidencia: null, bloqueio: null, definicao_de_pronto: null, atualizado_em: null, ...extra });
describe("Indicadores da sala de comando", () => {
  it("destaca participação explícita do fundador sem tratar qualquer menção como decisão", () => {
    expect(requerFundador(tarefa({responsavel:'Fundador'}))).toBe(true);
    expect(requerFundador(tarefa({bloqueio:'DECISÃO NECESSÁRIA — FUNDADOR: escolher projeto.'}))).toBe(true);
    expect(requerFundador(tarefa({bloqueio:'O fundador já foi informado.'}))).toBe(false);
    expect(requerFundador(tarefa({responsavel:'Fundador',status:'CONCLUÍDA'}))).toBe(false);
  });
  it("não transforma placeholders em evidência nem exige entrega de tarefa cancelada", () => {
    expect(temInformacao("DADO A COLETAR")).toBe(false);
    expect(temInformacao("NÃO CONFIRMADO")).toBe(false);
    expect(temInformacao("Relatório parcial de teste")).toBe(true);
    expect(pendenciasCadastro(tarefa({status:"CONCLUÍDA",evidencia:"DADO A COLETAR"}))).toContain("Conferir a ausência de evidência no registro encerrado");
    expect(pendenciasCadastro(tarefa({status:"CANCELADA",evidencia:null})).some(p => p.includes("evidência"))).toBe(false);
  });
  it("conta participantes de uma tarefa compartilhada sem confundir IDs ou nomes", () => {
    const helena = { agent_id: "AGT-01", agente: "Helena" };
    const theo = { agent_id: "AGT-09", agente: "Theo" };
    expect(atribuidoA("Helena + AGT-09 (Theo)", helena)).toBe(true);
    expect(atribuidoA("Helena + AGT-09 (Theo)", theo)).toBe(true);
    expect(atribuidoA("AGT-010", helena)).toBe(false);
    expect(atribuidoA("Theodoro", theo)).toBe(false);
    expect(atribuidoA("AGT-17 (Theo)", theo)).toBe(false);
    expect(atribuidoA("AGT-01 / Helena", helena)).toBe(true);
  });
  it("isola a empresa e inclui apenas os escopos corporativos explícitos", () => {
    expect(noEscopo("BIZ-002", "BIZ-001")).toBe(false);
    expect(noEscopo("BIZ-001", "BIZ-001")).toBe(true);
    expect(noEscopo("GRUPO", "BIZ-001")).toBe(true);
    expect(noEscopo("Sistema", "BIZ-001")).toBe(true);
    expect(noEscopo(null, "BIZ-001")).toBe(false);
    expect(noEscopo("BIZ-002", "GRUPO")).toBe(true);
  });
  it("calcula o dia em Brasília e exclui tarefas encerradas dos atrasos", () => {
    expect(diaSaoPaulo(new Date("2026-09-26T01:30:00Z"))).toBe("2026-09-25");
    expect(diaSaoPaulo(new Date("2026-09-26T04:00:00Z"))).toBe("2026-09-26");
    expect(atrasada(tarefa(), "2026-09-25")).toBe(false);
    expect(atrasada(tarefa(), "2026-09-26")).toBe(true);
    expect(atrasada(tarefa({ status: "CANCELADA" }), "2026-09-26")).toBe(false);
    expect(atrasada(tarefa({ status: "CONCLUÍDA" }), "2026-09-26")).toBe(false);
    expect(atrasada(tarefa({ prazo: "DADO A COLETAR" }), "2026-09-26")).toBe(false);
    expect(encerrada("NÃO CONCLUÍDA")).toBe(false);
  });
  it("distingue falha, coleção visível vazia e resposta truncada", () => {
    expect(fonteResultado({ data: [], error: null, count: 0 }).estado).toBe("ok");
    expect(fonteResultado({ data: [], error: { message: "negado" }, count: null }).estado).toBe("erro");
    expect(fonteResultado({ data: [tarefa()], error: null, count: 12 }).estado).toBe("parcial");
    expect(fonteResultado({ data: null, error: null, count: null }).estado).toBe("erro");
  });
  it("não perde status desconhecidos na distribuição", () => {
    const grupos = agruparStatus([tarefa(), tarefa({status:"CONCLUÍDA"}), tarefa({status:null})]);
    expect(grupos.reduce((sum,g) => sum + g.n,0)).toBe(3);
    expect(grupos.find(g => g.id === "OUTROS")?.n).toBe(1);
  });
});
