#!/usr/bin/env python3
"""HERMES DE MENTIRA: imita, só no que importa para os testes, o `hermes -z` do hermes-agent 0.19.0.

Existe para a suíte de testes rodar em qualquer máquina, sem instalar o Hermes e sem gastar cota.
Cada comportamento abaixo foi copiado de execuções REAIS do Hermes 0.19.0 contra o servidor falso
(veja verificacao_real/ para rodar os mesmos cenários no Hermes de verdade):

  - lê HERMES_HOME/config.yaml e SOUL.md; a identidade do prompt de sistema é o SOUL.md;
  - --toolsets NOME liga só o servidor MCP com esse nome; sem --toolsets vale a lista do config
    e "hermes-cli" libera ferramentas embutidas (é por isso que a lista vazia libera tudo);
  - o servidor MCP roda em OUTRA sessão (fora do grupo do Hermes), com ambiente filtrado;
    as ferramentas aparecem como mcp__<servidor>__<ferramenta>;
  - procura AGENTS.md/CLAUDE.md/.cursorrules na pasta atual e .hermes.md até a raiz do git; achando,
    põe "# Project Context" no prompt;
  - chamada a ferramenta que não existe: avisa o modelo; na 3ª seguida encerra com uma frase dele;
  - erro do provedor: grava sessions/request_dump_*.json, imprime uma frase dele, sai com código 0 e
    escreve uso.json com failed=true; sem erro HTTP grava só o que houver;
  - queda no meio da resposta: tenta de novo 3 vezes e sai com código 2 sem imprimir nada;
  - resposta vazia: tenta de novo 3 vezes, imprime uma frase dele e marca completed=true;
  - resposta cortada pelo limite do modelo (finish_reason "length"): pede para continuar 3 vezes e termina
    incompleta; conversa grande demais com o resumo automático desligado: imprime uma frase dele, sem erro gravado;
  - teto de 90 voltas ("I reached the iteration limit"), que o -z não deixa mudar;
  - reserva (fallback_providers) configurada é usada na falha: por isso o perfil nunca a tem;
  - na recusa de login (401) adota ~/.codex/auth.json (ou $CODEX_HOME) se existir: o Hermes real só faz
    isso no caminho openai-codex; aqui vale para qualquer provedor para o teste enxergar a trava;
  - grava state.db (sessions e messages) e o arquivo de uso (--usage-file) como o Hermes.

Ganchos de teste dentro do pacote (texto no pedido): [[FILHO_TEIMOSO]] cria um processo que ignora
SIGTERM e mora em outra sessão; [[IGNORAR_SIGTERM]] faz este processo ignorar SIGTERM.
Só usa a biblioteca padrão e PyYAML.
"""

import argparse
import http.client
import json
import os
import queue
import signal
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import yaml

SEGURAS = {"PATH", "HOME", "USER", "LANG", "LC_ALL", "TERM", "SHELL", "TMPDIR"}
EMBUTIDAS = ["terminal", "read_file", "write_file", "patch", "web_search", "web_extract", "memory", "todo"]
IDENTIDADE_PADRAO = "You are Hermes Agent, an intelligent AI assistant created by Nous Research."
MAX_VOLTAS = 90
TEMPO_PARA_CONECTAR_S = 10.0       # o Hermes real espera 60 s (connect_timeout); aqui é menor para o teste não demorar
FRASE_VAZIA = ("⚠️ No reply: the model returned empty content after retries and any fallback providers. "
               "Try `continue`, switch model/provider, or inspect the tool output above.")


