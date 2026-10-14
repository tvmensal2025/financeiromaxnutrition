"""Servidor HTTP local de mentira para testar o canal de alarme por webhook. Só 127.0.0.1, só em teste.

Guarda tudo o que recebe (método, caminho, cabeçalhos, corpo) e responde com o status combinado, com redirecionamento
ou segurando a resposta por um tempo (para provocar timeout). Nenhum endereço ou segredo real passa por aqui.
"""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class _Tratador(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def _tratar(self):
        servidor = self.server.dono
        tamanho = int(self.headers.get('Content-Length') or 0)
        corpo = self.rfile.read(tamanho).decode('utf-8') if tamanho else ''
        servidor.recebidos.append((self.command, self.path, dict(self.headers), corpo))
        if servidor.segurar_s:
            servidor.liberar.wait(servidor.segurar_s)
        if servidor.redirecionar_para:
            self.send_response(servidor.status, 'Redirecionando')
            self.send_header('Location', servidor.redirecionar_para)
        else:
            self.send_response(servidor.status)
        self.send_header('Content-Length', '0')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.close_connection = True

    do_POST = do_GET = do_PUT = do_HEAD = _tratar

    def log_message(self, *_args):
        return None


class _Servidor(ThreadingHTTPServer):
    daemon_threads = True


class ServidorWebhook:
    """Uso: `with ServidorWebhook(status=500) as s: ... s.url ... s.recebidos`."""

    def __init__(self, status=200, *, segurar_s=0.0, redirecionar_para=None):
        self.status, self.segurar_s, self.redirecionar_para = status, segurar_s, redirecionar_para
        self.recebidos = []
        self.liberar = threading.Event()
        self._http = _Servidor(('127.0.0.1', 0), _Tratador)
        self._http.dono = self
        self.porta = self._http.server_address[1]
        self._thread = threading.Thread(target=self._http.serve_forever, kwargs={'poll_interval': 0.05}, daemon=True)

    def url(self, caminho='/hook'):
        return f'http://127.0.0.1:{self.porta}{caminho}'

    def __enter__(self):
        self._thread.start()
        return self

    def __exit__(self, *_):
        self.liberar.set()
        self._http.shutdown()
        self._http.server_close()
        self._thread.join(timeout=5)
        return False
