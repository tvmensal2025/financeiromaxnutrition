import React, { FormEvent, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { ExecutiveLogo } from "@/components/executive/ExecutiveLogo";
import { AlertCircle, Lock, Mail, ArrowRight, Loader2, ShieldCheck } from "lucide-react";

/**
 * Validação de segurança para URLs de retorno pós-login (proteção contra Open Redirect).
 */
function getSafeRedirect(target: string | null): string {
  if (!target) return "/";
  if (target.startsWith("/") && !target.startsWith("//") && !target.includes("://")) {
    return target;
  }
  return "/";
}

export default function Login() {
  const { user, appAccess, loading, entrar } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const rawRedirect = searchParams.get("redirect");
  const destino = getSafeRedirect(rawRedirect);

  // Se já estiver autenticado e autorizado com app_access ativo, segue para o destino solicitado
  if (!loading && user && appAccess?.active) {
    return <Navigate to={destino} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || !senha) return;

    setEnviando(true);
    setErro("");

    const msgErro = await entrar(email.trim(), senha);
    if (msgErro) {
      setErro(msgErro);
    }
    setEnviando(false);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#F7F8F7] dark:bg-[#101312] antialiased">
      <div className="w-full max-w-[400px]">
        {/* Card Executivo Minimalista */}
        <div
          className="rounded-2xl border border-border bg-card p-8 sm:p-9 shadow-sm"
          style={{ boxShadow: "0 4px 20px 0 rgba(0, 0, 0, 0.03)" }}
        >
          {/* Logo e Título */}
          <div className="flex flex-col items-center text-center space-y-4 pb-2">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#007A3D] text-white text-xl font-bold shadow-sm">
              H
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Acesso à Central Executiva
              </h1>
              <p className="text-xs text-muted-foreground">
                Sistema Helena · Ambiente de Gestão do Fundador
              </p>
            </div>
          </div>

          {/* Aviso Contextual de Redirecionamento */}
          {rawRedirect && (
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[#007A3D]/25 bg-[#007A3D]/5 p-3 text-xs text-[#007A3D] dark:text-[#4ade80]">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="leading-snug">
                {rawRedirect.includes("oauth")
                  ? "Autenticação necessária para autorizar a conexão ao Helena Gateway."
                  : "Autenticação necessária para prosseguir à página solicitada."}
              </span>
            </div>
          )}

          {/* Mensagem de Erro */}
          {erro && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#B91C1C]/25 bg-[#B91C1C]/5 p-3 text-xs text-[#B91C1C] dark:text-[#f87171]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{erro}</span>
            </div>
          )}

          {/* Formulário de Acesso */}
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                E-mail Corporativo
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="fundador@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={enviando}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-[#007A3D] focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="senha"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Senha de Acesso
                </label>
              </div>
              <div className="relative">
                <input
                  id="senha"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={enviando}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-[#007A3D] focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#007A3D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#006030] focus:outline-none focus:ring-2 focus:ring-[#007A3D] focus:ring-offset-2 disabled:opacity-60 cursor-pointer"
            >
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Autenticando…</span>
                </>
              ) : (
                <>
                  <span>Entrar na Central</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé Seguro */}
          <div className="mt-8 pt-5 border-t border-border/60 text-center">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Acesso restrito ao Fundador e usuários previamente autorizados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
