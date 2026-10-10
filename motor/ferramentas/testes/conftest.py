"""Montagem comum dos testes: um "mundo" com servidor de páginas, DNS e conector falsos."""

import pytest

from falsos import IP_A, IP_B, ConectorFalso, DnsFalso, PaginasFalsas
from ferramentas_helena.busca import AdaptadorFalso
from ferramentas_helena.copias import Copias
from ferramentas_helena.leitor import Leitor
from ferramentas_helena.parametros import Parametros
from ferramentas_helena.rede import ClienteHttp
from ferramentas_helena.servidor import Servidor


class Mundo:
    def __init__(self, tmp_path, paginas):
        self.tmp_path = tmp_path
        self.paginas = paginas
        local = ("127.0.0.1", paginas.porta)
        self.dns = DnsFalso({
            "site.exemplo": [IP_A],
            "www.site.exemplo": [IP_A],
            "outro.exemplo": [IP_B],
        })
        self.conector = ConectorFalso({(IP_A, 80): local, (IP_B, 80): local})

    def params(self, **mudancas):
        base = dict(
            execucao="E-1-n1", diretorio=self.tmp_path / "exec",
            ferramentas=("ler_pagina", "buscar"), max_total=45, max_buscas=10, max_partes=30,
            lista_de_enderecos=None, tempo_leitura_s=5.0,
        )
        base.update(mudancas)
        return Parametros(**base)

    def cliente(self, **mudancas):
        return ClienteHttp(self.params(**mudancas), resolvedor=self.dns, conector=self.conector)

    def leitor(self, **mudancas):
        params = self.params(**mudancas)
        cliente = ClienteHttp(params, resolvedor=self.dns, conector=self.conector)
        return Leitor(params, cliente, Copias(params.diretorio))

    def servidor(self, adaptador=None, contexto_ssl=None, **mudancas):
        params = self.params(**mudancas)
        cliente = ClienteHttp(params, resolvedor=self.dns, conector=self.conector,
                              contexto_ssl=contexto_ssl)
        return Servidor(params, cliente=cliente, adaptador=adaptador or AdaptadorFalso({}))


def chamar(servidor, nome, argumentos=None, id_=1):
    """Uma tools/call; devolve a resposta JSON-RPC inteira."""
    return servidor.tratar({"jsonrpc": "2.0", "id": id_, "method": "tools/call",
                            "params": {"name": nome, "arguments": argumentos or {}}})


def texto_de(resposta):
    return resposta["result"]["content"][0]["text"]


@pytest.fixture
def paginas():
    servidor = PaginasFalsas()
    servidor.iniciar()
    yield servidor
    servidor.parar()


@pytest.fixture
def mundo(tmp_path, paginas):
    return Mundo(tmp_path, paginas)
