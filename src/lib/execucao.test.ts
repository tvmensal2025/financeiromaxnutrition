import { describe, it, expect } from "vitest";
import {
  calcularProgressoExecutivo,
  isTarefaBloqueada,
  isTarefaAtrasada,
  isTarefaConcluidaHoje,
  pertenceAoAgente,
  determinarStatusVisualAgente,
  obterAreaAgente,
  obterProgressoTecnico,
  type TarefaExecucao,
} from "./execucao";

describe("Central de Execução — Regras e Cálculos Ponderados", () => {
  it("calcula exatamente o progresso ponderado de PRJ-0002 como 5.2% (MEM-0023 / MEM-0024)", () => {
    // 16 tarefas reais de PRJ-0002
    const tarefasPrj2: TarefaExecucao[] = [
      { task_id: "TSK-0011", business_id: "BIZ-002", tarefa: "Confirmar business_id", prioridade: "ALTA", status: "CONCLUÍDA", responsavel: "Fundador" },
      { task_id: "TSK-0012", business_id: "BIZ-002", tarefa: "Rotacionar segredos", prioridade: "CRÍTICA", status: "NÃO INICIADA", responsavel: "Fundador", bloqueio: "Painéis" },
      { task_id: "TSK-0013", business_id: "BIZ-002", tarefa: "Remover segredos git", prioridade: "CRÍTICA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0014", business_id: "BIZ-002", tarefa: "Definir projeto oficial", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0015", business_id: "BIZ-002", tarefa: "Criar .env.example", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0016", business_id: "BIZ-002", tarefa: "Resolver trabalho local", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "Fundador" },
      { task_id: "TSK-0017", business_id: "BIZ-002", tarefa: "Habilitar RLS", prioridade: "CRÍTICA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0018", business_id: "BIZ-002", tarefa: "Corrigir deno check", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0019", business_id: "BIZ-002", tarefa: "Sanear npm audit", prioridade: "CRÍTICA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0020", business_id: "BIZ-002", tarefa: "Restringir CORS", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0021", business_id: "BIZ-002", tarefa: "AuthGuard no router", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0022", business_id: "BIZ-002", tarefa: "Zerar falhas vitest", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0023", business_id: "BIZ-002", tarefa: "Credenciais staging", prioridade: "CRÍTICA", status: "NÃO INICIADA", responsavel: "AGT-13 (Bruno)" },
      { task_id: "TSK-0024", business_id: "BIZ-002", tarefa: "Testes vps-backend", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
      { task_id: "TSK-0025", business_id: "BIZ-002", tarefa: "Runbook deploy", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "AGT-14 (Olívia)" },
      { task_id: "TSK-0026", business_id: "BIZ-002", tarefa: "Reduzir dívida técnica", prioridade: "MÉDIA", status: "NÃO INICIADA", responsavel: "AGT-09 (Theo)" },
    ];

    // Total de pontos: 3 + 5 + 5 + 3 + 3 + 3 + 5 + 3 + 5 + 3 + 3 + 3 + 5 + 3 + 3 + 2 = 57 pontos
    // Concluída: TSK-0011 = 3 pontos
    // Progresso: 3 / 57 = 5.26% -> 5.2%
    const progresso = calcularProgressoExecutivo(tarefasPrj2);
    expect(progresso).toBe(5.2);
  });

  it("exclui tarefas canceladas do denominador de cálculo ponderado", () => {
    const tarefas: TarefaExecucao[] = [
      { task_id: "T1", business_id: "BIZ-001", tarefa: "A", prioridade: "CRÍTICA", status: "CONCLUÍDA", responsavel: "Theo" }, // 5 pts
      { task_id: "T2", business_id: "BIZ-001", tarefa: "B", prioridade: "CRÍTICA", status: "NÃO INICIADA", responsavel: "Theo" }, // 5 pts
      { task_id: "T3", business_id: "BIZ-001", tarefa: "C", prioridade: "ALTA", status: "CANCELADA", responsavel: "Theo" }, // excluída
    ];
    // 5 de 10 = 50.0%
    expect(calcularProgressoExecutivo(tarefas)).toBe(50);
  });

  it("identifica tarefas bloqueadas corretamente", () => {
    const tBloq1: TarefaExecucao = { task_id: "T1", business_id: "BIZ-001", tarefa: "A", prioridade: "ALTA", status: "BLOQUEADA", responsavel: "Theo" };
    const tBloq2: TarefaExecucao = { task_id: "T2", business_id: "BIZ-001", tarefa: "B", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "Theo", bloqueio: "Depende do fundador" };
    const tLivre: TarefaExecucao = { task_id: "T3", business_id: "BIZ-001", tarefa: "C", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "Theo" };
    const tConcluida: TarefaExecucao = { task_id: "T4", business_id: "BIZ-001", tarefa: "D", prioridade: "ALTA", status: "CONCLUÍDA", responsavel: "Theo", bloqueio: "Resolvido anteriormente" };

    expect(isTarefaBloqueada(tBloq1)).toBe(true);
    expect(isTarefaBloqueada(tBloq2)).toBe(true);
    expect(isTarefaBloqueada(tLivre)).toBe(false);
    expect(isTarefaBloqueada(tConcluida)).toBe(false);
  });

  it("identifica tarefas atrasadas em relação à data", () => {
    const atrasada: TarefaExecucao = { task_id: "T1", business_id: "BIZ-001", tarefa: "A", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "Theo", prazo: "2026-09-24" };
    const emDia: TarefaExecucao = { task_id: "T2", business_id: "BIZ-001", tarefa: "B", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "Theo", prazo: "2026-09-28" };
    const concluidaPassada: TarefaExecucao = { task_id: "T3", business_id: "BIZ-001", tarefa: "C", prioridade: "ALTA", status: "CONCLUÍDA", responsavel: "Theo", prazo: "2026-09-22" };

    expect(isTarefaAtrasada(atrasada, "2026-09-25")).toBe(true);
    expect(isTarefaAtrasada(emDia, "2026-09-25")).toBe(false);
    expect(isTarefaAtrasada(concluidaPassada, "2026-09-25")).toBe(false);
  });

  it("vincula tarefas ao agente por código e nome", () => {
    expect(pertenceAoAgente("AGT-09 (Theo)", "Theo", "AGT-09")).toBe(true);
    expect(pertenceAoAgente("Theo + Daniel", "Theo", "AGT-09")).toBe(true);
    expect(pertenceAoAgente("Helena + Victor + Daniel", "Helena", "AGT-01")).toBe(true);
    expect(pertenceAoAgente("AGT-04 (Marina)", "Theo", "AGT-09")).toBe(false);
  });

  it("determina status visual do agente sem dedução arbitrária", () => {
    const tarefasTrabalhando: TarefaExecucao[] = [
      { task_id: "T1", business_id: "BIZ-001", tarefa: "A", prioridade: "ALTA", status: "EM EXECUÇÃO", responsavel: "Theo" }
    ];
    expect(determinarStatusVisualAgente(tarefasTrabalhando)).toBe("TRABALHANDO");

    const tarefasBloqueadas: TarefaExecucao[] = [
      { task_id: "T1", business_id: "BIZ-001", tarefa: "A", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "Theo", bloqueio: "Depende do fundador" }
    ];
    expect(determinarStatusVisualAgente(tarefasBloqueadas)).toBe("BLOQUEADO");

    const execucaoBloqueada: TarefaExecucao[] = [
      { task_id: "T2", business_id: "BIZ-003", tarefa: "Revisão", prioridade: "ALTA", status: "EM EXECUÇÃO", responsavel: "Camila", bloqueio: "Aguardando revisão" }
    ];
    expect(determinarStatusVisualAgente(execucaoBloqueada)).toBe("BLOQUEADO");

    const tarefasAguardando: TarefaExecucao[] = [
      { task_id: "T1", business_id: "BIZ-001", tarefa: "A", prioridade: "ALTA", status: "NÃO INICIADA", responsavel: "Theo" }
    ];
    expect(determinarStatusVisualAgente(tarefasAguardando)).toBe("AGUARDANDO");

    expect(determinarStatusVisualAgente([], true)).toBe("DECISÃO PENDENTE");
    expect(determinarStatusVisualAgente([])).toBe("SEM TAREFA");
  });

  it("recupera o progresso técnico registrado de PRJ-0002 como 60.6% e Não registrado para outros", () => {
    const auds = [
      { audit_id: "AUD-0009", data_hora: "2026-09-25", agente_usuario: "Theo", acao: "AUDITORIA_TECNICA", valor_novo: "PERCENTUAL TÉCNICO 60.6%" }
    ];
    const prj2 = { project_id: "PRJ-0002" };
    const prj1 = { project_id: "PRJ-0001" };

    expect(obterProgressoTecnico(prj2, auds)).toBe("60.6%");
    expect(obterProgressoTecnico(prj1, auds)).toBe("Não registrado");
  });

  it("mapeia as áreas funcionais dos 21 agentes", () => {
    expect(obterAreaAgente("AGT-01")).toBe("Comando");
    expect(obterAreaAgente("AGT-04")).toBe("PMO & Execução");
    expect(obterAreaAgente("AGT-09")).toBe("Tecnologia & IA");
    expect(obterAreaAgente("AGT-13")).toBe("Qualidade & Operações");
  });
});