class Mcp:
    """Cliente MCP mínimo por stdio (uma mensagem JSON por linha).

    Como o Hermes real, o aperto de mão tem TEMPO LIMITE (`connect_timeout` no config): servidor que não
    responde é largado e o Hermes segue sem as ferramentas dele, em vez de ficar esperando para sempre.
    """

    def __init__(self, nome, cfg):
        self.nome, self.proximo = nome, 0
        ambiente = {k: v for k, v in os.environ.items() if k in SEGURAS or k.startswith("XDG_")}
        ambiente.update({str(k): str(v) for k, v in (cfg.get("env") or {}).items()})
        self.p = subprocess.Popen([cfg["command"], *[str(a) for a in cfg.get("args", [])]], env=ambiente,
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                  text=True, start_new_session=True)
        self.tempo_da_chamada = float(cfg.get("timeout", 300))
        self.linhas = queue.Queue()
        threading.Thread(target=self._ler_linhas, daemon=True).start()
        self.ferramentas = []
        try:
            limite = float(cfg.get("connect_timeout", TEMPO_PARA_CONECTAR_S))
            self.pedir("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                      "clientInfo": {"name": "hermes-falso", "version": "0"}}, limite)
            self.avisar("notifications/initialized")
            lista = self.pedir("tools/list", {}, limite).get("tools", [])
            incluir = (cfg.get("tools") or {}).get("include")
            self.ferramentas = [t["name"] for t in lista if not incluir or t["name"] in incluir]
        except Exception:
            self.ferramentas = []

    def _ler_linhas(self):
        """Lê a saída do servidor numa thread própria; o fim do fluxo vira None na fila."""
        try:
            for linha in self.p.stdout:
                self.linhas.put(linha)
        except (OSError, ValueError):
            pass
        self.linhas.put(None)

    def _enviar(self, mensagem):
        self.p.stdin.write(json.dumps(mensagem) + "\n")
        self.p.stdin.flush()

    def avisar(self, metodo):
        self._enviar({"jsonrpc": "2.0", "method": metodo})

    def pedir(self, metodo, params, limite_s=None):
        self.proximo += 1
        self._enviar({"jsonrpc": "2.0", "id": self.proximo, "method": metodo, "params": params})
        fim = time.monotonic() + (self.tempo_da_chamada if limite_s is None else limite_s)
        while True:
            try:
                linha = self.linhas.get(timeout=max(0.0, fim - time.monotonic()))
            except queue.Empty:
                raise RuntimeError(f"servidor MCP não respondeu a {metodo}") from None
            if linha is None:
                raise RuntimeError("servidor MCP fechou")
            resposta = json.loads(linha)
            if resposta.get("id") == self.proximo:
                if "error" in resposta:
                    raise RuntimeError(resposta["error"].get("message", "erro"))
                return resposta["result"]

    def chamar(self, ferramenta, argumentos):
        try:
            resultado = self.pedir("tools/call", {"name": ferramenta, "arguments": argumentos})
            return "".join(c.get("text", "") for c in resultado.get("content", []))
        except Exception as erro:
            return json.dumps({"error": f"falha ao chamar a ferramenta: {erro}"})

    def fechar(self):
        try:
            self.p.stdin.close()
            self.p.wait(timeout=2)
        except Exception:
            self.p.kill()


class Sessao:
    def __init__(self, home, modelo, provedor, prompt_de_sistema):
        self.id = time.strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]
        self.db = sqlite3.connect(home / "state.db")
        self.db.executescript(
            "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, source TEXT, model TEXT, model_config TEXT,"
            " system_prompt TEXT, started_at REAL, ended_at REAL, end_reason TEXT, billing_provider TEXT,"
            " api_call_count INTEGER DEFAULT 0, message_count INTEGER DEFAULT 0, tool_call_count INTEGER DEFAULT 0);"
            "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, role TEXT,"
            " content TEXT, tool_calls TEXT, tool_name TEXT, finish_reason TEXT, timestamp REAL);")
        self.db.execute("INSERT INTO sessions (id, source, model, model_config, system_prompt, started_at, billing_provider)"
                        " VALUES (?,?,?,?,?,?,?)",
                        (self.id, "cli", modelo, json.dumps({"max_iterations": MAX_VOLTAS}), prompt_de_sistema,
                         time.time(), provedor))
        self.db.commit()

    def mensagem(self, papel, conteudo, chamadas=None, ferramenta=None, finish=None):
        self.db.execute("INSERT INTO messages (session_id, role, content, tool_calls, tool_name, finish_reason, timestamp)"
                        " VALUES (?,?,?,?,?,?,?)", (self.id, papel, conteudo, json.dumps(chamadas) if chamadas else None,
                                                    ferramenta, finish, time.time()))
        self.db.commit()

    def fechar(self, chamadas_api):
        self.db.execute("UPDATE sessions SET ended_at=?, end_reason='agent_close', api_call_count=? WHERE id=?",
                        (time.time(), chamadas_api, self.id))
        self.db.commit()
        self.db.close()


