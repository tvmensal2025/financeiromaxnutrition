"""Servidor FALSO de provedor: um HTTP local que imita a API de chat do modelo.

Serve para o "teste 3" do plano: no lugar do provedor de verdade, ele GRAVA cada pedido
que o agente (Hermes) faz e responde do jeito que o teste mandar. Assim dá para conferir,
sem gastar cota, quais ferramentas e quais instruções o agente recebeu.

Imita a API "chat/completions" (com resposta normal e em partes/SSE). Simulações:

  BOA                  responde um texto (padrão: um JSON de ação ENTREGAR)
  FORMATO_ERRADO       responde 200 e normal, mas o TEXTO não segue o formato de ação
  RESPOSTA_INVALIDA    responde 200 com um corpo que não é uma resposta de chat
  RESPOSTA_VAZIA       responde 200 com texto vazio
  LACO_DE_FERRAMENTA   pede uma ferramenta de novo a cada volta (padrão: 200 vezes)
  ERRO_429             recusa por cota (HTTP 429, "usage_limit_reached")
  LOGIN_RECUSADO       recusa o login (HTTP 401)
  QUEDA_NO_MEIO        começa a responder e derruba a conexão no meio
  LENTA                espera `atraso_s` segundos antes de responder
  ERRO_500             erro do servidor do provedor (HTTP 503)
  SAIDA_CORTADA        responde um texto cortado pelo limite de tamanho do modelo (finish_reason "length")
  CONTEXTO_GRANDE      recusa por conversa maior que o modelo aceita (HTTP 400, context_length_exceeded)
  ERRO_ESTRANHO        erro que ninguém conhece (HTTP 418)

Nada aqui fala com a internet: só abre uma porta em 127.0.0.1.
"""

import json
import socket
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, List, Optional, Tuple

TEXTO_PADRAO = json.dumps({"acao": "ENTREGAR", "conteudo": "Resposta de teste."}, ensure_ascii=False)
TEXTO_FORMATO_ERRADO = "Aqui está a minha resposta, mas sem nenhuma ação no formato combinado."
NOME_DA_FERRAMENTA_INEXISTENTE = "ferramenta_inexistente"


class Simulacao(Enum):
    BOA = "boa"
    FORMATO_ERRADO = "formato_errado"
    RESPOSTA_INVALIDA = "resposta_invalida"
    RESPOSTA_VAZIA = "resposta_vazia"
    LACO_DE_FERRAMENTA = "laco_de_ferramenta"
    ERRO_429 = "erro_429"
    LOGIN_RECUSADO = "login_recusado"
    QUEDA_NO_MEIO = "queda_no_meio"
    LENTA = "lenta"
    ERRO_500 = "erro_500"
    SAIDA_CORTADA = "saida_cortada"
    CONTEXTO_GRANDE = "contexto_grande"
    ERRO_ESTRANHO = "erro_estranho"


@dataclass(frozen=True)
class Cenario:
    """O que o servidor falso faz com os pedidos de chat."""
    simulacao: Simulacao = Simulacao.BOA
    texto: str = TEXTO_PADRAO          # resposta final (BOA, LENTA e fim do laço)
    voltas_do_laco: int = 200          # LACO_DE_FERRAMENTA: quantas vezes pede ferramenta
    ferramenta: Optional[str] = None   # LACO: nome a chamar (padrão: a 1ª da lista do pedido)
    argumentos: str = '{"url": "https://exemplo.invalid/pagina/{n}"}'   # {n} = número da volta
    atraso_s: float = 0.0              # LENTA: espera antes de responder; LACO: espera em cada volta
    segundos_para_voltar: int = 3600   # ERRO_429: quando a cota volta


