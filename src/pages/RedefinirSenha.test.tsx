import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RedefinirSenha from "./RedefinirSenha";
import { MENSAGEM_LINK_INVALIDO, MENSAGEM_RESET_EMAIL_NEUTRA } from "@/lib/auth-senha";

const mockUseAuth = vi.fn();
const mockVerifyOtp = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockConcluir = vi.fn();
const mockSair = vi.fn();

vi.mock("@/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

function renderPagina(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RedefinirSenha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      passwordRecovery: false,
      concluirRecuperacaoSenha: mockConcluir,
      sair: mockSair.mockResolvedValue(undefined),
    });
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("mostra formulário de nova senha após token_hash válido", async () => {
    renderPagina("/redefinir-senha?token_hash=abc123&type=recovery");

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type: "recovery" });
      expect(screen.getByLabelText("Nova senha")).toBeDefined();
      expect(screen.getByLabelText("Confirmar nova senha")).toBeDefined();
    });
  });

  it("mostra formulário após PKCE (?code=)", async () => {
    renderPagina("/redefinir-senha?code=pkce-code");

    await waitFor(() => {
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
      expect(screen.getByLabelText("Nova senha")).toBeDefined();
    });
  });

  it("trata link expirado e permite pedir um novo e-mail", async () => {
    renderPagina(
      "/redefinir-senha?error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(MENSAGEM_LINK_INVALIDO))).toBeDefined();
      expect(screen.getByRole("button", { name: "Enviar link de redefinição" })).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("E-mail Corporativo"), {
      target: { value: "fundador@maxnutrition.com.br" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalled();
      expect(screen.getByText(MENSAGEM_RESET_EMAIL_NEUTRA)).toBeDefined();
    });
  });

  it("valida confirmação da senha antes de chamar updateUser", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    renderPagina("/redefinir-senha");

    await waitFor(() => {
      expect(screen.getByLabelText("Nova senha")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senha-nova-1" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "senha-diferente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(screen.getByText("A senha e a confirmação não coincidem.")).toBeDefined();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("salva a senha nova e redireciona ao login", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    renderPagina("/redefinir-senha");

    await waitFor(() => {
      expect(screen.getByLabelText("Nova senha")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senha-nova-ok" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "senha-nova-ok" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "senha-nova-ok" });
      expect(mockConcluir).toHaveBeenCalled();
      expect(mockSair).toHaveBeenCalled();
    });

    await waitFor(
      () => {
        expect(screen.getByTestId("login-page")).toBeDefined();
      },
      { timeout: 3000 },
    );
  });
});
