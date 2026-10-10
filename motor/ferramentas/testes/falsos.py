"""Peças falsas para os testes: servidor de páginas local, DNS falso e conector falso.

O que NÃO é falso: todas as conferências do código de produção (endereço, porta, IP,
redirecionamento, tamanho, prazo). Os falsos só trocam a REDE no último passo:
- DnsFalso responde "este nome tem este IP" (IPs públicos de verdade, nunca conectados);
- ConectorFalso, depois que o IP foi conferido, liga o socket num servidor local.
Assim o teste passa pelo mesmo caminho de produção e nada sai do computador.
"""

import gzip
import socket
import ssl
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

IP_A = "93.184.216.34"   # IP público qualquer (nunca é conectado de verdade)
IP_B = "151.101.1.1"


class _ServidorQuieto(ThreadingHTTPServer):
    """Quando o cliente desiste (prazo, limite de tamanho), o servidor falso leva um erro de
    conexão. Isso é esperado nos testes e não deve poluir a saída; erro de outro tipo aparece."""

    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], OSError):
            super().handle_error(request, client_address)


class PaginasFalsas:
    """Servidor HTTP local com rotas programáveis; guarda cada requisição que recebe."""

    def __init__(self, contexto_ssl=None):
        self.rotas = {}
        self.requisicoes = []      # (cabeçalho Host, caminho com consulta)
        self.bytes_enviados = 0
        pai = self

        class Manipulador(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args):
                pass

            def do_GET(self):
                pai.requisicoes.append((self.headers.get("Host"), self.path))
                rota = pai.rotas.get(self.path.split("?")[0])
                if rota is None:
                    self.enviar(404, b"nao achei", tipo="text/plain")
                else:
                    rota(self)

            def enviar(self, status, corpo, tipo="text/html; charset=utf-8", cabecalhos=None):
                self.send_response(status)
                self.send_header("Content-Type", tipo)
                self.send_header("Content-Length", str(len(corpo)))
                self.send_header("Connection", "close")
                for nome, valor in (cabecalhos or {}).items():
                    self.send_header(nome, valor)
                self.end_headers()
                self.wfile.write(corpo)
                self.close_connection = True

        self.httpd = _ServidorQuieto(("127.0.0.1", 0), Manipulador)
        self.httpd.daemon_threads = True
        if contexto_ssl is not None:
            self.httpd.socket = contexto_ssl.wrap_socket(self.httpd.socket, server_side=True)
        self.porta = self.httpd.server_address[1]
        self._fio = threading.Thread(target=self.httpd.serve_forever, kwargs={"poll_interval": 0.02}, daemon=True)

    def iniciar(self):
        self._fio.start()

    def parar(self):
        self.httpd.shutdown()
        self.httpd.server_close()


# --- rotas prontas ----------------------------------------------------------------------
def pagina(corpo, status=200, tipo="text/html; charset=utf-8", cabecalhos=None):
    dados = corpo.encode("utf-8") if isinstance(corpo, str) else corpo
    return lambda h: h.enviar(status, dados, tipo, cabecalhos)


def redirecionar(destino, status=302):
    return lambda h: h.enviar(status, b"", cabecalhos={"Location": destino})


def redirecionar_sem_destino():
    return lambda h: h.enviar(302, b"")


def gzip_de(corpo):
    dados = gzip.compress(corpo.encode("utf-8") if isinstance(corpo, str) else corpo)
    return lambda h: h.enviar(200, dados, cabecalhos={"Content-Encoding": "gzip"})


def bomba_gzip(tamanho_descomprimido):
    dados = gzip.compress(b"a" * tamanho_descomprimido, compresslevel=9)
    return lambda h: h.enviar(200, dados, "text/plain", {"Content-Encoding": "gzip"})


def em_pedacos(pedacos, tipo="text/html; charset=utf-8"):
    def rota(h):
        h.send_response(200)
        h.send_header("Content-Type", tipo)
        h.send_header("Transfer-Encoding", "chunked")
        h.send_header("Connection", "close")
        h.end_headers()
        for pedaco in pedacos:
            dados = pedaco.encode("utf-8") if isinstance(pedaco, str) else pedaco
            h.wfile.write(f"{len(dados):x}\r\n".encode() + dados + b"\r\n")
        h.wfile.write(b"0\r\n\r\n")
        h.close_connection = True
    return rota


