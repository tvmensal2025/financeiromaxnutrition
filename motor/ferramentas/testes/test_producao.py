"""Peças de produção sem nenhum falso: DNS e conexão de verdade, só contra o próprio computador.

Aqui não se usa a internet. O foco é provar que as conexões de verdade (as que o servidor usa
em produção) funcionam, e que o endereço do próprio computador NUNCA é conectado, mesmo
com uma porta aberta esperando.
"""

import socket

import pytest

from ferramentas_helena.parametros import Parametros
from ferramentas_helena.rede import conectar_do_sistema, resolver_do_sistema
from ferramentas_helena.servidor import Servidor


@pytest.fixture
def porta_aberta():
    """Uma porta de verdade aberta no próprio computador, esperando alguém conectar."""
    ouvinte = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    ouvinte.bind(("127.0.0.1", 0))
    ouvinte.listen(5)
    yield ouvinte
    ouvinte.close()


def servidor_de_producao(tmp_path):
    params = Parametros(execucao="E-1-n1", diretorio=tmp_path / "exec", ferramentas=("ler_pagina",),
                        max_total=20, max_partes=5, lista_de_enderecos=None, tempo_leitura_s=2.0)
    return Servidor(params)           # sem cliente falso: DNS e conexão do sistema


def chamar_ler(servidor, url):
    return servidor.tratar({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                            "params": {"name": "ler_pagina", "arguments": {"url": url}}})


def test_resolver_do_sistema_devolve_ips_em_texto_sem_repetir_com_ipv4_primeiro():
    ips = resolver_do_sistema("localhost", 80)
    assert "127.0.0.1" in ips and all(isinstance(ip, str) for ip in ips)
    assert len(set(ips)) == len(ips)
    assert [(":" in ip) for ip in ips] == sorted(":" in ip for ip in ips)


def test_conector_do_sistema_liga_de_verdade(porta_aberta):
    porta = porta_aberta.getsockname()[1]
    with conectar_do_sistema("127.0.0.1", porta, 2.0) as cliente:
        conexao, _ = porta_aberta.accept()
        conexao.close()
        assert cliente.getpeername()[1] == porta


def test_conector_do_sistema_falha_rapido_se_ninguem_escuta():
    ouvinte = socket.socket()
    ouvinte.bind(("127.0.0.1", 0))
    porta = ouvinte.getsockname()[1]
    ouvinte.close()                                    # porta que acabou de ficar sem ninguém
    with pytest.raises(OSError):
        conectar_do_sistema("127.0.0.1", porta, 2.0)


@pytest.mark.parametrize("modelo", [
    "http://127.0.0.1:{porta}/", "http://localhost:{porta}/", "http://[::1]:{porta}/",
    "http://127.0.0.1/", "http://127.0.0.1:80/", "http://0.0.0.0:{porta}/", "http://2130706433/",
    "http://127.1:{porta}/", "http://0x7f.1:{porta}/", "http://[::ffff:127.0.0.1]:{porta}/",
    "http://localhost./", "http://localhost.localdomain/", "http://servico.internal/",
])
def test_servidor_de_producao_nunca_conecta_no_proprio_computador(tmp_path, porta_aberta, modelo):
    porta = porta_aberta.getsockname()[1]
    servidor = servidor_de_producao(tmp_path)
    resposta = chamar_ler(servidor, modelo.format(porta=porta))
    assert resposta["result"]["isError"] is True and "ERRO [" in resposta["result"]["content"][0]["text"]
    porta_aberta.settimeout(0.2)
    with pytest.raises(socket.timeout):
        porta_aberta.accept()                          # ninguém chegou a conectar


def test_servidor_de_producao_liga_e_lista_so_o_que_a_ficha_manda(tmp_path):
    servidor = servidor_de_producao(tmp_path)
    resposta = servidor.tratar({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert [t["name"] for t in resposta["result"]["tools"]] == ["ler_pagina"]


def test_arquivos_da_execucao_ficam_so_na_pasta_dela(tmp_path):
    servidor = servidor_de_producao(tmp_path)
    chamar_ler(servidor, "http://127.0.0.1/")
    criados = sorted(p.name for p in (tmp_path / "exec").iterdir())
    assert criados == ["estado.json", "leituras", "registro.jsonl"]
    assert [p.name for p in tmp_path.iterdir()] == ["exec"]
