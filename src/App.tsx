import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { Layout } from "@/components/Layout";
import Entrar from "@/pages/Entrar";
import Painel from "@/pages/Painel";
import Modulo from "@/pages/Modulo";
import CrmPage from "@/pages/CrmPage";
import FinanceiroPage from "@/pages/FinanceiroPage";
import CalendarioPage from "@/pages/CalendarioPage";

/**
 * CONTROLE DE ACESSO:
 * - true: Exige autenticação (necessário porque o banco Supabase exige usuário logado para liberar as tabelas).
 * - false: Sistema público (só use se aplicar o script SQL liberando as tabelas para a role 'anon').
 */
export const EXIGIR_AUTENTICACAO = true;

function Protegida({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Quando desativada a autenticação, libera acesso irrestrito
  if (!EXIGIR_AUTENTICACAO) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-3 bg-background text-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground animate-pulse">
          Abrindo o Sistema Helena…
        </p>
      </div>
    );
  }
  if (!user) return <Navigate to="/entrar" replace />;
  return <>{children}</>;
}

function Rotas() {
  return (
    <Routes>
      <Route
        path="/entrar"
        element={!EXIGIR_AUTENTICACAO ? <Navigate to="/" replace /> : <Entrar />}
      />
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route path="/" element={<Painel />} />
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/financeiro" element={<FinanceiroPage />} />
        <Route path="/calendario" element={<CalendarioPage />} />
        <Route path="/helena" element={<Navigate to="/" replace />} />
        <Route path="/modulo/financeiro" element={<Navigate to="/financeiro" replace />} />
        <Route path="/modulo/calendario" element={<Navigate to="/calendario" replace />} />
        <Route path="/modulo/:tabela" element={<Modulo />} />
      </Route>
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
