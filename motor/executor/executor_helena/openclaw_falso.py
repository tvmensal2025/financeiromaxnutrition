"""OpenClaw DE MENTIRA, só para testes: imita o `openclaw agent exec --json` do OpenClaw 2026.10.3.

Script autônomo (não importa o pacote): o adaptador o lança como lançaria o binário de verdade,
`python openclaw_falso.py --simular <modo> agent exec ...`. O formato do envelope, os códigos de saída e as
regras das opções vêm de docs/cli/agent.md do OpenClaw (veja adaptador_openclaw.py). O que a documentação não
publica está marcado SUPOSIÇÃO: os valores de `error.kind` usados aqui são do vocabulário do NOSSO núcleo,
não do OpenClaw; servem para testar o caminho, não provam o OpenClaw real.

Além de responder, ele confere o que o adaptador mandou e sai com 64 (uso errado) quando algo foge do combinado:
`--fallback` passado, `--auth-env-only` junto com `--config`, config que não nega todas as ferramentas, ambiente
com cara de segredo, OPENCLAW_HOME ausente. Nunca escreve na pasta de trabalho do agente.
"""

import json
import os
import re
import signal
import sys
import time

TEXTO_PADRAO = json.dumps({"acao": "ENTREGAR", "conteudo": "Resposta de teste."}, ensure_ascii=False)
TEXTO_FORMATO_ERRADO = "Aqui está a minha resposta, mas sem nenhuma ação no formato combinado."
USO_ERRADO = 64
NOME_DE_SEGREDO = re.compile(r"(KEY|TOKEN|SECRET|PASSW|SENHA|CREDENTIAL|BEARER)", re.I)

# SUPOSIÇÃO: o OpenClaw não publica a lista de `error.kind`.
KIND_DE = {"erro_429": "rate_limit_exceeded", "login_recusado": "invalid_api_key", "erro_500": "server_error",
           "erro_estranho": "algo_que_ninguem_conhece"}


def _recusar(motivo: str) -> None:
    sys.stderr.write(f"openclaw_falso: uso errado: {motivo}\n")
    sys.exit(USO_ERRADO)


def _opcoes(argumentos):
    """Lê as opções de `agent exec`. Devolve um dict; repetíveis (`--fallback`) viram lista."""
    lidas, i = {}, 0
    sem_valor = {"--json", "--auth-env-only", "--no-auth-env-only", "--isolated", "--local-model-lean"}
    while i < len(argumentos):
        nome = argumentos[i]
        if not nome.startswith("--"):
            lidas.setdefault("mensagem", nome)
            i += 1
            continue
        if nome in sem_valor:
            lidas[nome] = True
            i += 1
            continue
        if i + 1 >= len(argumentos):
            _recusar(f"{nome} sem valor")
        lidas.setdefault(nome, []).append(argumentos[i + 1])
        i += 2
    return lidas


def _um(lidas, nome):
    valores = lidas.get(nome)
    if valores is None:
        return None
    if len(valores) != 1:
        _recusar(f"{nome} repetido")
    return valores[0]


def main(argv) -> int:
    if len(argv) < 2 or argv[0] != "--simular":
        _recusar("falta --simular <modo>")
    modo, resto = argv[1], argv[2:]
    if resto[:2] != ["agent", "exec"]:
        _recusar("só `agent exec` é imitado")
    lidas = _opcoes(resto[2:])
    if "--fallback" in lidas:
        _recusar("--fallback passado: o adaptador nunca pode pedir modelo reserva")
    if lidas.get("--auth-env-only") and "--config" in lidas:
        _recusar("--auth-env-only junto com --config (a documentação rejeita)")
    if not lidas.get("--json"):
        _recusar("falta --json")
    if ("mensagem" in lidas) == ("--message-file" in lidas):
        _recusar("passe exatamente um: mensagem ou --message-file")
    arquivo = _um(lidas, "--message-file")
    if arquivo is not None and not os.path.isfile(arquivo):
        _recusar("--message-file não existe")
    config = _um(lidas, "--config")
    if config is None:
        _recusar("o adaptador tem de fixar a config (--config)")
    try:
        politica = json.load(open(config, encoding="utf-8")).get("tools", {})
    except (OSError, ValueError, AttributeError):
        _recusar("config ilegível")
    if politica.get("deny") != ["*"]:
        _recusar("a config não nega todas as ferramentas")
    modelo = _um(lidas, "--model") or ""
    if "/" not in modelo:
        _recusar("--model precisa ser provedor/modelo")
    cwd = _um(lidas, "--cwd")
    if cwd is None or not os.path.isdir(cwd) or os.listdir(cwd):
        _recusar("--cwd precisa ser uma pasta vazia")
    if not os.environ.get("OPENCLAW_HOME"):
        _recusar("OPENCLAW_HOME ausente")
    if any(NOME_DE_SEGREDO.search(nome) for nome in os.environ):
        _recusar("ambiente com cara de segredo")
    provedor, nome_do_modelo = modelo.split("/", 1)

    base = {"codeModeEngaged": False, "sessionId": "019-falso", "assistantTurns": 1,
            "usage": {"input": 120, "output": 8, "total": 128}, "toolSummary": {"calls": 0, "tools": [], "totalToolTimeMs": 0}}

    def responder(envelope, codigo):
        sys.stdout.write(json.dumps({**base, **envelope}, ensure_ascii=False))
        sys.stdout.flush()
        return codigo

    def ok(final, **extra):
        return responder({"ok": True, "status": "ok", "final": final, "payloads": [{"text": final}],
                          "model": nome_do_modelo, "provider": provedor, **extra}, 0)

    if modo == "boa":
        return ok(TEXTO_PADRAO)
    if modo == "formato_errado":
        return ok(TEXTO_FORMATO_ERRADO)
    if modo == "resposta_vazia":
        return ok("")
    if modo == "modelo_trocado":
        return responder({"ok": True, "status": "ok", "final": TEXTO_PADRAO, "payloads": [{"text": TEXTO_PADRAO}],
                          "model": "outro-modelo-reserva", "provider": "outro-provedor"}, 0)
    if modo == "ferramenta_usada":
        return ok(TEXTO_PADRAO, toolSummary={"calls": 2, "tools": ["read", "write"], "totalToolTimeMs": 48})
    if modo == "lenta":
        time.sleep(120)
        return ok(TEXTO_PADRAO)
    if modo == "timeout_proprio":
        return responder({"ok": False, "status": "timeout", "final": None, "model": None, "provider": None,
                          "error": {"message": "timed out", "kind": "timeout"}}, 2)
    if modo == "queda_no_meio":
        os.kill(os.getpid(), signal.SIGKILL)
    if modo == "sigterm_externo":                 # morto por SIGTERM de fora: o OpenClaw sai com 143 e sem envelope
        return 143
    if modo == "envelope_quebrado":
        sys.stdout.write("isto não é JSON")
        return 0
    if modo == "status_estranho":
        return responder({"ok": True, "status": "talvez", "final": TEXTO_PADRAO}, 0)
    if modo in KIND_DE:
        return responder({"ok": False, "status": "error", "final": None, "model": None, "provider": None,
                          "error": {"message": "falha simulada", "kind": KIND_DE[modo]}}, 1)
    _recusar(f"modo desconhecido: {modo}")
    return USO_ERRADO


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
