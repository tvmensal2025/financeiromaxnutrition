"""Parâmetros da execução: o que a ficha pode e não pode pedir."""

import pytest

from ferramentas_helena.erros import ErroDeConfiguracao
from ferramentas_helena.parametros import Parametros


def criar(tmp_path, **mudancas):
    base = dict(execucao="E-1-n1", diretorio=tmp_path, ferramentas=("ler_pagina",), max_total=45,
                max_partes=30, lista_de_enderecos=None)
    base.update(mudancas)
    return Parametros(**base)


def test_exemplo_da_clara_do_plano(tmp_path):
    # 10 buscas, 30 partes de página, 45 chamadas no total, 15 minutos (o tempo é do motor)
    p = criar(tmp_path, ferramentas=("ler_pagina", "buscar"), max_buscas=10, max_partes=30, max_total=45)
    assert (p.max_buscas, p.max_partes, p.max_total, p.tamanho_parte) == (10, 30, 45, 20_000)


def test_servidor_vazio_e_aceito(tmp_path):
    assert criar(tmp_path, ferramentas=(), max_partes=0, max_total=3).ferramentas == ()


def test_lista_vira_tupla(tmp_path):
    assert criar(tmp_path, ferramentas=["ler_pagina"]).ferramentas == ("ler_pagina",)


@pytest.mark.parametrize("mudanca", [
    {"ferramentas": "ler_pagina"},                       # texto em vez de lista
    {"ferramentas": None},
    {"ferramentas": ("ler_pagina", "ler_pagina")},       # repetida
    {"ferramentas": ("ler_pagina", "terminal")},         # desconhecida
    {"ferramentas": ("web_search",)},
    {"ferramentas": ("buscar",), "max_buscas": 0},       # listada com limite zero
    {"ferramentas": ("ler_pagina",), "max_partes": 0},
    {"max_total": 0}, {"max_total": True}, {"max_total": 2.5},
    {"max_total": 10, "max_partes": 30},                 # a conta da ficha não fecha
    {"max_partes": -1}, {"insistencias_para_encerrar": 0},
    {"tamanho_parte": 20_001}, {"tamanho_parte": 49},    # o Hermes corta acima de 20 mil
    {"tempo_leitura_s": 0}, {"tempo_leitura_s": "20"},
    {"max_bytes": 10}, {"max_caracteres": 0},
    {"execucao": ""}, {"execucao": "../fora"}, {"execucao": "a b"}, {"execucao": "x" * 81},
    {"diretorio": "/tmp/texto"},
    {"lista_de_enderecos": "http://site.exemplo/"},      # texto em vez de lista
    {"lista_de_enderecos": (1, 2)},
])
def test_parametros_invalidos_sao_recusados(tmp_path, mudanca):
    with pytest.raises(ErroDeConfiguracao):
        criar(tmp_path, **mudanca)


def test_limite_de_ferramenta_fora_da_lista_nao_atrapalha(tmp_path):
    # buscar não está na lista: o limite de buscas dele é ignorado na conta
    p = criar(tmp_path, ferramentas=("ler_pagina",), max_buscas=999, max_partes=5, max_total=6)
    assert p.max_total == 6


def test_parametros_nao_mudam_depois_de_criados(tmp_path):
    p = criar(tmp_path)
    with pytest.raises(Exception):
        p.max_total = 9999
