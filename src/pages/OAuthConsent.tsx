import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  ArrowRight,
  ExternalLink,
  Info,
  Server,
  KeyRound,
} from "lucide-react";

interface OAuthClient {
  id?: string;
  name?: string;
  uri?: string;
  logo_uri?: string;
}

interface AuthorizationDetails {
  authorization_id: string;
  redirect_url?: string;
  client?: OAuthClient;
  user?: {
    id: string;
    email: string;
  };
  scope?: string;
}

/**
 * Mapeia escopos OAuth padrão para descrições executivas claras em português.
 */
function getScopeDescription(scopeName: string): { label: string; description: string } {
  const normalized = scopeName.trim().toLowerCase();
  switch (normalized) {
    case "openid":
      return {
        label: "Identidade Segura (OpenID)",
        description: "Verificar sua identidade e autenticação no Sistema Helena.",
      };
    case "email":
      return {
        label: "Endereço de E-mail",
        description: "Visualizar o e-mail corporativo associado à sua conta.",
      };
    case "profile":
      return {
        label: "Perfil do Usuário",
        description: "Acessar informações do seu perfil de usuário.",
      };
    case "offline_access":
      return {
        label: "Acesso Contínuo (Offline Access)",
        description: "Manter a integração ativa para executar rotinas em segundo plano.",
      };
    case "mcp":
    case "helena":
    case "api":
      return {
        label: "Comandos do Helena Gateway (MCP)",
        description: "Executar tarefas e consultar o pipeline de automação da Helena.",
      };
    default:
      return {
        label: scopeName,
        description: `Permissão para a funcionalidade: ${scopeName}.`,
      };
  }
}

