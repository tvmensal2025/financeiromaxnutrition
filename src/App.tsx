import React, { lazy } from "react";
import { PageBoundary } from "@/components/executive/PageBoundary";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { Layout } from "@/components/Layout";
const Login = lazy(() => import("@/pages/Login"));
const OAuthConsent = lazy(() => import("@/pages/OAuthConsent"));
const Painel = lazy(() => import("@/pages/Painel"));
const Modulo = lazy(() => import("@/pages/Modulo"));
const CrmPage = lazy(() => import("@/pages/CrmPage"));
const FinanceiroPage = lazy(() => import("@/pages/FinanceiroPage"));
const CalendarioPage = lazy(() => import("@/pages/CalendarioPage"));
const PortfolioPage = lazy(() => import("@/pages/PortfolioPage"));
const IdentidadePage = lazy(() => import("@/pages/IdentidadePage"));
const EquipePage = lazy(() => import("@/pages/EquipePage"));
const SistemaPage = lazy(() => import("@/pages/SistemaPage"));
const ExecucaoPage = lazy(() => import("@/pages/ExecucaoPage"));
const EntregasPage = lazy(() => import("@/pages/EntregasPage"));
const CardV2Page = lazy(() => import("@/pages/CardV2Page"));
const ConfiguracoesV2Page = lazy(() => import("@/pages/ConfiguracoesV2Page"));
const IntegracoesPage = lazy(() => import("@/pages/IntegracoesPage"));
const ComandoPage = lazy(() => import("@/pages/ComandoPage"));
const Conversa = lazy(() => import("@/pages/Conversa"));
import { ShieldAlert, LogOut } from "lucide-react";

/**
 * CONTROLE DE ACESSO EXECUTIVO:
 * Exigência mandatória de autenticação real via Supabase Auth.
 */
export const EXIGIR_AUTENTICACAO = true;

function Protegida({ children }: { children: React.ReactNode }) {
  const { user, isMember, loading, accessCheckFailed, sair } = useAuth();
  const location = useLocation();

  // Caso autenticação esteja ativada
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-3 bg-[#F7F8F7] dark:bg-[#101312] text-foreground">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#007A3D] text-white font-bold text-lg animate-pulse shadow-sm">
          H
        </div>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground animate-pulse">
          Validando credenciais do Sistema Helena…
        </p>
      </div>
    );
  }

  if (accessCheckFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section role="alert" className="max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Não foi possível confirmar sua sessão</h1>
          <p className="text-sm text-muted-foreground">O serviço não confirmou a validação de acesso ou a saída. Confira a conexão e tente novamente.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Tentar novamente</button>
            <button type="button" onClick={() => void sair()} className="rounded-lg border border-border px-4 py-2">Sair</button>
          </div>
        </section>
      </div>
    );
  }

  // Visitante não autenticado -> redireciona para /login preservando rota de destino
  if (!user) {
    const returnTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnTarget}`} replace />;
  }

  // Usuário autenticado mas sem app_access ativo -> bloqueio executivo
  if (!isMember) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-[#F7F8F7] dark:bg-[#101312] text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#f87171]">
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
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
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

function Rotas() {
  return (
    <Routes>
      {/* Rotas de Autenticação e Consentimento OAuth */}
      <Route path="/login" element={<Login />} />
      <Route path="/entrar" element={<Navigate to="/login" replace />} />
      <Route
        path="/oauth/consent"
        element={
          <Protegida>
            <OAuthConsent />
          </Protegida>
        }
      />

      {/* Aplicação Administrativa Protegida */}
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route path="/" element={<ComandoPage />} />
        <Route path="/indicadores" element={<Painel />} />
        <Route path="/comando" element={<ComandoPage />} />
        <Route path="/cobertura" element={<ComandoPage inicial="Cobertura" />} />
        <Route path="/supervisao" element={<ComandoPage inicial="Supervisão" />} />
        <Route path="/empresas" element={<ComandoPage inicial="Empresas" />} />
        <Route path="/consumo" element={<ComandoPage inicial="Consumo" />} />
        <Route path="/execucao" element={<ExecucaoPage />} />
        <Route path="/entregas" element={<EntregasPage />} />
        {import.meta.env.VITE_HELENA_V2_HABILITADA === 'true' && <Route path="/cards-v2" element={<CardV2Page />} />}
        {import.meta.env.VITE_HELENA_V2_HABILITADA === 'true' && <Route path="/configuracoes-v2" element={<ConfiguracoesV2Page />} />}
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/financeiro" element={<FinanceiroPage />} />
        <Route path="/calendario" element={<CalendarioPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/identidade" element={<IdentidadePage />} />
        <Route path="/equipe" element={<EquipePage />} />
        <Route path="/inbox" element={<ComandoPage inicial="Supervisão" />} />
        <Route path="/conversa" element={<Conversa />} />
        <Route path="/chat" element={<Navigate to="/conversa" replace />} />
        <Route path="/sistema" element={<SistemaPage />} />
        <Route path="/integracoes" element={<IntegracoesPage />} />

        {/* Redirecionamentos de conveniência */}
        <Route path="/central-execucao" element={<Navigate to="/execucao" replace />} />
        <Route path="/central-integracoes" element={<Navigate to="/integracoes" replace />} />
        <Route path="/caixa-entrada" element={<Navigate to="/inbox" replace />} />
        <Route path="/helena" element={<Navigate to="/" replace />} />
        <Route path="/modulo/integracoes" element={<Navigate to="/integracoes" replace />} />
        <Route path="/modulo/financeiro" element={<Navigate to="/financeiro" replace />} />
        <Route path="/modulo/crm" element={<Navigate to="/crm" replace />} />
        <Route path="/modulo/equipe" element={<Navigate to="/equipe" replace />} />

        {/* Tabelas e Módulos do Sistema Helena */}
        <Route path="/modulo/:tabela" element={<Modulo />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BusinessProvider>
        <BrowserRouter>
          <PageBoundary><Rotas /></PageBoundary>
        </BrowserRouter>
      </BusinessProvider>
    </AuthProvider>
  );
}
