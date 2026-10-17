import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import OAuthConsent from "./OAuthConsent";
import { validOAuthRedirect } from "@/lib/oauth-redirect";

const { auth, getAuthorizationDetails, approveAuthorization, denyAuthorization } = vi.hoisted(() => ({
  auth: vi.fn(),
  getAuthorizationDetails: vi.fn(),
  approveAuthorization: vi.fn(),
  denyAuthorization: vi.fn(),
}));
vi.mock("@/auth", () => ({ useAuth: auth }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { oauth: { getAuthorizationDetails, approveAuthorization, denyAuthorization } } } }));

function TestRoutes({ withSwitch = false }: { withSwitch?: boolean }) {
  const navigate = useNavigate();
  return <>
    {withSwitch && <button onClick={() => navigate("/oauth/consent?authorization_id=second")}>Trocar solicitação</button>}
    <Routes>
      <Route path="/oauth/consent" element={<OAuthConsent />} />
      <Route path="/login" element={<p>Tela de login</p>} />
    </Routes>
  </>;
}

function open(path = "/oauth/consent?authorization_id=first", withSwitch = false) {
  return render(<MemoryRouter initialEntries={[path]}><TestRoutes withSwitch={withSwitch} /></MemoryRouter>);
}

const details = (id = "first") => ({ data: {
  authorization_id: id, client: { id: "client-1", name: "Cliente registrado" },
  user: { id: "founder-1" }, scope: "openid email",
}, error: null });

describe("OAuthConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockReturnValue({ user: { id: "founder-1", email: "founder@example.test" }, appAccess: { user_id: "founder-1", role: "founder", active: true }, isFounder: true, loading: false });
    getAuthorizationDetails.mockResolvedValue(details());
  });

  it("preserva o retorno no login e não consulta OAuth antes da sessão", async () => {
    auth.mockReturnValue({ user: null, appAccess: null, isFounder: false, loading: false });
    open();
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it("exige parâmetro e permissão de fundador antes da chamada ao SDK", () => {
    open("/oauth/consent");
    expect(screen.getByRole("alert")).toHaveTextContent("authorization_id");
    expect(getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it("mostra apenas cliente e escopos devolvidos pela autorização atual", async () => {
    open();
    expect(await screen.findByText("Cliente registrado")).toBeInTheDocument();
    expect(screen.getByText("openid")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(getAuthorizationDetails).toHaveBeenCalledWith("first");
  });

  it("bloqueia contexto de outro usuário", async () => {
    getAuthorizationDetails.mockResolvedValue({ ...details(), data: { ...details().data, user: { id: "other" } } });
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("sessão atual");
    expect(screen.queryByRole("button", { name: "Autorizar acesso" })).not.toBeInTheDocument();
  });

  it("descarta uma resposta antiga após mudança de authorization_id", async () => {
    denyAuthorization.mockResolvedValue({ data: { redirect_url: "javascript:invalid" }, error: null });
    let resolveFirst!: (value: ReturnType<typeof details>) => void;
    getAuthorizationDetails.mockImplementation((id: string) => id === "first"
      ? new Promise(resolve => { resolveFirst = resolve; })
      : Promise.resolve(details("second")));
    open(undefined, true);
    fireEvent.click(screen.getByRole("button", { name: "Trocar solicitação" }));
    expect(await screen.findByText("Cliente registrado")).toBeInTheDocument();
    await act(async () => { resolveFirst(details("first")); });
    await waitFor(() => expect(getAuthorizationDetails).toHaveBeenCalledWith("second"));
    fireEvent.click(screen.getByRole("button", { name: "Negar acesso" }));
    expect(denyAuthorization).toHaveBeenCalledWith("second");
    expect(approveAuthorization).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Destino de retorno inválido");
  });

  it("recusa um destino inseguro após a decisão", async () => {
    approveAuthorization.mockResolvedValue({ data: { redirect_url: "javascript:alert(1)" }, error: null });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Autorizar acesso" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Destino de retorno inválido");
    expect(approveAuthorization).toHaveBeenCalledWith("first");
  });
});

describe("validOAuthRedirect", () => {
  it("aceita apenas HTTPS sem credenciais na URL", () => {
    expect(validOAuthRedirect("https://client.example/callback?code=ok")).toBe(true);
    for (const url of ["http://client.example", "http://localhost/callback", "javascript:alert(1)", "//client.example", "https://user:pass@client.example"]) {
      expect(validOAuthRedirect(url)).toBe(false);
    }
  });
});