def ate_fechar(corpo, tipo="text/html; charset=utf-8"):
    """Sem Content-Length: o corpo termina quando a conexão fecha."""
    dados = corpo.encode("utf-8") if isinstance(corpo, str) else corpo

    def rota(h):
        h.send_response(200)
        h.send_header("Content-Type", tipo)
        h.send_header("Connection", "close")
        h.end_headers()
        h.wfile.write(dados)
        h.close_connection = True
    return rota


def resposta_gigante(servidor, total_bytes, com_content_length=False):
    """Despeja até total_bytes; para quando o cliente desiste. Conta o que enviou."""
    def rota(h):
        h.send_response(200)
        h.send_header("Content-Type", "text/plain")
        h.send_header("Connection", "close")
        if com_content_length:
            h.send_header("Content-Length", str(total_bytes))
        h.end_headers()
        bloco = b"x" * 65536
        enviado = 0
        try:
            while enviado < total_bytes:
                h.wfile.write(bloco)
                enviado += len(bloco)
                servidor.bytes_enviados = enviado
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        h.close_connection = True
    return rota


def gotejando(texto, intervalo_s):
    """Manda 1 byte por vez, devagar: o cliente com prazo único tem que desistir."""
    dados = texto.encode("utf-8")

    def rota(h):
        h.send_response(200)
        h.send_header("Content-Type", "text/plain")
        h.send_header("Content-Length", str(len(dados)))
        h.send_header("Connection", "close")
        h.end_headers()
        try:
            for i in range(len(dados)):
                h.wfile.write(dados[i:i + 1])
                h.wfile.flush()
                time.sleep(intervalo_s)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        h.close_connection = True
    return rota


def lenta_para_responder(atraso_s, corpo="<p>tarde demais</p>"):
    def rota(h):
        time.sleep(atraso_s)
        try:
            h.enviar(200, corpo.encode("utf-8"))
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
    return rota


def corpo_truncado():
    def rota(h):
        h.send_response(200)
        h.send_header("Content-Type", "text/plain")
        h.send_header("Content-Length", "1000")
        h.send_header("Connection", "close")
        h.end_headers()
        h.wfile.write(b"so um pouco")
        h.close_connection = True
    return rota


def nao_e_http():
    def rota(h):
        h.wfile.write(b"isto nao e http\r\n\r\n")
        h.close_connection = True
    return rota


# --- DNS e conector falsos --------------------------------------------------------------
class Sequencia:
    """Respostas de DNS em ordem: a 1ª consulta recebe a 1ª, a 2ª recebe a 2ª... (rebinding)."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.usadas = 0

    def proxima(self):
        indice = min(self.usadas, len(self.respostas) - 1)
        self.usadas += 1
        return list(self.respostas[indice])


class DnsFalso:
    def __init__(self, tabela):
        self.tabela = dict(tabela)
        self.consultas = []

    def __call__(self, host, porta):
        self.consultas.append(host)
        if host not in self.tabela:
            raise socket.gaierror(f"nome desconhecido: {host}")
        resposta = self.tabela[host]
        if isinstance(resposta, Sequencia):
            return resposta.proxima()
        if callable(resposta):
            return resposta()
        return list(resposta)


class ConectorFalso:
    """Depois da conferência do IP, liga o socket no servidor local combinado."""

    def __init__(self, destinos):
        self.destinos = dict(destinos)   # (ip, porta) -> (host local, porta local)
        self.conexoes = []

    def __call__(self, ip, porta, tempo_s):
        self.conexoes.append((ip, porta))
        destino = self.destinos.get((ip, porta))
        if destino is None:
            raise ConnectionRefusedError(f"sem destino falso para {ip}:{porta}")
        return socket.create_connection(destino, timeout=tempo_s)


# --- certificado de teste (gerado na hora, nunca guardado) ------------------------------
def gerar_certificado(pasta, nome_do_site):
    """Cria um certificado autoassinado só para o teste, em `pasta` (some com ela)."""
    chave, certificado = pasta / "chave.pem", pasta / "cert.pem"
    subprocess.run(
        ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(chave),
         "-out", str(certificado), "-days", "2", "-subj", f"/CN={nome_do_site}",
         "-addext", f"subjectAltName=DNS:{nome_do_site}"],
        check=True, capture_output=True,
    )
    servidor = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    servidor.load_cert_chain(str(certificado), str(chave))
    cliente = ssl.create_default_context(cafile=str(certificado))
    return servidor, cliente
