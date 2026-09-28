import type { AuthError, AuthOtpResponse, AuthResponse } from "@supabase/supabase-js";

export const ROTA_REDEFINIR_SENHA = "/redefinir-senha";
export const SENHA_MINIMA = 8;

export const MENSAGEM_RESET_EMAIL_NEUTRA =
  "Se este e-mail estiver cadastrado, enviaremos as instruções para redefinir a senha.";

export const MENSAGEM_LIMITE_ENVIO =
  "Aguarde alguns minutos antes de solicitar um novo e-mail de redefinição.";

export const MENSAGEM_LINK_INVALIDO =
  "Este link de redefinição é inválido ou já expirou. Solicite um novo e-mail.";

export const MENSAGEM_ENVIO_FALHOU =
  "Não foi possível enviar agora. Tente novamente em instantes.";

export const MENSAGEM_SENHA_ATUALIZADA =
  "Senha atualizada. Entre com a nova senha.";

type ErroAuth = {
  status?: number;
  code?: string;
  message?: string;
} | null;

export type AuthRecuperacao = {
  resetPasswordForEmail: (
    email: string,
    options?: { redirectTo?: string },
  ) => Promise<{ error: ErroAuth }>;
  updateUser: (attributes: { password: string }) => Promise<{ error: ErroAuth }>;
  exchangeCodeForSession: (code: string) => Promise<Pick<AuthResponse, "error"> | { error: ErroAuth }>;
  verifyOtp: (params: {
    token_hash: string;
    type: "recovery";
  }) => Promise<Pick<AuthOtpResponse, "error"> | { error: ErroAuth }>;
  getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
};

export type ResultadoSessaoRecuperacao =
  | { status: "pronta" }
  | { status: "invalida"; mensagem: string }
  | { status: "ausente" };

export function urlRedefinicaoSenha(origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${ROTA_REDEFINIR_SENHA}`;
}

export function isLimiteEnvioEmail(error: ErroAuth): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  const code = (error.code || "").toLowerCase();
  const msg = (error.message || "").toLowerCase();
  return (
    code === "over_email_send_rate_limit" ||
    msg.includes("over_email_send_rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("email rate")
  );
}

export function mensagemErroResetEmail(error: ErroAuth): string {
  if (isLimiteEnvioEmail(error)) return MENSAGEM_LIMITE_ENVIO;
  return MENSAGEM_ENVIO_FALHOU;
}

export function mensagemLinkInvalido(_raw?: string | null): string {
  return MENSAGEM_LINK_INVALIDO;
}

export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (!senha.trim() || !confirmacao.trim()) {
    return "Preencha a senha e a confirmação.";
  }
  if (senha.length < SENHA_MINIMA) {
    return `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (senha !== confirmacao) {
    return "A senha e a confirmação não coincidem.";
  }
  return null;
}

export function mensagemErroAtualizarSenha(error: ErroAuth): string {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("same password") || msg.includes("should be different")) {
    return "A nova senha precisa ser diferente da senha atual.";
  }
  if (msg.includes("at least") || msg.includes("too short")) {
    return `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (msg.includes("session") || msg.includes("not authenticated") || msg.includes("jwt")) {
    return MENSAGEM_LINK_INVALIDO;
  }
  return "Não foi possível atualizar a senha. Tente novamente.";
}

function paramsDeUrl(href: string): { query: URLSearchParams; hash: URLSearchParams } {
  const url = new URL(href, "http://localhost");
  return {
    query: url.searchParams,
    hash: new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash),
  };
}

export function pareceLinkRecuperacaoSenha(search = "", hash = ""): boolean {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const type = query.get("type") || hashParams.get("type");
  const errorDescription = (
    query.get("error_description") ||
    hashParams.get("error_description") ||
    ""
  ).toLowerCase();
  const errorCode = (query.get("error_code") || hashParams.get("error_code") || "").toLowerCase();

  if (type === "recovery") return true;
  if (query.get("token_hash") && (type === "recovery" || !type)) return true;
  if (hashParams.get("access_token") && type === "recovery") return true;
  if (errorCode === "otp_expired") return true;
  if (errorDescription.includes("email link") || errorDescription.includes("otp")) return true;
  return false;
}

export async function solicitarRedefinicaoSenha(
  auth: Pick<AuthRecuperacao, "resetPasswordForEmail">,
  email: string,
  origin?: string,
): Promise<{ ok: boolean; mensagem: string }> {
  const endereco = email.trim();
  if (!endereco) {
    return { ok: false, mensagem: "Informe o e-mail cadastrado." };
  }

  const { error } = await auth.resetPasswordForEmail(endereco, {
    redirectTo: urlRedefinicaoSenha(origin),
  });

  if (error) {
    return { ok: false, mensagem: mensagemErroResetEmail(error) };
  }

  return { ok: true, mensagem: MENSAGEM_RESET_EMAIL_NEUTRA };
}

export async function atualizarSenhaUsuario(
  auth: Pick<AuthRecuperacao, "updateUser">,
  senha: string,
  confirmacao: string,
): Promise<{ ok: boolean; mensagem: string }> {
  const erroValidacao = validarNovaSenha(senha, confirmacao);
  if (erroValidacao) {
    return { ok: false, mensagem: erroValidacao };
  }

  const { error } = await auth.updateUser({ password: senha });
  if (error) {
    return { ok: false, mensagem: mensagemErroAtualizarSenha(error as AuthError) };
  }

  return { ok: true, mensagem: MENSAGEM_SENHA_ATUALIZADA };
}

export async function estabelecerSessaoRecuperacao(
  auth: Pick<AuthRecuperacao, "exchangeCodeForSession" | "verifyOtp" | "getSession">,
  href: string,
): Promise<ResultadoSessaoRecuperacao> {
  const { query, hash } = paramsDeUrl(href);
  const errorDesc = query.get("error_description") || hash.get("error_description");
  const errorCode = query.get("error_code") || hash.get("error_code");
  const error = query.get("error") || hash.get("error");

  if (error || errorCode || errorDesc) {
    return { status: "invalida", mensagem: mensagemLinkInvalido(errorDesc || errorCode || error) };
  }

  const tokenHash = query.get("token_hash");
  const type = query.get("type") || hash.get("type");
  const code = query.get("code");

  if (tokenHash) {
    const { error: otpError } = await auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (otpError) {
      return { status: "invalida", mensagem: mensagemLinkInvalido(otpError.message) };
    }
    return { status: "pronta" };
  }

  if (code) {
    const { error: codeError } = await auth.exchangeCodeForSession(code);
    if (!codeError) return { status: "pronta" };
    const { data } = await auth.getSession();
    if (data.session) return { status: "pronta" };
    return { status: "invalida", mensagem: mensagemLinkInvalido(codeError.message) };
  }

  const { data } = await auth.getSession();
  if (data.session) {
    return { status: "pronta" };
  }

  if (type === "recovery" || hash.get("access_token")) {
    return { status: "invalida", mensagem: MENSAGEM_LINK_INVALIDO };
  }

  return { status: "ausente" };
}
