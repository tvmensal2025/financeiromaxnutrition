"""Desempenho: milissegundos. Limites generosos para não falhar em máquina lenta, mas que pegam uma regressão grave."""
import json
import statistics
import time

import pytest

from validador import validar

from . import fabrica as F
from .banco import montar


def medir(resposta, contexto, vezes=15):
    tempos = []
    for _ in range(vezes):
        t = time.perf_counter()
        validar(resposta, contexto)
        tempos.append((time.perf_counter() - t) * 1000)
    return statistics.median(tempos), max(tempos)


@pytest.mark.parametrize("base", sorted(F.BASES))
def test_entrega_tipica_leva_milissegundos(base):
    r, c = montar(base, [])
    mediana, pior = medir(r, c)
    assert mediana < 50, f"{base}: mediana {mediana:.1f} ms"
    assert pior < 200, f"{base}: pior caso {pior:.1f} ms"


def test_entrega_grande_com_muitas_citacoes_e_paginas_grandes():
    """12 mil caracteres, 20 citações e 3 páginas de 200 mil caracteres cada."""
    r, c = F.dossie()
    base = F.TERMOS_1 + F.TERMOS_2
    c["paginas_lidas"] = [
        {"leitura_id": f"LEI-{i:03d}", "url": f"https://www.plataformaexemplo.com.br/p{i}", "execucao": F.EXECUCAO,
         "partes_total": 10, "partes": {str(n): (base * 60)[:20000] + f" Marca especial número {i}-{n}." for n in range(1, 11)}} for i in range(1, 4)
    ]
    r["entrega"]["fatos_com_fonte"] = [
        {"texto": "O participante deve ter pelo menos 18 anos de idade para enviar qualquer vídeo.",
         "citacoes": [F.cit(F.F_IDADE, leitura=f"LEI-{1 + k % 3:03d}", parte=1 + k % 10)]} for k in range(20)
    ]
    r["entrega"]["resumo_executivo"] = "Resumo curto da plataforma. " * 30
    mediana, pior = medir(json.dumps(r, ensure_ascii=False), c, vezes=5)
    assert mediana < 400, f"mediana {mediana:.0f} ms"


def test_trezentas_validacoes_seguidas_em_poucos_segundos():
    r, c = montar("dossie", [])
    t = time.perf_counter()
    for _ in range(300):
        validar(r, c)
    assert time.perf_counter() - t < 6


PATOLOGICOS = [
    ("palavra gigante sem espaço", "a" * 200_000),
    ("hífens repetidos", "a-" * 100_000),
    ("pontos repetidos", "a." * 100_000),
    ("parênteses abertos", "(" * 50_000),
    ("aspas repetidas", "“" * 100_000),
    ("barras e arrobas", "http://" + "a/@" * 50_000),
    ("letras soltas", "a " * 100_000),
    ("lei sem fim", "Lei " + "Maria da Penha " * 20_000),
    ("artigos repetidos", "art. 7º, " * 30_000),
    ("quebras de linha", "x\n" * 100_000),
    ("muitas linhas curtas, abaixo do teto de análise", "x y\n" * 60_000),
    ("muitas leis", "Lei 12.345/2012 e art. 7º da LGPD. " * 6000),
    ("muitos links", "https://a.com/x www.b.com.br c.net " * 6000),
    ("muitos termos de ganho disfarçados", "r e n d a, ren-da, r3nda e g a n h o. " * 4000),
    ("muitas frases de ação externa", "Enviei e cadastrei, não paguei. " * 6000),
]


@pytest.mark.parametrize("nome,texto", PATOLOGICOS, ids=[p[0] for p in PATOLOGICOS])
def test_texto_patologico_nao_trava(nome, texto):
    r, c = F.dossie()
    r["entrega"]["resumo_executivo"] = texto
    t = time.perf_counter()
    validar(json.dumps(r), c)
    assert time.perf_counter() - t < 5, nome


def test_resposta_de_um_milhao_de_caracteres_e_recusada_na_hora():
    _, c = F.dossie()
    t = time.perf_counter()
    rel = validar("x" * 1_500_000, c)
    assert time.perf_counter() - t < 1
    assert rel.recusas[0].motivo == "FORA_DO_FORMATO"


def test_json_muito_aninhado_nao_estoura_a_pilha():
    _, c = F.dossie()
    for txt in ["[" * 200_000, '{"a":' * 20_000 + "1" + "}" * 20_000, '{"acao":"ENTREGAR","entrega":' + '{"a":' * 3000 + "1" + "}" * 3000 + "}"]:
        rel = validar(txt, c)
        assert rel.veredito == "RECUSADA"
