import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import OAuthConsent from "@/pages/OAuthConsent";
import Painel from "@/pages/Painel";
import Modulo from "@/pages/Modulo";
import CrmPage from "@/pages/CrmPage";
import FinanceiroPage from "@/pages/FinanceiroPage";
import CalendarioPage from "@/pages/CalendarioPage";
import PortfolioPage from "@/pages/PortfolioPage";
import IdentidadePage from "@/pages/IdentidadePage";
import EquipePage from "@/pages/EquipePage";
import SistemaPage from "@/pages/SistemaPage";
import ExecucaoPage from "@/pages/ExecucaoPage";
import EntregasPage from "@/pages/EntregasPage";
import IntegracoesPage from "@/pages/IntegracoesPage";
import ComandoPage from "@/pages/ComandoPage";
import { ShieldAlert, LogOut } from "lucide-react";

/**
 * CONTROLE DE ACESSO EXECUTIVO:
 * Exigência mandatória de autenticação real via Supabase Auth.
 */
export const EXIGIR_AUTENTICACAO = true;

function Protegida({ children }: { children: React.ReactNode }) {
  const { user, appAccess, loading, sair } = useAuth();
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

  // Visitante não autenticado -> redireciona para /login preservando rota de destino
  if (!user) {
    const returnTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnTarget}`} replace />;
  }

  // Usuário autenticado mas sem app_access ativo -> bloqueio executivo
  if (!appAccess || !appAccess.active) {
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
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/financeiro" element={<FinanceiroPage />} />
        <Route path="/calendario" element={<CalendarioPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/identidade" element={<IdentidadePage />} />
        <Route path="/equipe" element={<EquipePage />} />
        <Route path="/inbox" element={<ComandoPage inicial="Supervisão" />} />
        <Route path="/sistema" element={<SistemaPage />} />
        <Route path="/integracoes" element={<IntegracoesPage />} />

        {/* Redirecionamentos de conveniência */}
        <Route path="/central-execucao" element={<Navigate to="/execucao" replace />} />
        <Route path="/central-integracoes" element={<Navigate to="/integracoes" replace />} />
        <Route path="/caixa-entrada" element={<Navigate to="/inbox" replace />} />
        <Route path="/helena" element={<Navigate to="/" replace />} />
        <Route path="/modulo/integracoes" element={<Navigate to="/integracoes" replace />} />
        <Route path="/modulo/financeiro" element={<Navigate to="/financeiro" replace />} />
        <Route path="/modulo/calendario" element={<Navigate to="/calendario" replace />} />
        <Route path="/modulo/crm" element={<Navigate to="/crm" replace />} />
        <Route path="/modulo/portfolio" element={<Navigate to="/portfolio" replace />} />
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
          <Rotas />
        </BrowserRouter>
      </BusinessProvider>
    </AuthProvider>
  );
}
