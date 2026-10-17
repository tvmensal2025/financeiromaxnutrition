import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import EquipePage from "./EquipePage";

function mockConsultas(opts: {
  agentes?: { data: unknown; error: unknown };
  conexoes?: { data: unknown; error: unknown };
}) {
  fromMock.mockImplementation((tabela: string) => {
    if (tabela === "agentes") {
      return {
        select: () => ({
          order: () => Promise.resolve(opts.agentes ?? { data: [], error: null }),
        }),
      };
    }
    return {
      select: () => Promise.resolve(opts.conexoes ?? { data: [], error: null }),
    };
  });
}

const agentesOk = {
  data: [
    {
      agent_id: "AGT-01",
      agente: "Helena",
      cargo_funcao: "CEO Virtual / Central de Comando",
      status: "ATIVO",
    },
    {
      agent_id: "AGT-02",
      agente: "Laura",
      cargo_funcao: "Comunicação e Desenvolvimento do Fundador",
      status: "PAUSADO",
    },
    {
      agent_id: "AGT-06",
      agente: "Clara",
      cargo_funcao: "Risco, Jurídico e Compliance",
      status: "DESATIVADO",
    },
  ],
  error: null,
};

describe("EquipePage", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("com erro em agent_connections mostra alerta, não afirma conectados e usa Status indisponível nos ATIVOS", async () => {
    mockConsultas({
      agentes: agentesOk,
      conexoes: { data: null, error: { message: "timeout" } },
    });

    render(
      <MemoryRouter>
        <EquipePage />
      </MemoryRouter>,
    );

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/Não foi possível carregar o status de conexão dos agentes/);
    const retry = screen.getByRole("button", { name: /tentar novamente/i });
    expect(retry).toBeTruthy();
    expect(retry.className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByText(/status de conexão indisponível/i)).toBeTruthy();
    expect(screen.queryByText(/\d+\s+conectados/i)).toBeNull();
    expect(screen.getByText("Status indisponível")).toBeTruthy();
    expect(screen.getByText("Pausado")).toBeTruthy();
    expect(screen.getByText("Desativado")).toBeTruthy();
    expect(screen.queryByText("Sem registro")).toBeNull();

    const chamadasIniciais = fromMock.mock.calls.length;
    const user = userEvent.setup();
    await user.click(retry);
    await waitFor(() => {
      expect(fromMock.mock.calls.length).toBeGreaterThan(chamadasIniciais);
    });
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("filtros de área e alternador têm aria-pressed e área mínima de 44px", async () => {
    mockConsultas({
      agentes: agentesOk,
      conexoes: { data: [], error: null },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <EquipePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Helena")).toBeTruthy();
    });

    const todos = screen.getByRole("button", { name: /^Todos$/ });
    const direcao = screen.getByRole("button", { name: /^Direção e Portfólio$/ });
    expect(todos).toHaveAttribute("aria-pressed", "true");
    expect(direcao).toHaveAttribute("aria-pressed", "false");
    expect(todos.className).toMatch(/min-h-11/);
    expect(todos.className).toMatch(/min-w-11/);

    await user.click(direcao);
    expect(direcao).toHaveAttribute("aria-pressed", "true");
    expect(todos).toHaveAttribute("aria-pressed", "false");

    const grade = screen.getByRole("button", { name: "Ver em grade" });
    const lista = screen.getByRole("button", { name: "Ver em lista" });
    expect(grade).toHaveAttribute("aria-pressed", "true");
    expect(lista).toHaveAttribute("aria-pressed", "false");
    expect(grade.className).toMatch(/h-11/);
    expect(grade.className).toMatch(/w-11/);
    expect(lista.className).toMatch(/h-11/);
    expect(lista.className).toMatch(/w-11/);

    await user.click(lista);
    expect(lista).toHaveAttribute("aria-pressed", "true");
    expect(grade).toHaveAttribute("aria-pressed", "false");
  });
});
