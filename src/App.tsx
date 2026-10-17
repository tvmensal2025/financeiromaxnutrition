import React, { lazy } from "react";
import { PageBoundary } from "@/components/executive/PageBoundary";
import { BrowserRouter, Navigate, Route, Routes, Link, Outlet, useLocation } from "react-router-dom";
import { SessionBusinessBoundary } from "@/contexts/SessionBusinessBoundary";
import { useBusiness } from "@/contexts/BusinessContext";
import { AuthProvider, useAuth } from "@/auth";
import { Layout } from "@/components/Layout";
import { ShieldAlert, LogOut } from "lucide-react";
const Login = lazy(() => import("@/pages/Login"));
const PainelV2Page = lazy(() => import("@/pages/PainelV2Page"));
const CardV2Page = lazy(() => import("@/pages/CardV2Page"));
const ConfiguracoesV2Page = lazy(() => import("@/pages/ConfiguracoesV2Page"));

const FinanceiroPage = lazy(() => import("@/pages/FinanceiroPage"));
const CrmPage = lazy(() => import("@/pages/CrmPage"));
const CalendarioPage = lazy(() => import("@/pages/CalendarioPage"));
const PortfolioPage = lazy(() => import("@/pages/PortfolioPage"));
const IdentidadePage = lazy(() => import("@/pages/IdentidadePage"));
const IndicadoresPage = lazy(() => import("@/pages/IndicadoresPage"));
const Modulo = lazy(() => import("@/pages/Modulo"));
const EquipeV2Page = lazy(() => import("@/pages/EquipeV2Page"));
const ComandoV2Page = lazy(() => import("@/pages/ComandoV2Page"));
const IntegracoesV2Page = lazy(() => import("@/pages/IntegracoesV2Page"));
const ConversaV2Page = lazy(() => import("@/pages/ConversaV2Page"));
const GovernancaV2Page = lazy(() => import("@/pages/GovernancaV2Page"));
const OAuthConsent = lazy(() => import("@/pages/OAuthConsent"));

/**
 * O app mantém a esteira v2 e reaproveita os módulos canônicos de negócio.
 * A execução legada continua parada; as páginas adaptadas usam a sessão atual.
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

/** Endereços antigos da operação abrem a aba equivalente da Sala de comando, mantendo outros parâmetros da busca. */
function RedirecionarAba({ aba }: { aba: string }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('aba', aba);
  return <Navigate to={`/comando?${params.toString()}`} replace />;
}

/** Links antigos `/?card=...` e `/?pedido=...` continuam abrindo o módulo correto. */
function EntradaRaiz() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  return params.has("card") || params.has("pedido")
    ? <Redirecionar para="/cards" />
    : <PainelV2Page />;
}

/** Troca de identidade desmonta todo estado sensível antes de montar outro fundador. */
function SomenteFundador() {
  const { isFounder, user, role } = useAuth();
  if (!isFounder || !user) return <section role="alert" className="space-y-3 p-6"><h1 className="text-xl">Acesso restrito</h1><p>Esta área está disponível para a conta do fundador.</p><Link className="he-nav-link" to="/cards">Voltar aos cards</Link></section>;
  return <React.Fragment key={`${user.id}:${role}`}><Outlet /></React.Fragment>;
}

/** Impede consultas consolidadas antes de resolver o portfólio autorizado. */
function AreaNegocios() {
  const { loading, error, currentBusinessId, empresas } = useBusiness();
  if (loading) return <p role="status" className="p-6">Carregando empresas…</p>;
  if (error) return <section role="alert" className="p-6"><h1 className="text-xl">Empresas indisponíveis</h1><p>{error}</p><button className="he-nav-link" onClick={() => window.location.reload()}>Tentar novamente</button></section>;
  return <React.Fragment key={`${currentBusinessId}:${empresas.map(e => e.id).join(',')}`}><Outlet /></React.Fragment>;
}

function Rotas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/entrar" element={<Navigate to="/login" replace />} />

      <Route
        element={
          <Protegida>
            <SessionBusinessBoundary><Layout /></SessionBusinessBoundary>
          </Protegida>
        }
      >
        <Route path="/" element={<EntradaRaiz />} />
        <Route path="/painel" element={<Redirecionar para="/" />} />
        <Route path="/cards" element={<CardV2Page />} />
        <Route path="/configuracoes" element={<ConfiguracoesV2Page />} />
        <Route element={<SomenteFundador />}>
          <Route path="/comando" element={<ComandoV2Page />} />
          <Route path="/sistema" element={<GovernancaV2Page />} />
          <Route path="/conversa" element={<ConversaV2Page />} />
          <Route path="/equipe" element={<EquipeV2Page />} />
          <Route path="/integracoes" element={<IntegracoesV2Page />} />
          {['supervisao', 'execucao', 'entregas', 'consumo', 'cobertura'].map(aba => <Route key={aba} path={`/${aba}`} element={<RedirecionarAba aba={aba} />} />)}
          <Route path="/oauth/consent" element={<OAuthConsent />} />
          <Route element={<AreaNegocios />}>
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/crm" element={<CrmPage />} />
            <Route path="/calendario" element={<CalendarioPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/empresas" element={<PortfolioPage />} />
            <Route path="/identidade" element={<IdentidadePage />} />
            <Route path="/indicadores" element={<IndicadoresPage />} />
            <Route path="/modulo/:tabela" element={<Modulo />} />
          </Route>
        </Route>
        {Object.entries({ '/chat': '/conversa', '/central-integracoes': '/integracoes', '/helena': '/', '/modulo/integracoes': '/integracoes', '/modulo/financeiro': '/financeiro', '/modulo/crm': '/crm', '/modulo/equipe': '/equipe' }).map(([de, para]) => <Route key={de} path={de} element={<Redirecionar para={para} />} />)}
        {Object.entries({ '/inbox': 'supervisao', '/caixa-entrada': 'supervisao', '/central-execucao': 'execucao' }).map(([de, aba]) => <Route key={de} path={de} element={<RedirecionarAba aba={aba} />} />)}
        <Route path="/cards-v2" element={<Redirecionar para="/cards" />} />
        <Route path="/configuracoes-v2" element={<Redirecionar para="/configuracoes" />} />
      </Route>

      <Route path="*" element={<Protegida><section className="p-8 space-y-3"><h1 className="text-xl">Página não encontrada</h1><p>Este endereço não corresponde a uma página do sistema.</p><Link to="/">Abrir visão geral</Link></section></Protegida>} />
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
