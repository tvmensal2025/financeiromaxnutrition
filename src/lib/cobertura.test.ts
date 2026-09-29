import { describe, it, expect } from "vitest";
import { resumoCobertura, fonteLegivel, type AuditoriaCobertura, type FonteCobertura } from "./cobertura";
const fonte: FonteCobertura = { tabela: "tarefas", tipo: "tabela", rls: true, security_invoker: false, registros: 0, erro: null, politicas_leitura: 1, colunas: [{ nome: "id", tipo: "text", mapeado: true }] };
const base: AuditoriaCobertura = { verificado_em: "2026-09-26T12:00:00Z", campos_obsoletos: 0, checkpoint: null, divergencias_checkpoint: [], fontes: [], integridade: {} };
describe("cobertura real", () => {
  it("distingue uma tabela vazia legível de uma tabela escondida pela ausência de políticas", () => {
    expect(fonteLegivel(fonte)).toBe(true);
    expect(fonteLegivel({ ...fonte, politicas_leitura: 0 })).toBe(false);
    expect(fonteLegivel({ ...fonte, erro: "42501", registros: null })).toBe(false);
  });
  it("não arredonda uma cobertura incompleta para 100%", () => {
    const f = { ...fonte, colunas: Array.from({ length: 1479 }, (_, i) => ({ nome: String(i), tipo: "text", mapeado: i !== 1478 })) };
    expect(resumoCobertura({ ...base, fontes: [f] }).percentual).toBe(99);
  });
  it("não declara 100% quando não recebeu o catálogo", () => {
    expect(resumoCobertura(base).percentual).toBeNull();
  });
});
