import React, { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/auth";
import { FormularioNovaSenha } from "@/components/FormularioNovaSenha";
import { supabase } from "@/lib/supabase";
import {
  atualizarSenhaUsuario,
  estabelecerSessaoRecuperacao,
  solicitarRedefinicaoSenha,
  type ResultadoSessaoRecuperacao,
} from "@/lib/auth-senha";

export default function RedefinirSenha() {
  const location = useLocation();
  const navigate = useNavigate();
  const { passwordRecovery, concluirRecuperacaoSenha, sair } = useAuth();

  const [sessao, setSessao] = useState<ResultadoSessaoRecuperacao | null>(
    passwordRecovery ? { status: "pronta" } : null,
  );
  const [email, setEmail] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function processar() {
      const href = `${window.location.origin}${location.pathname}${location.search}${location.hash}`;
      const resultado = await estabelecerSessaoRecuperacao(supabase.auth, href);
      if (cancelado) return;
      if (passwordRecovery && resultado.status !== "invalida") {
        setSessao({ status: "pronta" });
        return;
      }
      setSessao(resultado);
    }

    void processar();
    return () => {
      cancelado = true;
    };
  }, [location.hash, location.pathname, location.search, passwordRecovery]);

  async function onSalvarSenha(senha: string, confirmacao: string) {
    setEnviando(true);
    setErro("");
    setAviso("");
    const resultado = await atualizarSenhaUsuario(supabase.auth, senha, confirmacao);
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setEnviando(false);
      return;
    }

    setSucesso(true);
    concluirRecuperacaoSenha();
    await sair();
    setEnviando(false);
    window.setTimeout(() => {
      navigate("/login?senha=redefinida", { replace: true });
    }, 1200);
  }

  async function onPedirNovoLink(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setErro("");
    setAviso("");
    const resultado = await solicitarRedefinicaoSenha(
      supabase.auth,
      email,
      window.location.origin,
    );
    if (resultado.ok) {
      setAviso(resultado.mensagem);
    } else {
      setErro(resultado.mensagem);
    }
    setEnviando(false);
  }

  const carregando = sessao === null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#F7F8F7] dark:bg-[#101312] antialiased">
      <div className="w-full max-w-[400px]">
        <div
          className="rounded-2xl border border-border bg-card p-8 sm:p-9 shadow-sm"
          style={{ boxShadow: "0 4px 20px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex flex-col items-center text-center space-y-4 pb-2">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#007A3D] text-white shadow-sm">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Redefinir senha
              </h1>
              <p className="text-xs text-muted-foreground">
                Sistema Helena · Escolha uma nova senha de acesso
              </p>
            </div>
          </div>

          {carregando && (
            <div className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-[#007A3D]" />
              <span>Validando o link de redefinição…</span>
            </div>
          )}

          {sucesso && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#007A3D]/25 bg-[#007A3D]/5 p-3 text-xs text-[#007A3D] dark:text-[#4ade80]">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">Senha atualizada. Redirecionando para o login…</span>
            </div>
          )}

          {erro && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#B91C1C]/25 bg-[#B91C1C]/5 p-3 text-xs text-[#B91C1C] dark:text-[#f87171]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{erro}</span>
            </div>
          )}

          {aviso && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#007A3D]/25 bg-[#007A3D]/5 p-3 text-xs text-[#007A3D] dark:text-[#4ade80]">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{aviso}</span>
            </div>
          )}

          {!carregando && !sucesso && sessao?.status === "pronta" && (
            <div className="mt-5">
              <FormularioNovaSenha onSubmit={onSalvarSenha} enviando={enviando} />
            </div>
          )}

          {!carregando && !sucesso && sessao?.status !== "pronta" && (
            <div className="mt-5 space-y-4">
              {sessao?.status === "invalida" && (
                <p className="text-xs text-muted-foreground leading-relaxed text-center">
                  {sessao.mensagem} Informe o e-mail da conta para receber um novo link.
                </p>
              )}
              {sessao?.status === "ausente" && (
                <p className="text-xs text-muted-foreground leading-relaxed text-center">
                  Informe o e-mail da conta. Se estiver cadastrado, enviaremos as instruções.
                </p>
              )}

              <form onSubmit={onPedirNovoLink} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email-redefinicao"
                    className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    E-mail Corporativo
                  </label>
                  <input
                    id="email-redefinicao"
                    type="email"
                    required
                    placeholder="fundador@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={enviando}
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-[#007A3D] focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#007A3D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#006030] focus:outline-none focus:ring-2 focus:ring-[#007A3D] focus:ring-offset-2 disabled:opacity-60 cursor-pointer"
                >
                  {enviando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enviando…</span>
                    </>
                  ) : (
                    <span>Enviar link de redefinição</span>
                  )}
                </button>
              </form>
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-border/60 text-center">
            <Link
              to="/login"
              className="text-xs font-medium text-[#007A3D] hover:underline"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
