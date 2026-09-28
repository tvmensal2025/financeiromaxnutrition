import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Rotas } from "@/App";

const mockUseAuth = vi.fn();

vi.mock("@/auth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

describe("Rotas públicas de redefinição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      appAccess: null,
      loading: false,
      passwordRecovery: false,
      sair: vi.fn(),
      entrar: vi.fn(),
      concluirRecuperacaoSenha: vi.fn(),
    });
  });

  it("mantém /redefinir-senha pública, sem redirecionar para /login", async () => {
    render(
      <MemoryRouter initialEntries={["/redefinir-senha"]}>
        <Rotas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Redefinir senha" })).toBeDefined();
    });
    expect(screen.queryByRole("heading", { name: "Acesso à Central Executiva" })).toBeNull();
  });

  it("encaminha o hash implícito de recovery de /login para /redefinir-senha", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/login", hash: "#access_token=tok&type=recovery" },
        ]}
      >
        <Rotas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Redefinir senha" })).toBeDefined();
    });
  });

  it("encaminha PASSWORD_RECOVERY mesmo sem parâmetros na URL", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      passwordRecovery: true,
      sair: vi.fn(),
      entrar: vi.fn(),
      concluirRecuperacaoSenha: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Rotas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Redefinir senha" })).toBeDefined();
    });
    expect(screen.queryByText("Acesso Não Autorizado")).toBeNull();
  });
});
