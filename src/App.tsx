import React, { lazy } from "react";
import { PageBoundary } from "@/components/executive/PageBoundary";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth";
import { Layout } from "@/components/Layout";
import { ShieldAlert, LogOut } from "lucide-react";
const Login = lazy(() => import("@/pages/Login"));
const PainelV2Page = lazy(() => import("@/pages/PainelV2Page"));
const CardV2Page = lazy(() => import("@/pages/CardV2Page"));
const ConfiguracoesV2Page = lazy(() => import("@/pages/ConfiguracoesV2Page"));

/**
 * O app roda só a v2 (DEC-032): painel, cards, ações do fundador e configuração da Helena.
 * A v1 está parada; o código dela ficou em docs/arquivo/app-v1, só para consulta.
 *
 * CONTROLE DE ACESSO: autenticação real via Supabase Auth e app_access ativo.
 */
export const EXIGIR_AUTENTICACAO = true;

function Protegida({ children }: { children: React.ReactNode }) {
  const { user, isMember, loading, accessCheckFailed, sair } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="he-access-screen flex min-h-[100dvh] flex-col items-center justify-center p-6 text-foreground">
        <div className="he-access-card flex flex-col items-center gap-5 text-center">
          <div className="he-access-logo grid h-12 w-12 place-items-center rounded-xl bg-[#007A3D] text-white font-bold text-lg animate-pulse shadow-sm">
            H
          </div>
          <p role="status" className="text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground animate-pulse">
            Validando credenciais do Sistema Helena…
          </p>
        </div>
      </div>
    );
  }

  if (accessCheckFailed) {
    return (
      <div className="he-access-screen flex min-h-[100dvh] items-center justify-center p-6 text-foreground">
        <section role="alert" className="he-access-card max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Não foi possível confirmar sua sessão</h1>
          <p className="text-sm text-muted-foreground">O serviço não confirmou a validação de acesso ou a saída. Confira a conexão e tente novamente.</p>
          <div className="he-access-actions flex gap-3">
            <button type="button" onClick={() => window.location.reload()} className="he-access-action rounded-lg bg-primary px-4 py-2 text-primary-foreground">Tentar novamente</button>
            <button type="button" onClick={() => void sair()} className="he-access-action rounded-lg border border-border px-4 py-2">Sair</button>
          </div>
        </section>
      </div>
    );
  }

  // Visitante não autenticado -> /login preservando o destino (só caminho local; o Login confere de novo).
  if (!user) {
    const returnTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnTarget}`} replace />;
  }

  // Autenticado sem app_access ativo -> bloqueio.
  if (!isMember) {
    return (
      <div className="he-access-screen flex min-h-[100dvh] w-full flex-col items-center justify-center p-4 text-foreground">
        <div className="he-access-card w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4 shadow-sm">
          <div className="he-access-logo mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#f87171]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Acesso Não Autorizado
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Usuário não autorizado para o Sistema Helena.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => sair()}
              className="he-access-action inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair e Voltar ao Início</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Endereços antigos das telas v2 continuam funcionando, com a busca (?card=...) preservada. */
function Redirecionar({ para }: { para: string }) {
  const { search } = useLocation();
  return <Navigate to={`${para}${search}`} replace />;
}

/** Links antigos `/?card=...` e `/?pedido=...` continuam abrindo o módulo correto. */
function EntradaRaiz() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  return params.has("card") || params.has("pedido")
    ? <Redirecionar para="/cards" />
    : <PainelV2Page />;
}

function Rotas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/entrar" element={<Navigate to="/login" replace />} />

      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route path="/" element={<EntradaRaiz />} />
        <Route path="/painel" element={<Redirecionar para="/" />} />
        <Route path="/cards" element={<CardV2Page />} />
        <Route path="/configuracoes" element={<ConfiguracoesV2Page />} />
        <Route path="/cards-v2" element={<Redirecionar para="/cards" />} />
        <Route path="/configuracoes-v2" element={<Redirecionar para="/configuracoes" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PageBoundary><Rotas /></PageBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
