import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";
import { MENSAGEM_LIMITE_ENVIO, MENSAGEM_RESET_EMAIL_NEUTRA } from "@/lib/auth-senha";

const mockUseAuth = vi.fn();
const mockResetPasswordForEmail = vi.fn();

vi.mock("@/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

function visitante() {
  return {
    user: null,
    appAccess: null,
    loading: false,
    entrar: vi.fn(),
    passwordRecovery: false,
  };
}

describe("Login Redirect Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona para / por padrão quando autenticado sem parâmetro redirect", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      entrar: vi.fn(),
      passwordRecovery: false,
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
      passwordRecovery: false,
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
      passwordRecovery: false,
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

  it("não redireciona o visitante autenticado em recuperação de senha", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      entrar: vi.fn(),
      passwordRecovery: true,
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId("dashboard")).toBeNull();
    expect(screen.getByRole("heading", { name: "Acesso à Central Executiva" })).toBeDefined();
  });
});

describe("Login — Esqueci minha senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(visitante());
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("exibe o link Esqueci minha senha na tela de login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Esqueci minha senha" })).toBeDefined();
  });

  it("pede o e-mail, chama resetPasswordForEmail com redirectTo do origin e mostra mensagem neutra", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    fireEvent.change(screen.getByLabelText("E-mail Corporativo"), {
      target: { value: "fundador@maxnutrition.com.br" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith("fundador@maxnutrition.com.br", {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
    });

    expect(screen.getByText(MENSAGEM_RESET_EMAIL_NEUTRA)).toBeDefined();
    expect(screen.getByText(MENSAGEM_RESET_EMAIL_NEUTRA).textContent?.toLowerCase()).not.toContain(
      "não encontrado",
    );
  });

  it("trata limite de envio 429 com texto para aguardar alguns minutos", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { status: 429, code: "over_email_send_rate_limit", message: "rate limit" },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    fireEvent.change(screen.getByLabelText("E-mail Corporativo"), {
      target: { value: "fundador@maxnutrition.com.br" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));

    await waitFor(() => {
      expect(screen.getByText(MENSAGEM_LIMITE_ENVIO)).toBeDefined();
    });
    expect(MENSAGEM_LIMITE_ENVIO.toLowerCase()).toContain("aguarde alguns minutos");
  });
});
