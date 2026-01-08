import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PrivacyProvider } from "@/contexts/PrivacyContext";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Plans from "./pages/Plans";
import Subscriptions from "./pages/Subscriptions";
import Import from "./pages/Import";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Leads from "./pages/Leads";
import Pipeline from "./pages/Pipeline";
import Products from "./pages/Products";
import Services from "./pages/Services";
import Appointments from "./pages/Appointments";
import Invoices from "./pages/Invoices";
import TransactionsPage from "./pages/TransactionsPage";
import Webhooks from "./pages/Webhooks";
import Broadcasts from "./pages/Broadcasts";
import CRM from "./pages/CRM";
import Catalog from "./pages/Catalog";
import Finance from "./pages/Finance";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mensagens"
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        }
      />
      
      {/* CRM Routes */}
      <Route
        path="/crm"
        element={
          <ProtectedRoute>
            <CRM />
          </ProtectedRoute>
        }
      />
      <Route path="/leads" element={<Navigate to="/crm?tab=leads" replace />} />
      <Route path="/pipeline" element={<Navigate to="/crm?tab=pipeline" replace />} />
      <Route path="/clientes" element={<Navigate to="/crm?tab=clientes" replace />} />
      
      {/* Catalog Routes */}
      <Route
        path="/catalogo"
        element={
          <ProtectedRoute>
            <Catalog />
          </ProtectedRoute>
        }
      />
      <Route path="/produtos" element={<Navigate to="/catalogo?tab=produtos" replace />} />
      <Route path="/servicos" element={<Navigate to="/catalogo?tab=servicos" replace />} />
      <Route path="/planos" element={<Navigate to="/catalogo?tab=planos" replace />} />
      
      {/* Schedule */}
      <Route
        path="/agendamentos"
        element={
          <ProtectedRoute>
            <Appointments />
          </ProtectedRoute>
        }
      />
      
      {/* Finance Routes */}
      <Route
        path="/financeiro"
        element={
          <ProtectedRoute>
            <Finance />
          </ProtectedRoute>
        }
      />
      <Route path="/transacoes" element={<Navigate to="/financeiro?tab=transacoes" replace />} />
      <Route path="/faturas" element={<Navigate to="/financeiro?tab=faturas" replace />} />
      <Route path="/assinaturas" element={<Navigate to="/financeiro?tab=assinaturas" replace />} />
      
      {/* Settings (includes webhooks, imports, broadcasts) */}
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="/webhooks" element={<Navigate to="/configuracoes?tab=webhooks" replace />} />
      <Route path="/broadcasts" element={<Navigate to="/configuracoes?tab=transmissoes" replace />} />
      <Route path="/importar" element={<Navigate to="/configuracoes?tab=importar" replace />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PrivacyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </PrivacyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
