import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import {
  AGENT_VISUALS,
  AREA_VISUALS,
  getAgentVisual,
  getAreaVisual,
  statusVisualFromDb,
} from "./agentVisuals";

describe("agentVisuals", () => {
  it("mapeia os 21 agent_id para as 7 áreas oficiais", () => {
    expect(Object.keys(AGENT_VISUALS)).toHaveLength(21);
    expect(Object.keys(AREA_VISUALS)).toHaveLength(7);
    expect(getAreaVisual("AGT-01")?.nome).toBe("Direção e Portfólio");
    expect(getAreaVisual("agt-05")?.nome).toBe("Operações e Finanças");
    expect(getAreaVisual("AGT-13")?.nome).toBe("Cliente e Qualidade");
    expect(getAreaVisual("AGT-99")).toBeUndefined();
    expect(getAgentVisual(null)).toBeUndefined();
  });

  it("não assume CONNECTED quando falta linha de conexão", () => {
    expect(statusVisualFromDb("ATIVO", null)).toBe("desconhecido");
    expect(statusVisualFromDb("ATIVO", undefined)).toBe("desconhecido");
    expect(statusVisualFromDb("ATIVO", "")).toBe("desconhecido");
  });

  it("deriva o estado visual com precedência do status do agente", () => {
    expect(statusVisualFromDb("DESATIVADO", "CONNECTED")).toBe("desativado");
    expect(statusVisualFromDb("PAUSADO", "CONNECTED")).toBe("pausado");
    expect(statusVisualFromDb("ATIVO", "CONNECTED")).toBe("conectado");
    expect(statusVisualFromDb("ATIVO", "PLANNED")).toBe("planejado");
    expect(statusVisualFromDb("ATIVO", "NOT_CONNECTED")).toBe("nao_conectado");
    expect(statusVisualFromDb("ATIVO", "ERROR")).toBe("erro");
  });
});