def contexto_do_projeto(cwd: Path) -> str:
    """Mesma ordem do Hermes: .hermes.md (até a raiz do git) > AGENTS.md > CLAUDE.md > .cursorrules."""
    raiz_git = next((p for p in [cwd, *cwd.parents] if (p / ".git").exists()), None)
    pastas = [cwd, *cwd.parents] if raiz_git else [cwd]
    for pasta in pastas:
        for nome in (".hermes.md", "HERMES.md"):
            if (pasta / nome).is_file():
                return f"## {nome}\n\n{(pasta / nome).read_text().strip()}"
        if raiz_git and pasta == raiz_git:
            break
    for nome in ("AGENTS.md", "agents.md", "CLAUDE.md", "claude.md", ".cursorrules"):
        if (cwd / nome).is_file():
            return f"## {nome}\n\n{(cwd / nome).read_text().strip()}"
    return ""


def montar_prompt_de_sistema(home: Path, cwd: Path, modelo: str, provedor: str) -> str:
    soul = home / "SOUL.md"
    if not soul.exists():
        soul.write_text(IDENTIDADE_PADRAO + "\n")
    partes = [soul.read_text().strip(),
              f"Host: Linux\nUser home directory: {os.environ.get('HOME', '')}\nCurrent working directory: {cwd}\n\n"
              f"Active Hermes profile: default.\n\nYou are a CLI AI Agent.\n\nModel: {modelo}\nProvider: {provedor}"]
    contexto = contexto_do_projeto(cwd)
    if contexto:
        partes.append("# Project Context\n\nThe following project context files have been loaded and should be followed:\n\n"
                      + contexto)
    return "\n\n".join(partes)


class ErroHttp(Exception):
    def __init__(self, status, corpo, tipo=None):
        super().__init__(str(status))
        self.status, self.corpo, self.tipo = status, corpo, tipo


def chamar_modelo(base_url, modelo, mensagens, ferramentas, api_key=None):
    corpo = {"model": modelo, "messages": mensagens, "stream": False}
    if ferramentas:
        corpo["tools"] = [{"type": "function", "function": {"name": n, "description": n,
                                                           "parameters": {"type": "object", "properties": {}}}}
                          for n in ferramentas]
    pedido = urllib.request.Request(base_url.rstrip("/") + "/chat/completions", data=json.dumps(corpo).encode(),
                                    headers={"Content-Type": "application/json",
                                             "Authorization": f"Bearer {api_key or 'sem-chave'}"})
    try:
        with urllib.request.urlopen(pedido, timeout=120) as resposta:
            return json.loads(resposta.read())
    except urllib.error.HTTPError as erro:
        try:
            dados = json.loads(erro.read())
        except ValueError:
            dados = {}
        raise ErroHttp(erro.code, dados.get("error", {}) if isinstance(dados, dict) else {}) from None
    except (urllib.error.URLError, http.client.HTTPException, ConnectionError, TimeoutError, OSError, ValueError) as erro:
        raise ErroHttp(None, {}, tipo=type(erro).__name__) from None


def adotar_login_do_codex(home: Path) -> bool:
    origem = Path(os.environ.get("CODEX_HOME") or (Path(os.environ.get("HOME", "")) / ".codex")) / "auth.json"
    if origem.is_file():
        (home / "auth.json").write_text(origem.read_text())
        return True
    return False


def gravar_dump(home: Path, sessao_id: str, motivo: str, erro: ErroHttp):
    pasta = home / "sessions"
    pasta.mkdir(exist_ok=True)
    corpo = erro.corpo or {}
    bloco = {"type": corpo.get("type") or erro.tipo, "message": corpo.get("message") or str(erro.tipo),
             "status_code": erro.status, "code": corpo.get("code"), "body": corpo, "response_status": erro.status}
    (pasta / f"request_dump_{sessao_id}_{time.strftime('%Y%m%d_%H%M%S_%f')}.json").write_text(
        json.dumps({"session_id": sessao_id, "reason": motivo, "request": {"headers": {"Authorization": "Bearer sem-c...ando"}},
                    "error": bloco}))


