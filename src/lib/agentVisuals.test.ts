import { describe, expect, it } from "vitest";
import {
  AGENT_VISUALS,
  AREA_VISUALS,
  STATUS_VISUALS,
  getAgentVisual,
  getAreaVisual,
  statusVisualFromDb,
  type AgentStatusVisual,
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
});

describe("statusVisualFromDb", () => {
  const casos: Array<{
    nome: string;
    agent: string | null | undefined;
    conn: string | null | undefined;
    visual: AgentStatusVisual;
    rotulo: string;
  }> = [
    {
      nome: "agente DESATIVADO vence CONNECTED",
      agent: "DESATIVADO",
      conn: "CONNECTED",
      visual: "desativado",
      rotulo: "Desativado",
    },
    {
      nome: "agente PAUSADO vence CONNECTED",
      agent: "PAUSADO",
      conn: "CONNECTED",
      visual: "pausado",
      rotulo: "Pausado",
    },
    {
      nome: "ATIVO + CONNECTED",
      agent: "ATIVO",
      conn: "CONNECTED",
      visual: "conectado",
      rotulo: "Conectado",
    },
    {
      nome: "ATIVO + PLANNED",
      agent: "ATIVO",
      conn: "PLANNED",
      visual: "planejado",
      rotulo: "Planejado",
    },
    {
      nome: "ATIVO + NOT_CONNECTED",
      agent: "ATIVO",
      conn: "NOT_CONNECTED",
      visual: "nao_conectado",
      rotulo: "Não conectado",
    },
    {
      nome: "ATIVO + ERROR",
      agent: "ATIVO",
      conn: "ERROR",
      visual: "erro",
      rotulo: "Erro de conexão",
    },
    {
      nome: "sem linha em agent_connections (null)",
      agent: "ATIVO",
      conn: null,
      visual: "desconhecido",
      rotulo: "Sem registro",
    },
    {
      nome: "sem linha em agent_connections (undefined)",
      agent: "ATIVO",
      conn: undefined,
      visual: "desconhecido",
      rotulo: "Sem registro",
    },
    {
      nome: "sem connection_status (string vazia)",
      agent: "ATIVO",
      conn: "",
      visual: "desconhecido",
      rotulo: "Sem registro",
    },
  ];

  it.each(casos)("$nome → $rotulo", ({ agent, conn, visual, rotulo }) => {
    const obtido = statusVisualFromDb(agent, conn);
    expect(obtido).toBe(visual);
    expect(STATUS_VISUALS[obtido].label).toBe(rotulo);
  });

  it("sem linha em agent_connections é Sem registro e nunca Conectado", () => {
    for (const conn of [null, undefined, ""] as const) {
      const visual = statusVisualFromDb("ATIVO", conn);
      expect(visual).toBe("desconhecido");
      expect(visual).not.toBe("conectado");
      expect(STATUS_VISUALS[visual].label).toBe("Sem registro");
      expect(STATUS_VISUALS[visual].label).not.toBe("Conectado");
    }
  });
});
