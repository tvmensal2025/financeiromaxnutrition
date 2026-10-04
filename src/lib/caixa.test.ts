import { describe, it, expect } from "vitest";
import { lerCaixa, lerDre, lerDreMes, variacaoPercentual, type Lancamento } from "./caixa";

describe("Motor de Cálculo Financeiro (caixa.ts)", () => {
  const mockLancamentos: Lancamento[] = [
    {
      business_id: "BIZ-001",
      fluxo: "ENTRADA",
      status: "RECEBIDO",
      moeda: "BRL",
      valor_original: 5000,
      conta_id: "CONTA-01",
      competencia: "2026-10",
      liquidacao: "2026-10-02",
    },
    {
      business_id: "BIZ-001",
      fluxo: "SAÍDA",
      status: "PAGO",
      moeda: "BRL",
      valor_original: 1500,
      conta_id: "CONTA-01",
      competencia: "2026-10",
      liquidacao: "2026-10-03",
    },
    {
      business_id: "BIZ-001",
      fluxo: "ENTRADA",
      status: "ABERTO", // Fora de caixa
      moeda: "BRL",
      valor_original: 2000,
      conta_id: "CONTA-01",
      competencia: "2026-10",
    },
    {
      business_id: "BIZ-001",
      fluxo: "SAÍDA",
      status: "CANCELADO", // Fora de caixa e fora de DRE
      moeda: "BRL",
      valor_original: 800,
      conta_id: "CONTA-01",
      competencia: "2026-10",
    },
    {
      business_id: "BIZ-001",
      fluxo: "TRANSFERÊNCIA", // Não altera saldo líquido
      status: "PAGO",
      moeda: "BRL",
      valor_original: 1000,
      conta_id: "CONTA-01",
      conta_destino_id: "CONTA-02",
      competencia: "2026-10",
    },
    {
      business_id: "BIZ-002",
      fluxo: "ENTRADA",
      status: "RECEBIDO",
      moeda: "BRL",
      valor_original: 10000,
      conta_id: "CONTA-03",
      competencia: "2026-10",
      liquidacao: "2026-10-01",
    },
    {
      business_id: "BIZ-001",
      fluxo: "SAÍDA",
      status: "PARCIAL",
      moeda: "BRL",
      valor_original: 1000,
      valor_liquidado_informado_brl: 400,
      conta_id: "CONTA-01",
      competencia: "2026-10",
      liquidacao: "2026-10-04",
    },
    {
      business_id: "BIZ-001",
      fluxo: "ENTRADA",
      status: "RECEBIDO",
      moeda: "USD", // Moeda estrangeira sem conversão fica fora do caixa em BRL
      valor_original: 500,
      conta_id: "CONTA-01",
      competencia: "2026-10",
    },
  ];

  describe("lerCaixa", () => {
    it("calcula saldo de caixa apenas com lançamentos liquidados em BRL da empresa", () => {
      // BIZ-001:
      // + 5000 (RECEBIDO)
      // - 1500 (PAGO)
      // - 400 (PARCIAL liquidado)
      // = 3100
      const resultado = lerCaixa(mockLancamentos, "BIZ-001");
      expect(resultado.saldo).toBe(3100);
      expect(resultado.usados).toBe(3);
      expect(resultado.vazio).toBe(false);
      expect(resultado.motivos).toContain("Lançamento em outra moeda fica fora do caixa em BRL até a taxa existir.");
    });

    it("respeita filtro multiempresa consolidado", () => {
      // BIZ-001 (3100) + BIZ-002 (10000) = 13100
      const consolidado = lerCaixa(mockLancamentos, ["BIZ-001", "BIZ-002"]);
      expect(consolidado.saldo).toBe(13100);
      expect(consolidado.usados).toBe(4);
    });

    it("retorna vazio quando não há registros elegíveis", () => {
      const resultado = lerCaixa([], "BIZ-001");
      expect(resultado.saldo).toBe(0);
      expect(resultado.usados).toBe(0);
      expect(resultado.vazio).toBe(true);
    });
  });

  describe("lerDre e lerDreMes", () => {
    it("apura DRE pelo regime de competência incluindo valores abertos e excluindo cancelados", () => {
      // BIZ-001 competência 2026-10:
      // Entradas: 5000 (recebido) + 2000 (aberto) = 7000
      // Saídas: 1500 (pago) + 1000 (parcial usa valor_original) = 2500
      // Resultado: 7000 - 2500 = 4500
      const dre = lerDre(mockLancamentos, "BIZ-001");
      expect(dre.entradas).toBe(7000);
      expect(dre.saidas).toBe(2500);
      expect(dre.resultado).toBe(4500);
      expect(dre.vazio).toBe(false);
    });

    it("filtra corretamente por mês específico com lerDreMes", () => {
      const dreMes = lerDreMes(mockLancamentos, "2026-10", "BIZ-001");
      expect(dreMes.resultado).toBe(4500);

      const dreOutroMes = lerDreMes(mockLancamentos, "2026-09", "BIZ-001");
      expect(dreOutroMes.vazio).toBe(true);
      expect(dreOutroMes.resultado).toBe(0);
    });
  });

  describe("variacaoPercentual", () => {
    it("calcula variação percentual corretamente", () => {
      expect(variacaoPercentual(120, 100)).toBe(20);
      expect(variacaoPercentual(80, 100)).toBe(-20);
      expect(variacaoPercentual(100, 0)).toBeUndefined();
    });
  });
});