@dataclass(frozen=True)
class PedidoRecebido:
    numero: int
    metodo: str
    caminho: str
    cabecalhos: Dict[str, str]
    corpo: Optional[dict]
    corpo_bruto: bytes
    instante: float

    @property
    def e_chat(self) -> bool:
        return self.metodo == "POST" and self.caminho.rstrip("/").endswith("/chat/completions")

    def nomes_das_ferramentas(self) -> Tuple[str, ...]:
        """Nomes das ferramentas que o agente ofereceu ao modelo neste pedido."""
        ferramentas = (self.corpo or {}).get("tools") or []
        nomes = []
        for item in ferramentas:
            funcao = item.get("function") if isinstance(item, dict) else None
            if isinstance(funcao, dict) and funcao.get("name"):
                nomes.append(funcao["name"])
        return tuple(nomes)

    def mensagens(self) -> List[dict]:
        return list((self.corpo or {}).get("messages") or [])

    def texto_do_sistema(self) -> str:
        """Todas as mensagens de sistema (instruções) deste pedido, juntas."""
        partes = []
        for m in self.mensagens():
            if m.get("role") in ("system", "developer"):
                partes.append(_como_texto(m.get("content")))
        return "\n".join(partes)

    def texto_do_usuario(self) -> str:
        partes = [_como_texto(m.get("content")) for m in self.mensagens() if m.get("role") == "user"]
        return "\n".join(partes)

    def resultados_de_ferramenta(self) -> int:
        return sum(1 for m in self.mensagens() if m.get("role") == "tool")


def _como_texto(conteudo) -> str:
    if isinstance(conteudo, str):
        return conteudo
    if isinstance(conteudo, list):
        return "".join(p.get("text", "") for p in conteudo if isinstance(p, dict))
    return "" if conteudo is None else str(conteudo)