def principal(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="hermes")
    ap.add_argument("-z", "--oneshot", required=True)
    ap.add_argument("--model")
    ap.add_argument("--provider")
    ap.add_argument("--toolsets")
    ap.add_argument("--usage-file")
    args = ap.parse_args(argv)
    if args.provider and not args.model:
        sys.stderr.write("hermes -z: --provider requires --model.\n")
        return 2
    if "[[IGNORAR_SIGTERM]]" in args.oneshot:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
    home = Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes")
    home.mkdir(parents=True, exist_ok=True)
    for sub in ("sessions", "logs", "memories", "skills"):
        (home / sub).mkdir(exist_ok=True)
    cfg = yaml.safe_load((home / "config.yaml").read_text()) if (home / "config.yaml").exists() else {}
    cfg = cfg or {}
    modelo_cfg = cfg.get("model") if isinstance(cfg.get("model"), dict) else {}
    modelo = args.model or modelo_cfg.get("default") or ""
    provedor = args.provider or modelo_cfg.get("provider") or "auto"
    base_url = modelo_cfg.get("base_url") or ""

    # --- ferramentas ---------------------------------------------------------------------------------
    servidores_cfg = cfg.get("mcp_servers") or {}
    pedidos = [t.strip() for t in (args.toolsets or "").split(",") if t.strip()] or list(cfg.get("toolsets") or ["hermes-cli"])
    escolhidos, embutidas = [], []
    for nome in pedidos:
        if nome in servidores_cfg and (servidores_cfg[nome] or {}).get("enabled", True):
            escolhidos.append(nome)
        elif nome in ("hermes-cli", "all", "*"):
            embutidas = list(EMBUTIDAS)
            escolhidos = [n for n, c in servidores_cfg.items() if (c or {}).get("enabled", True)]
        else:
            sys.stderr.write(f"hermes -z: ignoring unknown --toolsets entries: {nome}\n")
    if args.toolsets and not escolhidos and not embutidas:
        sys.stderr.write("hermes -z: --toolsets did not contain any valid toolsets.\n")
        return 2
    mcp = {}
    for n in escolhidos:
        try:
            mcp[n] = Mcp(n, servidores_cfg[n])
        except OSError:
            pass                                               # servidor que nem nasce: o Hermes segue sem as ferramentas
    nomes = list(embutidas) + [f"mcp__{n}__{t}" for n, m in mcp.items() for t in m.ferramentas]
    mapa = {f"mcp__{n}__{t}": (m, t) for n, m in mcp.items() for t in m.ferramentas}

    if "[[FILHO_TEIMOSO]]" in args.oneshot:
        subprocess.Popen([sys.executable, "-c", "import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(600)"],
                         start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    cwd = Path.cwd()
    prompt = montar_prompt_de_sistema(home, cwd, modelo, provedor)
    sessao = Sessao(home, modelo, provedor, prompt)
    mensagens = [{"role": "system", "content": prompt}, {"role": "user", "content": args.oneshot}]
    sessao.mensagem("user", args.oneshot)
    max_tentativas = int((cfg.get("agent") or {}).get("api_max_retries", 3))
    reserva = list(cfg.get("fallback_providers") or [])

    chamadas_api, invalidas_seguidas, vazias, cortes, partes_cortadas = 0, 0, 0, 0, []
    resposta_final, completo, falhou, parcial = None, False, False, False
    login_adotado = False
    destino = {"base_url": base_url, "modelo": modelo, "provedor": provedor}
    modelo_usado = provedor_usado = None
    try:
        while chamadas_api < MAX_VOLTAS:
            chamadas_api += 1
            try:
                dados = chamar_modelo(destino["base_url"], destino["modelo"], mensagens, nomes)
            except ErroHttp as erro:
                if erro.status == 401 and not login_adotado and adotar_login_do_codex(home):
                    login_adotado = True                       # adota o login do Codex UMA vez e tenta de novo;
                    continue                                   # se a recusa continuar, a falha segue o caminho normal
                if erro.status is None and erro.tipo in ("RemoteDisconnected", "IncompleteRead", "ConnectionResetError",
                                                           "ConnectionError", "URLError", "BadStatusLine"):
                    if chamadas_api < 4:
                        continue                               # queda no meio: tenta de novo, como o Hermes
                    parcial = True
                    break
                if reserva and erro.status in (429, 500, 502, 503, 504):
                    escolha = reserva.pop(0)
                    destino = {"base_url": escolha.get("base_url", ""), "modelo": escolha.get("model", ""),
                               "provedor": escolha.get("provider", "")}
                    continue
                if (erro.corpo or {}).get("code") == "context_length_exceeded":
                    falhou = True
                    resposta_final = ("Context overflow and auto-compaction is disabled (compression.enabled: false). "
                                      "Run /compress to compact manually, /new to start fresh, or switch to a larger-context model.")
                    break
                motivo = "non_retryable_client_error" if erro.status and 400 <= erro.status < 500 and erro.status != 429 \
                    else "max_retries_exhausted"
                gravar_dump(home, sessao.id, motivo, erro)
                falhou = True
                trecho = (erro.corpo or {}).get("message") or erro.tipo or "erro"
                resposta_final = f"API call failed after {max_tentativas} retries: HTTP {erro.status}: {trecho}"
                break
            escolha = (dados.get("choices") or [None])[0] if isinstance(dados, dict) else None
            if not escolha:
                gravar_dump(home, sessao.id, "max_retries_exhausted",
                            ErroHttp(None, {}, tipo="EmptyStreamError"))
                falhou = True
                resposta_final = "API call failed after 1 retries: Provider returned an empty stream with no finish_reason"
                break
            modelo_usado, provedor_usado = destino["modelo"], destino["provedor"]
            msg = escolha.get("message") or {}
            chamadas = msg.get("tool_calls") or []
            if chamadas:
                sessao.mensagem("assistant", msg.get("content") or "", chamadas=chamadas, finish=escolha.get("finish_reason"))
                mensagens.append({"role": "assistant", "content": msg.get("content"), "tool_calls": chamadas})
                invalida = False
                for chamada in chamadas:
                    nome = chamada["function"]["name"]
                    if nome not in mapa:
                        invalida = True
                        saida = f"Tool '{nome}' does not exist. Available tools: {', '.join(nomes)}"
                    else:
                        servidor, ferramenta = mapa[nome]
                        try:
                            argumentos = json.loads(chamada["function"].get("arguments") or "{}")
                        except ValueError:
                            argumentos = {}
                        saida = servidor.chamar(ferramenta, argumentos)
                    sessao.mensagem("tool", saida, ferramenta=nome)
                    mensagens.append({"role": "tool", "tool_call_id": chamada.get("id"), "content": saida})
                invalidas_seguidas = invalidas_seguidas + 1 if invalida else 0
                if invalidas_seguidas >= 3:
                    resposta_final = f"Model generated invalid tool call: {chamadas[-1]['function']['name']}"
                    break
                continue
            texto = msg.get("content") or ""
            if not texto.strip():
                vazias += 1
                sessao.mensagem("assistant", "", finish=escolha.get("finish_reason"))
                if vazias < 4:
                    continue
                resposta_final, completo = FRASE_VAZIA, True
                break
            sessao.mensagem("assistant", texto, finish=escolha.get("finish_reason"))
            if escolha.get("finish_reason") == "length":
                cortes += 1
                partes_cortadas.append(texto)
                if cortes <= 3:
                    nudge = "[System: Your previous response was truncated by the output length limit. Continue exactly where you left off.]"
                    mensagens.append({"role": "assistant", "content": texto})
                    mensagens.append({"role": "user", "content": nudge})
                    sessao.mensagem("user", nudge)
                    continue
                resposta_final = "".join(partes_cortadas)
                break
            resposta_final, completo = texto, True
            break
        else:
            resposta_final = "I reached the iteration limit and couldn't generate a summary."
    finally:
        for m in mcp.values():
            m.fechar()
        sessao.fechar(chamadas_api)

    if args.usage_file:
        Path(args.usage_file).write_text(json.dumps({
            "estimated_cost_usd": None, "cost_status": None, "cost_source": None,
            "input_tokens": None if falhou else 10, "output_tokens": None if falhou else 5, "cache_read_tokens": None,
            "cache_write_tokens": None, "reasoning_tokens": None, "total_tokens": None if falhou else 15,
            "api_calls": chamadas_api, "model": None if falhou or parcial else modelo_usado,
            "provider": None if falhou or parcial else provedor_usado, "session_id": None if falhou else sessao.id,
            "completed": completo and not falhou, "failed": falhou, "service_tier": None}, indent=2) + "\n")
    if resposta_final:
        sys.stdout.write(resposta_final if resposta_final.endswith("\n") else resposta_final + "\n")
        sys.stdout.flush()
    if (falhou or parcial) and not (resposta_final or "").strip():
        return 2
    if not (resposta_final or "").strip():
        sys.stderr.write("hermes -z: no final response was produced; treating the run as failed.\n")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(principal())
