"""Prova offline do auth de hermes-agent 0.19.0 com tokens sintéticos.

Execute com PYTHONPATH apontando ao sdist oficial extraído. Nenhuma rede é usada.
"""

import json
import os
import shutil
import tempfile
from pathlib import Path

import hermes_cli.auth as auth
from executor_helena.segredos import segredos_na_pasta


with tempfile.TemporaryDirectory(prefix="helena-hermes-auth-") as temporario:
    base = Path(temporario)
    raiz = base / "hermes-home"
    raiz.mkdir()
    casa = base / "home-vazio"
    casa.mkdir()
    codex = base / "codex-vazio"
    codex.mkdir()
    os.environ["HOME"] = str(casa)
    os.environ["CODEX_HOME"] = str(codex)

    antigo = {"access_token": "ACESSO_SINTETICO_ANTIGO", "refresh_token": "REFRESH_SINTETICO_ANTIGO"}
    novo = {"access_token": "ACESSO_SINTETICO_NOVO", "refresh_token": "REFRESH_SINTETICO_NOVO"}
    estado = {"version": 1, "providers": {"openai-codex": {"tokens": antigo, "auth_mode": "chatgpt"}}}
    (raiz / "auth.json").write_text(json.dumps(estado), encoding="utf-8")

    def refresh_simulado(access_token, refresh_token, timeout_seconds):
        if refresh_token == antigo["refresh_token"]:
            return novo
        raise AssertionError("refresh recebeu token inesperado")

    auth.refresh_codex_oauth_pure = refresh_simulado
    auth._codex_access_token_is_expiring = lambda _token, _skew: True
    perfil = raiz / "profiles" / "exec-E1"
    perfil.mkdir(parents=True)
    os.environ["HERMES_HOME"] = str(perfil)
    resultado = auth.resolve_codex_runtime_credentials()
    raiz_depois = json.loads((raiz / "auth.json").read_text(encoding="utf-8"))
    perfil_depois = json.loads((perfil / "auth.json").read_text(encoding="utf-8"))

    print("leu_login_da_raiz=", resultado["source"] == "hermes-auth-store")
    print("renovou_em_perfil=", perfil_depois["providers"]["openai-codex"]["tokens"] == novo)
    print("raiz_permaneceu_antiga=", raiz_depois["providers"]["openai-codex"]["tokens"] == antigo)
    print("conferencia_detecta_auth_no_perfil=", any(motivo == "ARQUIVO_DE_CREDENCIAL"
          for _arquivo, motivo in segredos_na_pasta(perfil)))

    shutil.rmtree(perfil)
    proximo = raiz / "profiles" / "exec-E2"
    proximo.mkdir()
    os.environ["HERMES_HOME"] = str(proximo)
    seguinte = auth._read_codex_tokens()
    print("proximo_perfil_leu_token_antigo=", seguinte["tokens"] == antigo)

    def refresh_com_token_antigo_rejeitado(_access_token, _refresh_token, *, timeout_seconds):
        raise auth.AuthError("refresh token já consumido (simulação)", provider="openai-codex",
                             code="invalid_grant", relogin_required=True)

    auth.refresh_codex_oauth_pure = refresh_com_token_antigo_rejeitado
    try:
        auth.resolve_codex_runtime_credentials()
    except auth.AuthError as erro:
        print("segundo_perfil_falha_sem_codex_home=", erro.code == "invalid_grant")
    else:
        print("segundo_perfil_falha_sem_codex_home=", False)
