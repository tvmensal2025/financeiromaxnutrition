import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";

const mockUseAuth = vi.fn();
vi.mock("@/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("Login Redirect Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("libera nova tentativa quando a conexão falha durante o login", async () => {
    mockUseAuth.mockReturnValue({ user:null, appAccess:null, loading:false, entrar:vi.fn().mockRejectedValue(new Error('network')) });
    render(<MemoryRouter><Login/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('E-mail Corporativo'),{target:{value:'teste@example.com'}});
    fireEvent.change(screen.getByLabelText('Senha de Acesso'),{target:{value:'test-only-password'}});
    fireEvent.submit(screen.getByRole('button',{name:'Entrar na Central'}).closest('form')!);
    await screen.findByRole('alert');
    await waitFor(()=>expect((screen.getByRole('button',{name:'Entrar na Central'}) as HTMLButtonElement).disabled).toBe(false));
  });

  it("redireciona para / por padrão quando autenticado sem parâmetro redirect", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      entrar: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div data-testid="dashboard">Dashboard Executivo</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("dashboard")).toBeDefined();
    });
  });

  it("redireciona para a URL de destino quando fornecido parâmetro redirect válido", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      entrar: vi.fn(),
    });

    const targetUrl = "/oauth/consent?authorization_id=auth-secret-123";

    render(
      <MemoryRouter initialEntries={[`/login?redirect=${encodeURIComponent(targetUrl)}`]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/oauth/consent"
            element={<div data-testid="consent-target">Página de Consentimento</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("consent-target")).toBeDefined();
    });
  });

  it("neutraliza tentativa de Open Redirect externo e redireciona com segurança para /", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      entrar: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/login?redirect=https://site-malicioso.com"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div data-testid="dashboard">Dashboard Seguro</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("dashboard")).toBeDefined();
    });
  });

  it.each(["/\\evil.example/x", "/%5Cevil.example/x".replace("%5C", "\\"), "/ok\nSet-Cookie:x"])(
    "recusa destino com barra invertida ou caractere de controle (%j) e volta para /", async (alvo) => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
        appAccess: { user_id: "user-1", role: "founder", active: true },
        loading: false,
        entrar: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={[`/login?redirect=${encodeURIComponent(alvo)}`]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div data-testid="dashboard">Dashboard Seguro</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId("dashboard")).toBeDefined();
      });
    });
});