export default function OAuthConsent() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, appAccess, loading: authLoading, sair } = useAuth();

  const authorizationId = searchParams.get("authorization_id");

  const [detailsLoading, setDetailsLoading] = useState(true);
  const [authDetails, setAuthDetails] = useState<AuthorizationDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<"approving" | "denying" | null>(null);

  // 1. Carrega os detalhes da autorização via Supabase Auth OAuth API
  useEffect(() => {
    // Se ainda estiver validando a sessão, aguarda
    if (authLoading) return;

    // Se não há usuário logado, não faz a requisição (o redirect do render cuidará disso)
    if (!user) {
      setDetailsLoading(false);
      return;
    }

    // Se authorization_id não existe na URL
    if (!authorizationId || !authorizationId.trim()) {
      setErrorMsg("Solicitação de autorização inválida. O parâmetro 'authorization_id' não foi fornecido.");
      setDetailsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchDetails() {
      try {
        setDetailsLoading(true);
        setErrorMsg(null);

        // Chamada oficial à API do Supabase Auth OAuth Server
        const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId!);

        if (!isMounted) return;

        if (error) {
          setErrorMsg(
            error.message ||
              "Não foi possível carregar esta solicitação de autorização. Ela pode ter expirado ou já ter sido processada."
          );
          setDetailsLoading(false);
          return;
        }

        if (data) {
          // Caso a autorização já tenha sido previamente consentida e retorne redirect_url diretamente
          const details = data as AuthorizationDetails;
          if (details.redirect_url && !details.client) {
            window.location.href = details.redirect_url;
            return;
          }

          setAuthDetails(details);
        } else {
          setErrorMsg("Solicitação de autorização inválida.");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMsg(err?.message || "Erro inesperado ao consultar a autorização.");
      } finally {
        if (isMounted) {
          setDetailsLoading(false);
        }
      }
    }

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [authorizationId, user, authLoading]);

  // Redirecionamento se não autenticado: preserva exatamente o retorno com authorization_id
  if (!authLoading && !user) {
    const returnTarget = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTarget)}`} replace />;
  }

  // Usuário autenticado mas sem app_access ativo
  if (!authLoading && user && (!appAccess || !appAccess.active)) {
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
              Sua conta ({user.email}) não possui permissão ativa para autorizar integrações no Sistema Helena.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => sair()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <span>Alternar Conta / Sair</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ação: AUTORIZAR
  async function handleApprove() {
    if (!authorizationId || isProcessing) return;

    try {
      setIsProcessing("approving");
      setErrorMsg(null);

      const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId);

      if (error) {
        setErrorMsg(error.message || "Não foi possível autorizar o acesso. Tente novamente.");
        setIsProcessing(null);
        return;
      }

      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setErrorMsg("Resposta de autorização inesperada do servidor de autenticação.");
        setIsProcessing(null);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao concluir autorização.");
      setIsProcessing(null);
    }
  }

  // Ação: NEGAR
  async function handleDeny() {
    if (!authorizationId || isProcessing) return;

    try {
      setIsProcessing("denying");
      setErrorMsg(null);

      const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId);

      if (error) {
        setErrorMsg(error.message || "Não foi possível registrar a negação. Tente novamente.");
        setIsProcessing(null);
        return;
      }

      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setErrorMsg("Resposta inesperada ao negar a autorização.");
        setIsProcessing(null);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao registrar negação.");
      setIsProcessing(null);
    }
  }

  // Estado 1: Carregamento
  if (authLoading || detailsLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-3 bg-[#F7F8F7] dark:bg-[#101312] text-foreground p-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#007A3D] text-white font-bold text-xl shadow-sm animate-pulse">
          H
        </div>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground animate-pulse text-center">
          Carregando solicitação de autorização…
        </p>
      </div>
    );
  }

  // Estado 2: Erro / Parâmetro inválido
  if (errorMsg && !authDetails) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#F7F8F7] dark:bg-[#101312] antialiased">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 sm:p-9 text-center space-y-5 shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#f87171]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Solicitação Inválida
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {errorMsg}
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007A3D] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#006030]"
            >
              <span>Voltar à Central Executiva</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Lista de escopos solicitados
  const scopesList = authDetails?.scope
    ? authDetails.scope.split(" ").filter((s) => s.trim().length > 0)
    : ["openid", "offline_access"];

  const clientName = authDetails?.client?.name || "Helena Gateway / Grok";
  const clientUri = authDetails?.client?.uri;
  const clientLogo = authDetails?.client?.logo_uri;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#F7F8F7] dark:bg-[#101312] antialiased">
      <div className="w-full max-w-[480px]">
        {/* Card Executivo de Consentimento */}
        <div
          className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6"
          style={{ boxShadow: "0 4px 24px 0 rgba(0, 0, 0, 0.04)" }}
        >
          {/* Cabeçalho de Identidade e Segurança */}
          <div className="flex items-center justify-between pb-4 border-b border-border/70">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#007A3D] text-white font-bold text-base shadow-sm">
                H
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground tracking-tight">
                  Sistema Helena
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Servidor de Autorização OAuth 2.1
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-[#007A3D]/10 px-2.5 py-1 text-[11px] font-medium text-[#007A3D] dark:text-[#4ade80]">
              <Lock className="h-3 w-3" />
              <span>Conexão Segura</span>
            </div>
          </div>

          {/* Título e Apresentação do Solicitante */}
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Autorizar acesso
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Um aplicativo externo está solicitando permissão para interagir com o Sistema Helena.
            </p>
          </div>

          {/* Bloco do Aplicativo Solicitante */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
            <div className="flex items-center gap-3">
              {clientLogo ? (
                <img
                  src={clientLogo}
                  alt={clientName}
                  className="h-10 w-10 rounded-lg object-contain border border-border bg-background p-1"
                />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-background border border-border text-foreground">
                  <Server className="h-5 w-5 text-[#007A3D]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {clientName}
                </p>
                {clientUri ? (
                  <a
                    href={clientUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors truncate"
                  >
                    <span>{clientUri}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Cliente OAuth Registrado
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Conta autorizadora:</span>
              <span className="font-semibold text-foreground truncate max-w-[220px]">
                {user?.email}
              </span>
            </div>
          </div>

          {/* Mensagem de Erro durante submissão (se houver) */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#B91C1C]/25 bg-[#B91C1C]/5 p-3 text-xs text-[#B91C1C] dark:text-[#f87171]">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Escopos / Permissões Solicitadas */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5 text-[#007A3D]" />
              <span>Permissões Solicitadas</span>
            </div>

            <div className="space-y-2">
              {scopesList.map((scope) => {
                const info = getScopeDescription(scope);
                return (
                  <div
                    key={scope}
                    className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-background p-2.5 text-xs"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#007A3D] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">{info.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {info.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aviso Legal de Gestão */}
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
            <span>
              Ao autorizar, você concede ao cliente o acesso acima. Você poderá revogar esta permissão a qualquer momento na Central Executiva.
            </span>
          </div>

          {/* Ações Explícitas: AUTORIZAR / NEGAR */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleDeny}
              disabled={isProcessing !== null}
              className="w-full sm:w-1/2 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50 cursor-pointer"
            >
              {isProcessing === "denying" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Negando…</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Negar acesso</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={isProcessing !== null}
              className="w-full sm:w-1/2 inline-flex items-center justify-center gap-2 rounded-lg bg-[#007A3D] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#006030] focus:outline-none focus:ring-2 focus:ring-[#007A3D] focus:ring-offset-2 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing === "approving" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Autorizando…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Autorizar acesso</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
