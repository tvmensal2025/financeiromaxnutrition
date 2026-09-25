import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import OAuthConsent from "./OAuthConsent";
import { supabase } from "@/lib/supabase";

// Mock do módulo de autenticação
const mockUseAuth = vi.fn();
vi.mock("@/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("OAuthConsent Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).location;
    (window as any).location = { href: "" };
  });

  it("exibe erro controlado quando authorization_id está ausente", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      sair: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/oauth/consent"]}>
        <Routes>
          <Route path="/oauth/consent" element={<OAuthConsent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Solicitação Inválida")).toBeDefined();
      expect(screen.getByText(/O parâmetro 'authorization_id' não foi fornecido/)).toBeDefined();
    });
  });

  it("redireciona para /login preservando authorization_id quando usuário não está autenticado", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      appAccess: null,
      loading: false,
      sair: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/oauth/consent?authorization_id=auth-xyz-123"]}>
        <Routes>
          <Route path="/oauth/consent" element={<OAuthConsent />} />
          <Route path="/login" element={<div data-testid="login-page">Tela de Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeDefined();
    });
  });

  it("carrega e renderiza a tela de consentimento com detalhes da autorização", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      sair: vi.fn(),
    });

    const getDetailsSpy = vi.spyOn(supabase.auth.oauth, "getAuthorizationDetails").mockResolvedValue({
      data: {
        authorization_id: "auth-real-999",
        client: {
          id: "client-grok-1",
          name: "Helena Gateway Grok",
          uri: "https://helena-automation-helena-gateway.d9v63q.easypanel.host",
          logo_uri: "",
        },
        user: {
          id: "user-1",
          email: "fundador@maxnutrition.com.br",
        },
        scope: "openid email offline_access mcp",
      },
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={["/oauth/consent?authorization_id=auth-real-999"]}>
        <Routes>
          <Route path="/oauth/consent" element={<OAuthConsent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getDetailsSpy).toHaveBeenCalledWith("auth-real-999");
      expect(screen.getByRole("heading", { name: "Autorizar acesso" })).toBeDefined();
      expect(screen.getByText("Helena Gateway Grok")).toBeDefined();
      expect(screen.getByText("fundador@maxnutrition.com.br")).toBeDefined();
      expect(screen.getByRole("button", { name: /Autorizar acesso/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Negar acesso/i })).toBeDefined();
    });
  });

  it("executa approveAuthorization e redireciona para a URL do Supabase ao clicar em Autorizar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      sair: vi.fn(),
    });

    vi.spyOn(supabase.auth.oauth, "getAuthorizationDetails").mockResolvedValue({
      data: {
        authorization_id: "auth-real-999",
        client: {
          id: "client-grok-1",
          name: "Helena Gateway Grok",
          uri: "",
          logo_uri: "",
        },
        user: {
          id: "user-1",
          email: "fundador@maxnutrition.com.br",
        },
        scope: "openid offline_access",
      },
      error: null,
    } as any);

    const approveSpy = vi.spyOn(supabase.auth.oauth, "approveAuthorization").mockResolvedValue({
      data: {
        redirect_url: "https://grok.x.ai/oauth/callback?code=supabase-auth-code-123",
      },
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={["/oauth/consent?authorization_id=auth-real-999"]}>
        <Routes>
          <Route path="/oauth/consent" element={<OAuthConsent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Helena Gateway Grok")).toBeDefined();
    });

    const btnAutorizar = screen.getByRole("button", { name: /Autorizar acesso/i });
    fireEvent.click(btnAutorizar);

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith("auth-real-999");
      expect(window.location.href).toBe("https://grok.x.ai/oauth/callback?code=supabase-auth-code-123");
    });
  });

  it("executa denyAuthorization e redireciona para a URL de cancelamento ao clicar em Negar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      sair: vi.fn(),
    });

    vi.spyOn(supabase.auth.oauth, "getAuthorizationDetails").mockResolvedValue({
      data: {
        authorization_id: "auth-real-999",
        client: {
          id: "client-grok-1",
          name: "Helena Gateway Grok",
          uri: "",
          logo_uri: "",
        },
        user: {
          id: "user-1",
          email: "fundador@maxnutrition.com.br",
        },
        scope: "openid offline_access",
      },
      error: null,
    } as any);

    const denySpy = vi.spyOn(supabase.auth.oauth, "denyAuthorization").mockResolvedValue({
      data: {
        redirect_url: "https://grok.x.ai/oauth/callback?error=access_denied",
      },
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={["/oauth/consent?authorization_id=auth-real-999"]}>
        <Routes>
          <Route path="/oauth/consent" element={<OAuthConsent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Helena Gateway Grok")).toBeDefined();
    });

    const btnNegar = screen.getByRole("button", { name: /Negar acesso/i });
    fireEvent.click(btnNegar);

    await waitFor(() => {
      expect(denySpy).toHaveBeenCalledWith("auth-real-999");
      expect(window.location.href).toBe("https://grok.x.ai/oauth/callback?error=access_denied");
    });
  });

  it("redireciona imediatamente se a autorização já tiver sido previamente consentida", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "fundador@maxnutrition.com.br" },
      appAccess: { user_id: "user-1", role: "founder", active: true },
      loading: false,
      sair: vi.fn(),
    });

    vi.spyOn(supabase.auth.oauth, "getAuthorizationDetails").mockResolvedValue({
      data: {
        authorization_id: "auth-real-999",
        redirect_url: "https://grok.x.ai/oauth/callback?code=already-consented",
      },
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={["/oauth/consent?authorization_id=auth-real-999"]}>
        <Routes>
          <Route path="/oauth/consent" element={<OAuthConsent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(window.location.href).toBe("https://grok.x.ai/oauth/callback?code=already-consented");
    });
  });
});
