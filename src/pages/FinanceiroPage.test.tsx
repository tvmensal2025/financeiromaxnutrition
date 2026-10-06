import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  write: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("@/lib/escrita-protegida", () => ({
  escreverRegistro: (...args: unknown[]) => mocks.write(...args),
}));

vi.mock("@/contexts/BusinessContext", () => ({
  useBusiness: () => ({
    currentBusinessId: "BIZ-001",
    isConsolidated: false,
    selecionadas: ["BIZ-001"],
    todasLigadas: false,
    nomeDe: (id: string) => (id === "BIZ-001" ? "iGreen Energy" : id),
    empresas: [
      { id: "BIZ-001", business_id: "BIZ-001", nome: "iGreen Energy", sigla: "iGreen" },
      { id: "BIZ-002", business_id: "BIZ-002", nome: "Saúde & Nutrição", sigla: "Saúde" },
    ],
  }),
}));

import FinanceiroPage from "./FinanceiroPage";

describe("FinanceiroPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.from.mockImplementation((tabela: string) => {
      if (tabela === "financeiro") {
        return {
          select: () => ({
            order: () => ({
              limit: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        finance_id: "FIN-001",
                        business_id: "BIZ-001",
                        descricao: "Venda Licença Software",
                        contraparte: "Cliente Alpha",
                        conta_id: "CONTA-INTER",
                        fluxo: "ENTRADA",
                        status: "RECEBIDO",
                        competencia: "2026-10",
                        vencimento: "2026-10-02",
                        liquidacao: "2026-10-02",
                        valor_original: 5000,
                        row_version: 1,
                      },
                      {
                        finance_id: "FIN-002",
                        business_id: "BIZ-001",
                        descricao: "Servidores Cloud",
                        contraparte: "Provedor Cloud",
                        conta_id: "CONTA-INTER",
                        fluxo: "SAÍDA",
                        status: "PAGO",
                        competencia: "2026-10",
                        vencimento: "2026-10-03",
                        liquidacao: "2026-10-03",
                        valor_original: 1200,
                        row_version: 1,
                      },
                      {
                        finance_id: "FIN-003",
                        business_id: "BIZ-001",
                        descricao: "Consultoria Jurídica",
                        contraparte: "Escritório Advocacia",
                        conta_id: "CONTA-INTER",
                        fluxo: "SAÍDA",
                        status: "ABERTO",
                        competencia: "2026-10",
                        vencimento: "2026-10-25",
                        valor_original: 800,
                        row_version: 1,
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }

      if (tabela === "fluxo_caixa") {
        return {
          select: () => ({
            order: () => ({
              limit: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        periodo_inicio: "2026-10-01",
                        periodo_fim: "2026-10-31",
                        entradas_liquidadas_brl: 5000,
                        saidas_liquidadas_brl: 1200,
                        fluxo_liquido_brl: 3800,
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }

      if (tabela === "orcamento") {
        return {
          select: () => ({
            order: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      budget_id: "BDG-001",
                      business_id: "BIZ-001",
                      periodo_inicio: "2026-10-01",
                      periodo_fim: "2026-10-31",
                      plano_conta_id: "Infraestrutura",
                      valor_orcado_brl: 2000,
                      valor_realizado_brl: 1200,
                      responsavel: "AGT-05 Caio",
                      status: "ATIVO",
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }

      if (tabela === "contas_financeiras") {
        return {
          select: () => ({
            order: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      conta_id: "CONTA-INTER",
                      business_id: "BIZ-001",
                      nome: "Banco Inter PJ",
                      instituicao: "Inter",
                      saldo_atual: 25400,
                      ativa: "SIM",
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }

      // Default para recorrencias e plano_contas
      return {
        select: () => ({
          order: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
            then: (resolve: any) => resolve({ data: [], error: null }),
          }),
        }),
      };
    });
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <FinanceiroPage />
      </MemoryRouter>
    );
  }

  it("renderiza o Cockpit Financeiro com os 6 cards de métricas", async () => {
    renderPage();

    expect(await screen.findByText("Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Caixa realizado")).toBeInTheDocument();
    expect(screen.getByText("Entradas")).toBeInTheDocument();
    expect(screen.getByText("Saídas")).toBeInTheDocument();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
    expect(screen.getByText("A receber")).toBeInTheDocument();
    expect(screen.getByText("A pagar")).toBeInTheDocument();

    // Saldo de caixa apurado e fluxo líquido: 5000 (RECEBIDO) - 1200 (PAGO) = 3800
    expect(screen.getAllByText(/3\.800,00/).length).toBeGreaterThanOrEqual(1);
  });

  it("permite navegar para a aba Lançamentos e exibe a tabela analítica", async () => {
    renderPage();

    const abaLancamentos = await screen.findByRole("button", { name: "Lançamentos" });
    fireEvent.click(abaLancamentos);

    expect(await screen.findByText("Venda Licença Software")).toBeInTheDocument();
    expect(screen.getByText("Servidores Cloud")).toBeInTheDocument();
    expect(screen.getByText("Consultoria Jurídica")).toBeInTheDocument();
  });

  it("filtra lançamentos por busca textual", async () => {
    renderPage();

    const abaLancamentos = await screen.findByRole("button", { name: "Lançamentos" });
    fireEvent.click(abaLancamentos);

    const inputBusca = await screen.findByPlaceholderText(/Buscar por descrição/i);
    fireEvent.change(inputBusca, { target: { value: "Cloud" } });

    expect(screen.getByText("Servidores Cloud")).toBeInTheDocument();
    expect(screen.queryByText("Venda Licença Software")).not.toBeInTheDocument();
  });

  it("abre o modal de Novo Lançamento ao clicar no botão de ação", async () => {
    renderPage();

    // Há dois botões de "Novo Lançamento" (um no header e outro na barra de filtros)
    const botoes = await screen.findAllByRole("button", { name: /Novo Lançamento/i });
    fireEvent.click(botoes[0]);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Novo Lançamento Financeiro")).toBeInTheDocument();
    expect(screen.getByLabelText(/Descrição do Lançamento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor Original/i)).toBeInTheDocument();

    // Fecha o modal
    const botaoCancelar = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(botaoCancelar);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("permite navegar para a aba de Orçamento e exibe as metas planejadas", async () => {
    renderPage();

    const abaOrcamento = await screen.findByRole("button", { name: "Orçamento" });
    fireEvent.click(abaOrcamento);

    expect(await screen.findByText("Planejamento Orçamentário")).toBeInTheDocument();
    expect(screen.getByText("Infraestrutura")).toBeInTheDocument();
    expect(screen.getByText("AGT-05 Caio")).toBeInTheDocument();
  });

  it("permite navegar para a aba de Contas Bancárias e exibe os saldos", async () => {
    renderPage();

    const abaContas = await screen.findByRole("button", { name: "Contas Bancárias" });
    fireEvent.click(abaContas);

    expect(await screen.findByText("Banco Inter PJ")).toBeInTheDocument();
    expect(screen.getByText("R$ 25.400,00")).toBeInTheDocument();
  });
});
