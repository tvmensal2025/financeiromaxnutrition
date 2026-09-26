import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TrocarSenhaDialog } from "./TrocarSenhaDialog";

const mockUpdateUser = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

describe("TrocarSenhaDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("pede senha nova com confirmação e chama updateUser", async () => {
    const onOpenChange = vi.fn();
    render(<TrocarSenhaDialog open onOpenChange={onOpenChange} />);

    expect(screen.getByRole("heading", { name: "Trocar senha" })).toBeDefined();

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senha-logado" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "senha-logado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "senha-logado" });
      expect(screen.getByText("Senha atualizada com sucesso.")).toBeDefined();
    });
  });

  it("não envia senha quando a confirmação diverge", async () => {
    render(<TrocarSenhaDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senha-logado" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "outra-senha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => {
      expect(screen.getByText("A senha e a confirmação não coincidem.")).toBeDefined();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
