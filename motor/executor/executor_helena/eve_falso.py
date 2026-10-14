"""Servidor da EVE DE MENTIRA, só para testes: imita a API HTTP de sessão da EVE 0.79.0 em 127.0.0.1.

Rotas e eventos copiados de docs/concepts/sessions-runs-and-streaming.md e dist/src/protocol/message.d.ts do pacote
(veja adaptador_eve.py). O que vem do CÓDIGO do pacote (e não da documentação) está marcado: `details.statusCode` e
`details.semanticErrorId` do MODEL_CALL_FAILED. Serve para provar o caminho do adaptador, não a EVE real.

Uso:
    with ServidorEveFalso("boa", token="t") as servidor:
        ExecutorEve(ConfigDaEve(url_base=servidor.url, token="t", ...)).rodar(execucao)
"""

import json
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, List, Optional

TEXTO_PADRAO = json.dumps({"acao": "ENTREGAR", "conteudo": "Resposta de teste."}, ensure_ascii=False)
TEXTO_FORMATO_ERRADO = "Aqui está a minha resposta, mas sem nenhuma ação no formato combinado."
VERSAO_DO_FLUXO = "26"

# Falha do modelo como a EVE grava (code MODEL_CALL_FAILED; details lidos do código do pacote).
FALHA_DO_MODELO = {
    "erro_429": (429, "gateway-rate-limited"), "login_recusado": (401, "gateway-auth-invalid-api-key"),
    "erro_500": (503, "gateway-upstream-unavailable"),
}

MODOS = ("boa", "formato_errado", "resposta_vazia", "lenta", "cancelamento_ignorado", "completa_no_corte",
         "queda_no_meio", "erro_429", "login_recusado", "erro_500", "erro_estranho", "saida_cortada", "modelo_trocado",
         "ferramenta_usada", "rota_recusa", "sem_versao", "linha_quebrada", "com_repeticao", "uso_estranho")


