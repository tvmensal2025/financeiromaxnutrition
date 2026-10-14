import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

type Resposta = { data: unknown[] | null; error: { message: string } | null };
const mocks = vi.hoisted(() => ({
  contexto: { currentBusinessId: "BIZ-003", isConsolidated: false, selecionadas: ["BIZ-003"], currentBusiness: { nome: "Empresa Três" } },
  responder: vi.fn<(tabela: string, empresa: string | null) => Promise<{ data: unknown[] | null; error: { message: string } | null }>>(),
}));

vi.mock("@/contexts/BusinessContext", () => ({ useBusiness: () => mocks.contexto }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (tabela: string) => ({
      select: () => {
        let empresa: string | null = null;
        const consulta = {
          eq: (_coluna: string, valor: string) => { empresa = valor; return consulta; },
          order: () => consulta,
          then: (resolve: (resposta: Resposta) => void, reject: (erro: unknown) => void) =>
            mocks.responder(tabela, empresa).then(resolve, reject),
        };
        return consulta;
      },
    }),
  },
}));

import Painel from "./Painel";
import { diaSaoPaulo } from "@/lib/comando";

function abrir() {
  return render(<MemoryRouter><Painel /></MemoryRouter>);
}

describe("Painel", () => {
  beforeEach(() => {
    mocks.contexto.currentBusinessId = "BIZ-003";
    mocks.contexto.isConsolidated = false;
    mocks.contexto.selecionadas = ["BIZ-003"];
    mocks.contexto.currentBusiness = { nome: "Empresa Três" };
    mocks.responder.mockReset();
    mocks.responder.mockResolvedValue({ data: [], error: null });
  });

  it("não inventa foco, riscos, empresa nem valores quando as fontes estão vazias", async () => {
    abrir();
    expect(await screen.findByText("Nenhum foco em execução foi encontrado na consulta.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum risco em aberto foi encontrado na consulta.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum registro desta empresa foi encontrado no portfólio consultado.")).toBeInTheDocument();
    expect(screen.getByText(/Números essenciais · BIZ-003/)).toBeInTheDocument();
    expect(screen.queryByText(/Empresa Três/)).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.queryByText(/FOC-004|iGreen|20\/20|Homologação técnica/i)).not.toBeInTheDocument();
    expect(mocks.responder).toHaveBeenCalledWith("crm", "BIZ-003");
    expect(mocks.responder).toHaveBeenCalledWith("financeiro", "BIZ-003");
    expect(mocks.responder).toHaveBeenCalledWith("riscos", "BIZ-003");
    expect(mocks.responder).toHaveBeenCalledWith("portfolio", "BIZ-003");
  });

  it("mostra erro da consulta e não dados antigos ou zero", async () => {
    mocks.responder.mockImplementation(async (tabela) =>
      tabela === "financeiro" ? { data: null, error: { message: "offline" } } : { data: [], error: null });
    abrir();
    expect(await screen.findByText("Não foi possível consultar os dados agora. Tente novamente.")).toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(screen.queryByText(/Foco executivo do grupo/)).not.toBeInTheDocument();
  });

  it("usa somente os registros consultados da empresa escolhida", async () => {
    mocks.responder.mockImplementation(async (tabela, empresa) => {
      if (empresa !== "BIZ-003") return { data: [], error: null };
      if (tabela === "portfolio") return { data: [{ business_id: "BIZ-003", negocio: "Empresa consultada", principal_gargalo: "Ativação verificada", objetivo_atual: null, kpi_principal: null }], error: null };
      if (tabela === "crm") return { data: [{ business_id: "BIZ-003", etapa: "PROPOSTA", status: "ABERTO", valor_potencial: 1200, moeda: "BRL", probabilidade: null }, { business_id: "BIZ-001", etapa: "PROPOSTA", status: "ABERTO", valor_potencial: 999999, moeda: "BRL", probabilidade: 100 }], error: null };
      if (tabela === "riscos") return { data: [{ risk_id: "RIS-3", business_id: "BIZ-003", risco: "Prazo externo", impacto: "ALTO", status: "ABERTO" }, { risk_id: "RIS-1", business_id: "BIZ-001", risco: "Risco de outra empresa", status: "ABERTO" }], error: null };
      return { data: [], error: null };
    });
    abrir();
    expect(await screen.findByText("Ativação verificada")).toBeInTheDocument();
    expect(screen.getByText(/Números essenciais · Empresa consultada/)).toBeInTheDocument();
    expect(screen.getByText("Prazo externo")).toBeInTheDocument();
    expect(screen.getByText(/1\.200,00/)).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText(/999\.999,00|Risco de outra empresa/)).not.toBeInTheDocument();
    expect(screen.queryByText(/iGreen|Aquisição Comercial/)).not.toBeInTheDocument();
  });

  it("consolidado não assume BIZ-001 como portfólio ou empresa", async () => {
    mocks.contexto.isConsolidated = true;
    mocks.contexto.selecionadas = ["BIZ-003"];
    mocks.responder.mockImplementation(async (tabela) => {
      if (tabela === "portfolio") return { data: [{ business_id: "BIZ-003" }, { business_id: "BIZ-001" }], error: null };
      if (tabela === "riscos") return { data: [{ risk_id: "R3", business_id: "BIZ-003", risco: "Risco selecionado", status: "ABERTO" }, { risk_id: "R1", business_id: "BIZ-001", risco: "Risco não selecionado", status: "ABERTO" }], error: null };
      return { data: [], error: null };
    });
    const vista = abrir();
    expect(await screen.findByText(/1 empresa retornada na consulta/)).toBeInTheDocument();
    expect(screen.getByText("Risco selecionado")).toBeInTheDocument();
    expect(screen.queryByText("Risco não selecionado")).not.toBeInTheDocument();
    expect(screen.getByText(/Números essenciais · Grupo consolidado/)).toBeInTheDocument();
    expect(mocks.responder).toHaveBeenCalledWith("portfolio", null);
    expect(mocks.responder).toHaveBeenCalledWith("crm", null);
    mocks.contexto.selecionadas = ["BIZ-001"];
    vista.rerender(<MemoryRouter><Painel /></MemoryRouter>);
    expect(await screen.findByText("Risco não selecionado")).toBeInTheDocument();
    expect(screen.queryByText("Risco selecionado")).not.toBeInTheDocument();
  });

  it("não rotula USD sem conversão como reais nem inventa probabilidade", async () => {
    mocks.responder.mockImplementation(async (tabela) => {
      if (tabela === "financeiro") return { data: [{ business_id: "BIZ-003", status: "RECEBIDO", fluxo: "entrada", valor_original: 1, moeda: "USD", liquidacao: diaSaoPaulo() }], error: null };
      if (tabela === "crm") return { data: [{ business_id: "BIZ-003", etapa: "PROPOSTA", status: "ABERTO", valor_potencial: 1, moeda: "USD", probabilidade: null }], error: null };
      return { data: [], error: null };
    });
    abrir();
    expect(await screen.findByText("Nenhum foco em execução foi encontrado na consulta.")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.queryByText(/R\$\s*1,00/)).not.toBeInTheDocument();
  });

  it("aceita BRL explícito, fluxo minúsculo e número decimal brasileiro no mês de São Paulo", async () => {
    mocks.responder.mockImplementation(async (tabela) =>
      tabela === "financeiro"
        ? { data: [{ business_id: "BIZ-003", status: "RECEBIDO", fluxo: "entrada", valor_original: "1.234,56", moeda: "BRL", liquidacao: diaSaoPaulo() }], error: null }
        : { data: [], error: null });
    abrir();
    expect(await screen.findByText("Nenhum foco em execução foi encontrado na consulta.")).toBeInTheDocument();
    expect(screen.getAllByText(/1\.234,56/)).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("exclui CRM sem estado aberto reconhecido, arquivado e estados contraditórios", async () => {
    const oportunidade = (etapa: string | null, status: string | null, valor: number) => ({ business_id: "BIZ-003", etapa, status, valor_potencial: valor, moeda: "BRL", probabilidade: 50 });
    mocks.responder.mockImplementation(async (tabela) => tabela === "crm" ? {
      data: [
        oportunidade("PROPOSTA", "ATIVO", 100),
        oportunidade("PROPOSTA", null, 900),
        oportunidade("PROPOSTA", "ARQUIVADO", 900),
        oportunidade("GANHO", "ATIVO", 900),
        oportunidade("PROPOSTA", "GANHO", 900),
        oportunidade(null, "ABERTO", 900),
      ], error: null,
    } : { data: [], error: null });
    abrir();
    expect(await screen.findByText(/1 oportunidade com etapa e status abertos reconhecidos/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*100,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*50,00/)).toBeInTheDocument();
    expect(screen.queryByText(/3\.700,00|ARQUIVADO/)).not.toBeInTheDocument();
  });

  it("deixa o pipeline indisponível quando só há estado desconhecido", async () => {
    mocks.responder.mockImplementation(async (tabela) => tabela === "crm" ? {
      data: [{ business_id: "BIZ-003", etapa: null, status: null, valor_potencial: 450, moeda: "BRL", probabilidade: 80 }], error: null,
    } : { data: [], error: null });
    abrir();
    expect(await screen.findByText("Nenhuma oportunidade com etapa e status abertos reconhecidos.")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("mostra somente riscos com status ABERTO confirmado", async () => {
    mocks.responder.mockImplementation(async (tabela) => tabela === "riscos" ? {
      data: [
        { risk_id: "R1", business_id: "BIZ-003", risco: "Aberto confirmado", status: "ABERTO" },
        { risk_id: "R2", business_id: "BIZ-003", risco: "Sem status", status: null },
        { risk_id: "R3", business_id: "BIZ-003", risco: "Estado desconhecido", status: "DESCONHECIDO" },
        { risk_id: "R4", business_id: "BIZ-003", risco: "Arquivado", status: "ARQUIVADO" },
      ], error: null,
    } : { data: [], error: null });
    abrir();
    expect(await screen.findByText("Aberto confirmado")).toBeInTheDocument();
    expect(screen.queryByText("Sem status")).not.toBeInTheDocument();
    expect(screen.queryByText("Estado desconhecido")).not.toBeInTheDocument();
    expect(screen.queryByText("Arquivado")).not.toBeInTheDocument();
  });

  it("descarta a resposta atrasada da empresa anterior", async () => {
    let liberar!: (resposta: Resposta) => void;
    mocks.responder.mockImplementation((tabela, empresa) => {
      if (tabela === "portfolio" && empresa === "BIZ-003") return new Promise<Resposta>((resolve) => { liberar = resolve; });
      if (tabela === "portfolio" && empresa === "BIZ-002") return Promise.resolve({ data: [{ business_id: "BIZ-002", principal_gargalo: "Novo contexto" }], error: null });
      return Promise.resolve({ data: [], error: null });
    });
    const vista = abrir();
    await waitFor(() => expect(liberar).toBeDefined());
    mocks.contexto.currentBusinessId = "BIZ-002";
    mocks.contexto.currentBusiness = { nome: "Empresa Dois" };
    vista.rerender(<MemoryRouter><Painel /></MemoryRouter>);
    expect(await screen.findByText("Novo contexto")).toBeInTheDocument();
    liberar({ data: [{ business_id: "BIZ-003", principal_gargalo: "Contexto antigo" }], error: null });
    await waitFor(() => expect(screen.queryByText("Contexto antigo")).not.toBeInTheDocument());
    expect(screen.getByText("Novo contexto")).toBeInTheDocument();
  });
});
