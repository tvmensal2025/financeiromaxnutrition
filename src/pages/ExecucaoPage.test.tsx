import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mock = vi.hoisted(() => ({
  carregar: vi.fn(),
  empresa: "GRUPO",
}));

vi.mock("@/lib/execucao", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/execucao")>()),
  carregarDadosCentralExecucao: mock.carregar,
}));
vi.mock("@/contexts/BusinessContext", () => ({
  useBusiness: () => ({
    currentBusinessId: mock.empresa,
    isConsolidated: mock.empresa === "GRUPO",
    setCurrentBusiness: vi.fn(),
    empresas: [],
  }),
}));

import ExecucaoPage from "./ExecucaoPage";

function dados(overrides: Record<string, unknown> = {}) {
  return {
    sucesso: true,
    agentes: [], conexoes: [], projetos: [], marcos: [], tarefas: [], handoffs: [],
    auditorias: [], memoria: [], riscos: [], decisoes: [], portfolio: [],
    ...overrides,
  };
}

function mostrar() {
  return render(<MemoryRouter><ExecucaoPage /></MemoryRouter>);
}

beforeEach(() => {
  mock.carregar.mockReset();
  mock.empresa = "GRUPO";
});

it("não cria decisão operacional de PRJ-0002 quando a consulta vem vazia", async () => {
  mock.carregar.mockResolvedValue(dados());
  mostrar();
  expect(await screen.findByText("Nenhum bloqueio ou decisão crítica pendente no momento.")).toBeInTheDocument();
  expect(screen.getByText("4. Equipe Digital (0 agentes cadastrados)")).toBeInTheDocument();
  expect(screen.queryByText(/Enquadramento de PRJ-0002/)).not.toBeInTheDocument();
  expect(screen.queryByText(/TSK-0012 a TSK-0026/)).not.toBeInTheDocument();
});

it("mostra o provedor informado pela fonte e marca ausência sem inferir ChatGPT ou Grok", async () => {
  mock.carregar.mockResolvedValue(dados({
    agentes: [
      { agent_id: "AGT-01", numero: "01", agente: "Helena", cargo_funcao: "Coordenação" },
      { agent_id: "AGT-02", numero: "02", agente: "Caio", cargo_funcao: "Cálculo" },
    ],
    conexoes: [{ agent_id: "AGT-02", provider: "GROK", connection_status: "NOT_CONNECTED" }],
  }));
  mostrar();
  fireEvent.click((await screen.findByText("Helena")).closest(".cursor-pointer")!);
  expect(await screen.findByText(/Provedor não informado · UNKNOWN/)).toBeInTheDocument();
  expect(screen.queryByText(/CHATGPT ·/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Caio").closest(".cursor-pointer")!);
  expect(await screen.findByText(/GROK · NOT_CONNECTED/)).toBeInTheDocument();
});

it("mostra apenas bloqueios da empresa selecionada, vindos da consulta", async () => {
  mock.empresa = "BIZ-001";
  mock.carregar.mockResolvedValue(dados({
    tarefas: [
      { task_id: "T-1", tarefa: "Decisão da empresa um", business_id: "BIZ-001", status: "NÃO INICIADA", responsavel: "Fundador", prioridade: "ALTA" },
      { task_id: "T-2", tarefa: "Decisão da empresa dois", business_id: "BIZ-002", status: "NÃO INICIADA", responsavel: "Fundador", prioridade: "ALTA" },
    ],
  }));
  mostrar();
  expect((await screen.findAllByText("Decisão da empresa um")).length).toBeGreaterThan(0);
  expect(screen.queryByText("Decisão da empresa dois")).not.toBeInTheDocument();
  expect(screen.queryByText(/Enquadramento de PRJ-0002/)).not.toBeInTheDocument();
});

it("ignora resposta tardia da empresa anterior após falha de sessão", async () => {
  let terminarPrimeira!: (valor: ReturnType<typeof dados>) => void;
  mock.carregar
    .mockImplementationOnce(() => new Promise((resolve) => { terminarPrimeira = resolve; }))
    .mockResolvedValueOnce({ sucesso: false, erroMensagem: "Sessão revogada", isAuthError: true, codigoErro: "42501" });
  mock.empresa = "BIZ-001";
  const view = mostrar();
  mock.empresa = "BIZ-002";
  view.rerender(<MemoryRouter><ExecucaoPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/Sua sessão não tem acesso/)).toBeInTheDocument());
  await act(async () => { terminarPrimeira(dados({ tarefas: [{ task_id: "T-antiga", tarefa: "Dado antigo", business_id: "BIZ-001", status: "NÃO INICIADA" }] })); });
  expect(screen.getByText(/Sua sessão não tem acesso/)).toBeInTheDocument();
  expect(screen.queryByText("Dado antigo")).not.toBeInTheDocument();
});

it("oculta modal e dados antigos já na primeira renderização de outra empresa", async () => {
  let terminarSegunda!: (valor: ReturnType<typeof dados>) => void;
  mock.carregar
    .mockResolvedValueOnce(dados({ agentes: [{ agent_id: "AGT-01", numero: "01", agente: "Helena", cargo_funcao: "Coordenação" }] }))
    .mockImplementationOnce(() => new Promise((resolve) => { terminarSegunda = resolve; }));
  mock.empresa = "BIZ-001";
  const view = mostrar();
  fireEvent.click((await screen.findByText("Helena")).closest(".cursor-pointer")!);
  expect(screen.getByText(/Provedor não informado/)).toBeInTheDocument();
  mock.empresa = "BIZ-002";
  view.rerender(<MemoryRouter><ExecucaoPage /></MemoryRouter>);
  expect(screen.getByRole("status", { name: /Consultando agentes e dados/ })).toBeInTheDocument();
  expect(screen.queryByText("Helena")).not.toBeInTheDocument();
  expect(screen.queryByText(/Provedor não informado/)).not.toBeInTheDocument();
  await act(async () => { terminarSegunda(dados()); });
  expect(await screen.findByText("Nenhum bloqueio ou decisão crítica pendente no momento.")).toBeInTheDocument();
});

it("não mostra mensagem bruta de erro da fonte ou exceção com segredo falso", async () => {
  const segredoFalso = "CHAVE_FALSA_PLANTADA_123";
  mock.carregar.mockResolvedValueOnce({ sucesso: false, erroMensagem: `permission denied ${segredoFalso}`, isAuthError: true, codigoErro: "42501" });
  const view = mostrar();
  expect(await screen.findByText(/Sua sessão não tem acesso/)).toBeInTheDocument();
  expect(screen.queryByText(new RegExp(segredoFalso))).not.toBeInTheDocument();
  mock.carregar.mockRejectedValueOnce(new Error(`timeout ${segredoFalso}`));
  fireEvent.click(screen.getByRole("button", { name: "Tentar Novamente" }));
  expect(await screen.findByText(/Não foi possível consultar a Central de Execução/)).toBeInTheDocument();
  expect(screen.queryByText(new RegExp(segredoFalso))).not.toBeInTheDocument();
  view.unmount();
});