class ServidorDeProvedorFalso:
    """Uso:  with ServidorDeProvedorFalso() as srv: ... srv.endereco ... srv.pedidos_de_chat()"""

    def __init__(self, cenario: Optional[Cenario] = None):
        self._cenario = cenario or Cenario()
        self._trava = threading.Lock()
        self._pedidos: List[PedidoRecebido] = []
        self._parar = threading.Event()
        servidor = self

        class Atendente(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args, **kwargs):  # silencioso
                pass

            def do_GET(self):
                servidor._atender(self, "GET")

            def do_POST(self):
                servidor._atender(self, "POST")

        class Http(ThreadingHTTPServer):
            daemon_threads = True

            def handle_error(self, request, client_address):  # o agente fecha a conexão de propósito
                pass

        self._http = Http(("127.0.0.1", 0), Atendente)
        self._thread: Optional[threading.Thread] = None

    # --- ciclo de vida -------------------------------------------------
    def iniciar(self) -> "ServidorDeProvedorFalso":
        self._thread = threading.Thread(target=self._http.serve_forever, kwargs={"poll_interval": 0.05},
                                        daemon=True)
        self._thread.start()
        return self

    def parar(self):
        self._parar.set()
        self._http.shutdown()
        self._http.server_close()
        if self._thread:
            self._thread.join(timeout=5)

    def __enter__(self):
        return self.iniciar()

    def __exit__(self, *args):
        self.parar()

    @property
    def porta(self) -> int:
        return self._http.server_address[1]

    @property
    def endereco(self) -> str:
        """Endereço base no estilo da API: http://127.0.0.1:PORTA/v1"""
        return f"http://127.0.0.1:{self.porta}/v1"

    # --- cenário e pedidos --------------------------------------------
    @property
    def cenario(self) -> Cenario:
        return self._cenario

    def definir(self, cenario: Cenario):
        self._cenario = cenario

    def pedidos(self) -> List[PedidoRecebido]:
        with self._trava:
            return list(self._pedidos)

    def pedidos_de_chat(self) -> List[PedidoRecebido]:
        return [p for p in self.pedidos() if p.e_chat]

    def limpar(self):
        with self._trava:
            self._pedidos.clear()

    # --- atendimento ---------------------------------------------------
    def _atender(self, h: BaseHTTPRequestHandler, metodo: str):
        tamanho = int(h.headers.get("Content-Length") or 0)
        bruto = h.rfile.read(tamanho) if tamanho else b""
        try:
            corpo = json.loads(bruto) if bruto else None
        except ValueError:
            corpo = None
        with self._trava:
            pedido = PedidoRecebido(
                numero=len(self._pedidos) + 1, metodo=metodo, caminho=h.path,
                cabecalhos={k.lower(): v for k, v in h.headers.items()},
                corpo=corpo if isinstance(corpo, dict) else None, corpo_bruto=bruto, instante=time.time())
            self._pedidos.append(pedido)
        if not pedido.e_chat:
            # sondas que o Hermes faz para descobrir o tipo de servidor: nada a oferecer
            self._json(h, 404, {"error": {"message": "nao existe", "type": "not_found"}})
            return
        self._responder_chat(h, pedido, self._cenario)

    def _responder_chat(self, h, pedido: PedidoRecebido, cen: Cenario):
        modelo = (pedido.corpo or {}).get("model", "modelo-falso")
        em_partes = bool((pedido.corpo or {}).get("stream"))
        sim = cen.simulacao
        if sim is Simulacao.ERRO_429:
            corpo = {"error": {"message": "You have hit your usage limit.", "type": "usage_limit_reached",
                               "code": "rate_limit_exceeded", "resets_in_seconds": cen.segundos_para_voltar}}
            self._json(h, 429, corpo, {"Retry-After": str(cen.segundos_para_voltar)})
        elif sim is Simulacao.LOGIN_RECUSADO:
            corpo = {"error": {"message": "Your authentication token has expired. Please sign in again.",
                               "type": "invalid_request_error", "code": "token_expired"}}
            self._json(h, 401, corpo)
        elif sim is Simulacao.ERRO_500:
            self._json(h, 503, {"error": {"message": "The server is overloaded.", "type": "server_error"}})
        elif sim is Simulacao.CONTEXTO_GRANDE:
            self._json(h, 400, {"error": {"message": "This model's maximum context length is 272000 tokens.",
                                          "type": "invalid_request_error", "code": "context_length_exceeded"}})
        elif sim is Simulacao.ERRO_ESTRANHO:
            self._json(h, 418, {"error": {"message": "I'm a teapot.", "type": "teapot_error"}})
        elif sim is Simulacao.SAIDA_CORTADA:
            self._texto(h, modelo, cen.texto, em_partes, fim="length")
        elif sim is Simulacao.RESPOSTA_INVALIDA:
            self._json(h, 200, {"id": "x", "object": "chat.completion", "model": modelo, "choices": []})
        elif sim is Simulacao.RESPOSTA_VAZIA:
            self._texto(h, modelo, "", em_partes)
        elif sim is Simulacao.FORMATO_ERRADO:
            self._texto(h, modelo, TEXTO_FORMATO_ERRADO, em_partes)
        elif sim is Simulacao.QUEDA_NO_MEIO:
            self._queda_no_meio(h, modelo, em_partes)
        elif sim is Simulacao.LENTA:
            if self._parar.wait(cen.atraso_s):
                return
            self._texto(h, modelo, cen.texto, em_partes)
        elif sim is Simulacao.LACO_DE_FERRAMENTA:
            if cen.atraso_s and self._parar.wait(cen.atraso_s):
                return
            if pedido.resultados_de_ferramenta() < cen.voltas_do_laco:
                nome = cen.ferramenta or (pedido.nomes_das_ferramentas() or (NOME_DA_FERRAMENTA_INEXISTENTE,))[0]
                numero = pedido.resultados_de_ferramenta() + 1
                self._chamada(h, modelo, nome, cen.argumentos.replace("{n}", str(numero)), numero, em_partes)
            else:
                self._texto(h, modelo, cen.texto, em_partes)
        else:
            self._texto(h, modelo, cen.texto, em_partes)

    # --- formas de resposta --------------------------------------------
    @staticmethod
    def _json(h, status: int, corpo: dict, extras: Optional[Dict[str, str]] = None):
        dados = json.dumps(corpo).encode()
        h.send_response(status)
        h.send_header("Content-Type", "application/json")
        h.send_header("Content-Length", str(len(dados)))
        for chave, valor in (extras or {}).items():
            h.send_header(chave, valor)
        h.end_headers()
        h.wfile.write(dados)

    def _texto(self, h, modelo: str, texto: str, em_partes: bool, fim: str = "stop"):
        uso = {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
        if not em_partes:
            self._json(h, 200, {"id": "x", "object": "chat.completion", "model": modelo, "usage": uso,
                                "choices": [{"index": 0, "finish_reason": fim,
                                             "message": {"role": "assistant", "content": texto}}]})
            return
        eventos = [_chunk(modelo, {"role": "assistant", "content": texto}, None),
                   _chunk(modelo, {}, fim), _chunk_de_uso(modelo, uso)]
        self._sse(h, eventos)

    def _chamada(self, h, modelo: str, nome: str, argumentos: str, numero: int, em_partes: bool):
        identificador = f"call_{numero}"
        uso = {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
        chamada = {"id": identificador, "type": "function", "function": {"name": nome, "arguments": argumentos}}
        if not em_partes:
            self._json(h, 200, {"id": "x", "object": "chat.completion", "model": modelo, "usage": uso,
                                "choices": [{"index": 0, "finish_reason": "tool_calls",
                                             "message": {"role": "assistant", "content": None,
                                                         "tool_calls": [chamada]}}]})
            return
        primeiro = {"role": "assistant", "content": None, "tool_calls": [
            {"index": 0, "id": identificador, "type": "function", "function": {"name": nome, "arguments": ""}}]}
        segundo = {"tool_calls": [{"index": 0, "function": {"arguments": argumentos}}]}
        self._sse(h, [_chunk(modelo, primeiro, None), _chunk(modelo, segundo, None),
                      _chunk(modelo, {}, "tool_calls"), _chunk_de_uso(modelo, uso)])

    def _queda_no_meio(self, h, modelo: str, em_partes: bool):
        """Manda o começo da resposta e derruba a conexão sem terminar."""
        h.send_response(200)
        h.send_header("Content-Type", "text/event-stream")
        h.send_header("Transfer-Encoding", "chunked")
        h.end_headers()
        _escrever_parte(h, _linha_sse(_chunk(modelo, {"role": "assistant", "content": "Comecei a resp"}, None)))
        h.wfile.flush()
        try:
            h.connection.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        h.close_connection = True

    @staticmethod
    def _sse(h, eventos: List[dict]):
        h.send_response(200)
        h.send_header("Content-Type", "text/event-stream")
        h.send_header("Transfer-Encoding", "chunked")
        h.end_headers()
        for evento in eventos:
            _escrever_parte(h, _linha_sse(evento))
        _escrever_parte(h, b"data: [DONE]\n\n")
        h.wfile.write(b"0\r\n\r\n")
        h.wfile.flush()


def _chunk(modelo: str, delta: dict, fim: Optional[str]) -> dict:
    return {"id": "x", "object": "chat.completion.chunk", "model": modelo,
            "choices": [{"index": 0, "delta": delta, "finish_reason": fim}]}


def _chunk_de_uso(modelo: str, uso: dict) -> dict:
    return {"id": "x", "object": "chat.completion.chunk", "model": modelo, "choices": [], "usage": uso}


def _linha_sse(evento: dict) -> bytes:
    return b"data: " + json.dumps(evento).encode() + b"\n\n"


def _escrever_parte(h, dados: bytes):
    h.wfile.write(f"{len(dados):x}\r\n".encode() + dados + b"\r\n")
    h.wfile.flush()
