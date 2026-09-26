import { describe, expect, it, vi } from "vitest";
import {
  MENSAGEM_LIMITE_ENVIO,
  MENSAGEM_LINK_INVALIDO,
  MENSAGEM_RESET_EMAIL_NEUTRA,
  ROTA_REDEFINIR_SENHA,
  atualizarSenhaUsuario,
  estabelecerSessaoRecuperacao,
  isLimiteEnvioEmail,
  mensagemErroResetEmail,
  pareceLinkRecuperacaoSenha,
  solicitarRedefinicaoSenha,
  urlRedefinicaoSenha,
  validarNovaSenha,
} from "./auth-senha";

describe("auth-senha", () => {
  it("monta redirectTo com origin atual e rota pública, sem localhost hardcoded", () => {
    expect(urlRedefinicaoSenha("https://financeiro.oficialmaxnutrition.com.br")).toBe(
      `https://financeiro.oficialmaxnutrition.com.br${ROTA_REDEFINIR_SENHA}`,
    );
    expect(urlRedefinicaoSenha("https://financeiro.oficialmaxnutrition.com.br")).not.toContain(
      "localhost",
    );
  });

  it("reconhece 429 e over_email_send_rate_limit", () => {
    expect(isLimiteEnvioEmail({ status: 429 })).toBe(true);
    expect(isLimiteEnvioEmail({ code: "over_email_send_rate_limit" })).toBe(true);
    expect(isLimiteEnvioEmail({ message: "Email rate limit exceeded" })).toBe(true);
    expect(mensagemErroResetEmail({ status: 429 })).toBe(MENSAGEM_LIMITE_ENVIO);
    expect(isLimiteEnvioEmail({ message: "invalid login" })).toBe(false);
  });

  it("valida senha nova e confirmação", () => {
    expect(validarNovaSenha("", "")).toBe("Preencha a senha e a confirmação.");
    expect(validarNovaSenha("curta", "curta")).toMatch(/pelo menos 8/);
    expect(validarNovaSenha("senha-valida", "outra-senha")).toBe(
      "A senha e a confirmação não coincidem.",
    );
    expect(validarNovaSenha("senha-valida", "senha-valida")).toBeNull();
  });

  it("identifica parâmetros de recuperação na URL", () => {
    expect(pareceLinkRecuperacaoSenha("?type=recovery", "")).toBe(true);
    expect(pareceLinkRecuperacaoSenha("?token_hash=abc&type=recovery", "")).toBe(true);
    expect(pareceLinkRecuperacaoSenha("", "#access_token=xyz&type=recovery")).toBe(true);
    expect(
      pareceLinkRecuperacaoSenha(
        "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
        "",
      ),
    ).toBe(true);
    expect(pareceLinkRecuperacaoSenha("", "")).toBe(false);
    expect(pareceLinkRecuperacaoSenha("?authorization_id=abc", "")).toBe(false);
  });

  it("solicita redefinição com redirectTo do domínio atual e mensagem neutra", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const resultado = await solicitarRedefinicaoSenha(
      { resetPasswordForEmail },
      "  fundador@maxnutrition.com.br  ",
      "https://financeiro.oficialmaxnutrition.com.br",
    );

    expect(resetPasswordForEmail).toHaveBeenCalledWith("fundador@maxnutrition.com.br", {
      redirectTo: "https://financeiro.oficialmaxnutrition.com.br/redefinir-senha",
    });
    expect(resultado).toEqual({ ok: true, mensagem: MENSAGEM_RESET_EMAIL_NEUTRA });
  });

  it("não revela existência do e-mail e trata limite de envio", async () => {
    const resetOk = vi.fn().mockResolvedValue({ error: null });
    const neutra = await solicitarRedefinicaoSenha({ resetPasswordForEmail: resetOk }, "a@b.com", "https://app.test");
    expect(neutra.mensagem).toBe(MENSAGEM_RESET_EMAIL_NEUTRA);
    expect(neutra.mensagem.toLowerCase()).not.toContain("não encontrado");
    expect(neutra.mensagem.toLowerCase()).not.toContain("não existe");

    const reset429 = vi.fn().mockResolvedValue({
      error: { status: 429, code: "over_email_send_rate_limit", message: "rate limit" },
    });
    const limitado = await solicitarRedefinicaoSenha(
      { resetPasswordForEmail: reset429 },
      "a@b.com",
      "https://app.test",
    );
    expect(limitado).toEqual({ ok: false, mensagem: MENSAGEM_LIMITE_ENVIO });
  });

  it("estabelece sessão via PKCE (?code=) e reutiliza sessão se o code já foi trocado", async () => {
    const auth = {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn(),
      getSession: vi.fn(),
    };
    await expect(
      estabelecerSessaoRecuperacao(auth, "https://app.test/redefinir-senha?code=pkce-123"),
    ).resolves.toEqual({ status: "pronta" });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-123");

    const jaTrocado = {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "invalid flow state" } }),
      verifyOtp: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } } }),
    };
    await expect(
      estabelecerSessaoRecuperacao(jaTrocado, "https://app.test/redefinir-senha?code=usado"),
    ).resolves.toEqual({ status: "pronta" });
  });

  it("estabelece sessão via token_hash e marca link expirado", async () => {
    const ok = {
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn(),
    };
    await expect(
      estabelecerSessaoRecuperacao(
        ok,
        "https://app.test/redefinir-senha?token_hash=hash-1&type=recovery",
      ),
    ).resolves.toEqual({ status: "pronta" });
    expect(ok.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "recovery" });

    const expirado = {
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn().mockResolvedValue({ error: { message: "Email link is invalid or has expired" } }),
      getSession: vi.fn(),
    };
    await expect(
      estabelecerSessaoRecuperacao(
        expirado,
        "https://app.test/redefinir-senha?token_hash=velho&type=recovery",
      ),
    ).resolves.toEqual({ status: "invalida", mensagem: MENSAGEM_LINK_INVALIDO });
  });

  it("trata fluxo implícito, erro na URL e ausência de token", async () => {
    const comSessao = {
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } } }),
    };
    await expect(
      estabelecerSessaoRecuperacao(
        comSessao,
        "https://app.test/redefinir-senha#access_token=abc&type=recovery",
      ),
    ).resolves.toEqual({ status: "pronta" });

    const erroUrl = {
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      getSession: vi.fn(),
    };
    await expect(
      estabelecerSessaoRecuperacao(
        erroUrl,
        "https://app.test/redefinir-senha?error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).resolves.toEqual({ status: "invalida", mensagem: MENSAGEM_LINK_INVALIDO });

    const ausente = {
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    };
    await expect(
      estabelecerSessaoRecuperacao(ausente, "https://app.test/redefinir-senha"),
    ).resolves.toEqual({ status: "ausente" });
  });

  it("atualiza senha só após validação mínima", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const invalida = await atualizarSenhaUsuario({ updateUser }, "abc", "abc");
    expect(invalida.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();

    const ok = await atualizarSenhaUsuario({ updateUser }, "nova-senha-ok", "nova-senha-ok");
    expect(updateUser).toHaveBeenCalledWith({ password: "nova-senha-ok" });
    expect(ok.ok).toBe(true);
  });
});
