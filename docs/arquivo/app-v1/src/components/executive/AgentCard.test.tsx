import React from "react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentCard, AgentCardList } from "./AgentCard";

describe("AgentCardList", () => {
  it("mostra skeleton acessível enquanto carrega", () => {
    render(<AgentCardList agentes={[]} carregando />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando agentes…");
  });

  it("mostra erro com tentar novamente", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentCardList
        agentes={[]}
        erro="Falha ao consultar public.agentes. Verifique a conexão e tente de novo."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar os agentes");
    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("mostra estado vazio", () => {
    render(<AgentCardList agentes={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum agente encontrado");
  });

  it("coloca Helena primeiro e usa nome/cargo recebidos, sem texto fixo de cargo", () => {
    render(
      <AgentCardList
        agentes={[
          { agentId: "AGT-05", nome: "Caio", cargo: "Finanças / CFO", status: "conectado" },
          { agentId: "AGT-01", nome: "Helena", cargo: "CEO Virtual / Central de Comando", status: "conectado" },
          { agentId: "AGT-12", nome: "Maya", cargo: "Design / UX / UI", status: "desconhecido" },
        ]}
      />,
    );
    const cards = screen.getAllByRole("article");
    expect(cards[0].getAttribute("aria-label")).toContain("Helena");
    expect(cards[0].textContent).toContain("CEO Virtual / Central de Comando");
    expect(screen.queryByText("Chief of Staff / Orquestradora")).toBeNull();
    expect(screen.getByText("Sem registro")).toBeTruthy();
  });
});

describe("AgentCard", () => {
  it("anuncia fallback de área não mapeada", () => {
    render(
      <AgentCard agentId="AGT-99" nome="Agente Novo" cargo="Cargo vindo do banco" status="desconhecido" />,
    );
    expect(screen.getByText("Área não mapeada")).toBeTruthy();
    expect(screen.getByText("AN")).toBeTruthy();
    expect(screen.getByRole("article").getAttribute("aria-label")).toContain("Área não mapeada");
  });

  it.each(["padrao", "compacto"] as const)(
    "não usa truncate no nome na variante %s (quebra em até 2 linhas)",
    (variante) => {
      const nome = "Augusto Nome Comprido Para Garantir Quebra";
      render(
        <AgentCard
          agentId="AGT-03"
          nome={nome}
          cargo="Estratégia Corporativa"
          status="conectado"
          variante={variante}
        />,
      );
      const el = screen.getByText(nome);
      expect(el.className).not.toMatch(/\btruncate\b/);
      expect(el.className).toMatch(/line-clamp-2/);
      expect(el.className).toMatch(/break-words/);
      expect(el.getAttribute("title")).toBe(nome);
      expect(screen.getByText("Conectado")).toBeTruthy();
    },
  );

  it("na lista o chip AGT-NN fica na linha do cargo, não ao lado do nome", () => {
    render(
      <AgentCard
        agentId="AGT-03"
        nome="Augusto"
        cargo="Estratégia Corporativa"
        status="conectado"
        variante="compacto"
      />,
    );
    const nome = screen.getByText("Augusto");
    expect(nome.textContent).toBe("Augusto");
    expect(nome.nextElementSibling?.textContent).toMatch(/AGT-03/);
    expect(nome.nextElementSibling?.textContent).toMatch(/Estratégia Corporativa/);
  });
});
