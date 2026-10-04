import { describe, it, expect } from "vitest";
import {
  DEFINICOES_21_AGENTES,
  executarAgenteIndividual,
  executarCicloCompleto21Agentes,
} from "./agentes-ciclo";

describe("Homologação dos 21 Agentes do Sistema Helena", () => {
  it("contém exatamente 21 agentes cadastrados no catálogo canônico", () => {
    expect(DEFINICOES_21_AGENTES.length).toBe(21);

    // Validação de unicidade de IDs
    const ids = DEFINICOES_21_AGENTES.map((a) => a.agent_id);
    const idsUnicos = new Set(ids);
    expect(idsUnicos.size).toBe(21);

    // Validação de sequência 1 a 21
    const sequencias = DEFINICOES_21_AGENTES.map((a) => a.sequence);
    expect(sequencias).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
  });

  it("testa individualmente cada um dos 21 agentes e valida o contrato de entrega", () => {
    for (const def of DEFINICOES_21_AGENTES) {
      const resultado = executarAgenteIndividual(def.agent_id, "BIZ-003");

      // 1. Status deve ser SUCESSO
      expect(resultado.status).toBe("SUCESSO");

      // 2. Agente e cargo devem estar preenchidos
      expect(resultado.agente).toBe(def.agente);
      expect(resultado.cargo_funcao).toBe(def.cargo_funcao);

      // 3. Ação e motivo devem ter conteúdo substantivo
      expect(resultado.acao.length).toBeGreaterThan(10);
      expect(resultado.motivo.length).toBeGreaterThan(10);

      // 4. Regra contra entrega vazia: mínimo de 80 caracteres de entrega
      expect(resultado.entrega.length).toBeGreaterThanOrEqual(80);

      // 5. Evidência obrigatória: mínimo de 1 referência
      expect(resultado.evidence_refs.length).toBeGreaterThanOrEqual(1);

      // 6. Próximo passo e destinatário de handoff devem existir
      expect(resultado.proximo_passo.length).toBeGreaterThan(5);
      expect(resultado.destinatario_handoff).toMatch(/^AGT-\d{2}$/);
    }
  });

  it("executa o ciclo completo integrado dos 21 agentes com 100% de sucesso", () => {
    const ciclo = executarCicloCompleto21Agentes("BIZ-003");

    expect(ciclo.total_agentes).toBe(21);
    expect(ciclo.sucessos).toBe(21);
    expect(ciclo.falhas).toBe(0);
    expect(ciclo.resultados.length).toBe(21);

    // Verifica que o primeiro é a Helena e o último fecha o ciclo
    expect(ciclo.resultados[0].agent_id).toBe("AGT-01");
    expect(ciclo.resultados[0].agente).toBe("Helena");

    // Verifica que o último entrega para a Helena (Laura -> Helena)
    const ultimo = ciclo.resultados[20];
    expect(ultimo.agent_id).toBe("AGT-02");
    expect(ultimo.agente).toBe("Laura");
    expect(ultimo.destinatario_handoff).toBe("AGT-01");
  });
});