class ServidorEveFalso:
    def __init__(self, modo: str, *, token: Optional[str] = None, modelo: str = "openai/gpt-6-sol"):
        if modo not in MODOS:
            raise ValueError(f"modo desconhecido: {modo}")
        self.modo, self.token, self.modelo = modo, token, modelo
        self.pedidos: List[Dict] = []                 # (método, caminho, tinha_credencial) de cada pedido recebido
        self.cancelados: Dict[str, threading.Event] = {}
        self._servidor = ThreadingHTTPServer(("127.0.0.1", 0), self._manipulador())
        self._servidor.daemon_threads = True
        self._linha = threading.Thread(target=self._servidor.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self._servidor.server_address[1]}"

    def __enter__(self):
        self._linha.start()
        return self

    def __exit__(self, *erro):
        for evento in self.cancelados.values():
            evento.set()
        self._servidor.shutdown()
        self._servidor.server_close()

    # --- eventos -------------------------------------------------------------------------------------
    def _eventos(self, sessao: str, cancelado: threading.Event):
        """Gera (evento | None para 'feche a conexão agora')."""
        n = [0]

        def ev(tipo, **dados):
            n[0] += 1
            return {"type": tipo, "data": dados, "meta": {"id": f"evt_{sessao}_{n[0]:04d}", "at": "2026-10-14T00:00:00.000Z"}}

        turno = {"turnId": "turn_0"}
        modo = self.modo
        yield ev("session.started")
        yield ev("turn.started", **turno)
        yield ev("message.received", message="(pedido)", **turno)
        yield ev("step.started", modelId=self.modelo, sequence=0, stepIndex=0, **turno)
        if modo in ("lenta", "cancelamento_ignorado", "completa_no_corte"):
            yield ev("message.appended", messageDelta="pensando...", sequence=1, stepIndex=0, **turno)
            for _ in range(1200):
                if cancelado.is_set():
                    break
                time.sleep(0.05)
            if modo == "cancelamento_ignorado":
                time.sleep(60)
                return
            if modo == "completa_no_corte":        # o turno terminou sozinho no instante do corte
                yield ev("turn.completed", sequence=2, **turno)
                return
            yield ev("turn.cancelled", sequence=2, **turno)
            yield ev("session.waiting", continuationToken=sessao, wait="next-user-message")
            return
        if modo == "queda_no_meio":
            yield ev("message.appended", messageDelta="metade", sequence=1, stepIndex=0, **turno)
            yield None
            return
        if modo == "linha_quebrada":
            yield "isto não é json"
            return
        if modo in FALHA_DO_MODELO or modo == "erro_estranho":
            if modo == "erro_estranho":
                falha = {"code": "ALGO_QUE_NINGUEM_CONHECE", "message": "?"}
            else:
                status, semantico = FALHA_DO_MODELO[modo]
                falha = {"code": "MODEL_CALL_FAILED", "message": "falha simulada",
                         "details": {"statusCode": status, "semanticErrorId": semantico, "errorId": "err_1"}}
            yield ev("step.failed", sequence=1, stepIndex=0, **falha, **turno)
            yield ev("turn.failed", sequence=2, terminal=False, **falha, **turno)
            yield ev("session.waiting", continuationToken=sessao, wait="next-user-message")
            return
        if modo == "ferramenta_usada":
            yield ev("actions.requested", sequence=1, stepIndex=0,
                     actions=[{"kind": "tool-call", "callId": "c1", "toolName": "bash", "input": {}}], **turno)
            yield ev("action.result", sequence=2, stepIndex=0, callId="c1", **turno)
            yield ev("step.completed", finishReason="tool-calls", sequence=3, stepIndex=0,
                     usage={"inputTokens": 50, "outputTokens": 5}, **turno)
            yield ev("step.started", modelId=self.modelo, sequence=4, stepIndex=1, **turno)
        if modo == "com_repeticao":
            # SUPOSIÇÃO de forma: o cliente oficial procura `data.error.code === "MODEL_CALL_ATTEMPT_RETRIED"`, mas o
            # tipo do evento que leva esse campo não está documentado; aqui vai num step.failed seguido de sucesso.
            yield ev("step.failed", sequence=1, stepIndex=0, code="MODEL_CALL_FAILED", message="tentativa",
                     error={"code": "MODEL_CALL_ATTEMPT_RETRIED"}, **turno)
        if modo == "modelo_trocado":
            yield ev("step.completed", finishReason="other", sequence=1, stepIndex=0, usage={"inputTokens": 10}, **turno)
            yield ev("step.started", modelId="anthropic/claude-reserva", sequence=2, stepIndex=1, **turno)
        texto = {"formato_errado": TEXTO_FORMATO_ERRADO, "resposta_vazia": ""}.get(modo, TEXTO_PADRAO)
        motivo = "length" if modo == "saida_cortada" else "stop"
        yield ev("message.appended", messageDelta=texto[:5], sequence=5, stepIndex=0, **turno)
        yield ev("message.completed", message=texto, finishReason=motivo, sequence=6, stepIndex=0, **turno)
        uso = {"inputTokens": "muitos", "outputTokens": None} if modo == "uso_estranho" else \
            {"inputTokens": 120, "outputTokens": 8, "costUsd": 0.002}
        yield ev("step.completed", finishReason=motivo, sequence=7, stepIndex=0, usage=uso, **turno)
        yield ev("turn.completed", sequence=8, **turno)
        yield ev("session.waiting", continuationToken=sessao, wait="next-user-message",
                 usage={"inputTokens": 120, "outputTokens": 8})

    # --- HTTP ----------------------------------------------------------------------------------------
    def _manipulador(self):
        dono = self

        class Manipulador(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args):
                pass

            def _credencial_ok(self) -> bool:
                recebida = self.headers.get("authorization")
                dono.pedidos.append({"metodo": self.command, "caminho": self.path, "com_credencial": bool(recebida)})
                if dono.modo == "rota_recusa":
                    return False
                return dono.token is None or recebida == f"Bearer {dono.token}"

            def _json(self, status: int, corpo: dict, extras: Optional[dict] = None):
                dados = json.dumps(corpo).encode()
                self.send_response(status)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(dados)))
                for nome, valor in (extras or {}).items():
                    self.send_header(nome, valor)
                self.end_headers()
                self.wfile.write(dados)

            def do_POST(self):
                tamanho = int(self.headers.get("content-length") or 0)
                corpo = self.rfile.read(tamanho) if tamanho else b""
                if not self._credencial_ok():
                    return self._json(401, {"code": "authentication_required"}, {"www-authenticate": "Bearer"})
                partes = self.path.split("?")[0].strip("/").split("/")
                if partes == ["eve", "v1", "session"]:
                    try:
                        mensagem = json.loads(corpo or b"{}").get("message")
                    except ValueError:
                        mensagem = None
                    if not isinstance(mensagem, str) or not mensagem.strip():
                        return self._json(400, {"code": "invalid_request"})
                    sessao = f"wrun_{uuid.uuid4().hex[:12]}"
                    dono.cancelados[sessao] = threading.Event()
                    return self._json(202, {"sessionId": sessao}, {"x-eve-session-id": sessao})
                if len(partes) == 5 and partes[:3] == ["eve", "v1", "session"] and partes[4] == "cancel":
                    evento = dono.cancelados.get(partes[3])
                    if evento is None:
                        return self._json(200, {"ok": True, "status": "no_active_turn"})
                    evento.set()
                    return self._json(202, {"ok": True, "sessionId": partes[3], "status": "accepted"})
                return self._json(404, {"code": "not_found"})

            def do_GET(self):
                if not self._credencial_ok():
                    return self._json(401, {"code": "authentication_required"})
                partes = self.path.split("?")[0].strip("/").split("/")
                if not (len(partes) == 5 and partes[:3] == ["eve", "v1", "session"] and partes[4] == "stream"):
                    return self._json(404, {"code": "not_found"})
                cancelado = dono.cancelados.get(partes[3])
                if cancelado is None:
                    return self._json(404, {"code": "session_not_found"})
                self.send_response(200)
                self.send_header("content-type", "application/x-ndjson")
                if dono.modo != "sem_versao":
                    self.send_header("x-eve-stream-version", VERSAO_DO_FLUXO)
                self.send_header("connection", "close")
                self.end_headers()
                try:
                    for evento in dono._eventos(partes[3], cancelado):
                        if evento is None:
                            self.close_connection = True
                            return
                        linha = evento if isinstance(evento, str) else json.dumps(evento, ensure_ascii=False)
                        self.wfile.write(linha.encode() + b"\n")
                        self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    return

        return Manipulador
