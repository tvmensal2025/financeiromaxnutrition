import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "@testing-library/jest-dom/vitest";
import {
  areaDoAgente,
  mesclarAgenteComConexao,
  statusVisualDoAgente,
  type AgenteRow,
} from "@/lib/equipe";

const helena: AgenteRow = {
  agent_id: "AGT-01",
  agente: "Helena",
  cargo_funcao: "CEO Virtual / Central de Comando",
  status: "ATIVO",
};

const caio: AgenteRow = {
  agent_id: "AGT-05",
  agente: "Caio",
  cargo_funcao: "Finanças / CFO",
  status: "ATIVO",
};

describe("Equipe — mescla de dados", () => {
  it("usa área do mapa visual por agent_id, não pelo cargo", () => {
    expect(areaDoAgente("AGT-01")).toBe("Direção e Portfólio");
    expect(areaDoAgente("AGT-05")).toBe("Operações e Finanças");
    expect(areaDoAgente("AGT-13")).toBe("Cliente e Qualidade");
    expect(areaDoAgente("AGT-99")).toBe("Área não mapeada");
  });

  it("não assume CONNECTED quando não há linha em agent_connections", () => {
    const semConexao = mesclarAgenteComConexao(helena);
    expect(semConexao.connection_status).toBeNull();
    expect(semConexao.provider).toBeNull();
    expect(statusVisualDoAgente(semConexao)).toBe("desconhecido");
  });

  it("preserva o cargo vindo do banco e não inventa o nome do fundador", () => {
    const comConexao = mesclarAgenteComConexao(helena, {
      agent_id: "AGT-01",
      provider: "CHATGPT",
      connection_status: "CONNECTED",
    });
    expect(comConexao.cargo_funcao).toBe("CEO Virtual / Central de Comando");
    expect(comConexao.escala_para).toBe("Fundador");
    expect(comConexao.escala_para).not.toMatch(/Victor/i);
    expect(JSON.stringify(comConexao)).not.toMatch(/Chief of Staff/);
    expect(statusVisualDoAgente(comConexao)).toBe("conectado");
  });

  it("mantém nome, cargo e código exatamente como vieram da linha de agentes", () => {
    const mesclado = mesclarAgenteComConexao(caio, {
      agent_id: "AGT-05",
      provider: "GROK",
      connection_status: "PLANNED",
    });
    expect(mesclado.agente).toBe("Caio");
    expect(mesclado.cargo_funcao).toBe("Finanças / CFO");
    expect(mesclado.agent_id).toBe("AGT-05");
    expect(mesclado.connection_status).toBe("PLANNED");
    expect(statusVisualDoAgente(mesclado)).toBe("planejado");
  });

  it("não usa src/lib/agentes.json como fonte na Equipe", () => {
    const pagina = readFileSync(resolve(__dirname, "../pages/EquipePage.tsx"), "utf8");
    const mescla = readFileSync(resolve(__dirname, "./equipe.ts"), "utf8");
    expect(pagina).not.toMatch(/agentes\.json/);
    expect(mescla).not.toMatch(/agentes\.json/);
  });
});
