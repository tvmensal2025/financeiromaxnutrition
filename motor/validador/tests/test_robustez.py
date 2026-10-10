"""Robustez: entrega estranha nunca derruba o validador e nunca é aprovada por engano.

- Resposta com campos de tipo errado, listas no lugar de objetos, nulos: sem exceção, sem "erro interno de checagem".
- Contexto mal montado: só ErroDeContexto (nunca outro erro).
- Texto com letras e símbolos aleatórios: sem exceção.
"""
import copy
import json
import random

import pytest

from validador import ErroDeContexto, validar

from . import fabrica as F

LIXO = [None, True, False, 0, -1, 3.14, "", " ", "x", "<b>", [], {}, [[]], {"a": 1}, "​", "💰", 10**40, "1e400", ["a", None],
        {"texto": None}, {"trecho_original": None}, {"valor": "x", "origem": 5}, {"entradas": 5, "formulas": 6},
        {"entradas": [1], "formulas": [2]}, {"leitura_id": []}, {"citacoes": "abc"}, {"ausencia": 3}, {"trecho_original": "..."},
        {"trecho_original": "x" * 50, "leitura_id": {}, "parte": []}]


def caminhos(o, p=()):
    yield p
    if isinstance(o, dict):
        for k, v in o.items():
            yield from caminhos(v, p + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from caminhos(v, p + (i,))


def trocar(o, p, v):
    for k in p[:-1]:
        o = o[k]
    if p:
        o[p[-1]] = v


def apagar(o, p):
    for k in p[:-1]:
        o = o[k]
    if isinstance(o, dict):
        o.pop(p[-1], None)
    elif isinstance(o, list) and p[-1] < len(o):
        o.pop(p[-1])


def estragar(alvo, rng):
    for _ in range(rng.randint(1, 3)):
        p = rng.choice(list(caminhos(alvo)))
        if not p:
            continue
        if rng.random() < 0.3:
            apagar(alvo, p)
        else:
            trocar(alvo, p, copy.deepcopy(rng.choice(LIXO)))


@pytest.mark.parametrize("base", sorted(F.BASES))
def test_resposta_estragada_nunca_derruba_nem_gera_erro_interno(base):
    rng = random.Random(f"resposta-{base}")
    for _ in range(250):
        r, c = F.BASES[base]()
        estragar(r, rng)
        rel = validar(json.dumps(r, default=str), c)
        internos = [(f.id, f.trecho) for f in rel.falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"]
        assert not internos, (internos, json.dumps(r, default=str)[:400])


@pytest.mark.parametrize("base", sorted(F.BASES))
def test_contexto_estragado_so_levanta_erro_de_contexto(base):
    rng = random.Random(f"contexto-{base}")
    for _ in range(120):
        r, c = F.BASES[base]()
        estragar(c, rng)
        try:
            rel = validar(json.dumps(r, default=str), c)
        except ErroDeContexto:
            continue
        assert not [f for f in rel.falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"]


def test_texto_aleatorio_nao_derruba_nenhuma_checagem():
    rng = random.Random("sopa")
    pedacos = ["art. ", "Lei ", "12.345/2012", "“", "”", '"', "«", "R$ ", "US$", "http://", "www.", ".com.br", "@", "\n", "\t", "  ", ".", ",", ":", ";",
               "(", ")", "[", "]", "<", ">", "&lt;", "ª", "º", "§", "ção", "é", "ß", "İ", "Σ", "​", "‮", "💰", "0,50", "1.234,56", "enviei", "renda",
               "oficial", "fonte oficial", "a página não fala de", "segundo os termos", "cláusula 3", "eLiving", "E-living", "tenho 90% de certeza", "x" * 40]
    for _ in range(400):
        base = rng.choice(sorted(F.BASES))
        r, c = F.BASES[base]()
        secao = rng.choice(list(r["entrega"]))
        sopa = "".join(rng.choice(pedacos) for _ in range(rng.randint(1, 25)))
        if isinstance(r["entrega"][secao], str):
            r["entrega"][secao] = sopa
        elif isinstance(r["entrega"][secao], list):
            r["entrega"][secao].append(sopa)
        rel = validar(json.dumps(r, ensure_ascii=False), c)
        assert not [f for f in rel.falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"], sopa


def test_citacao_com_texto_estranho_nunca_passa_como_se_fosse_valida():
    """Qualquer trecho que não exista na página é recusado, não importa o formato do texto."""
    rng = random.Random("citacoes")
    for _ in range(300):
        r, c = F.dossie()
        trecho = "".join(rng.choice("abcdefghij klmnop ãé,.;“”​") for _ in range(rng.randint(1, 120)))
        r["entrega"]["fatos_com_fonte"][0]["citacoes"][0]["trecho_original"] = trecho
        rel = validar(json.dumps(r, ensure_ascii=False), c)
        pagina = " ".join((F.TERMOS_1 + F.TERMOS_2).split()).lower()
        if " ".join(trecho.replace("“", "").replace("”", "").replace("​", "").split()).strip(" .,;:").lower() in pagina:
            continue  # por acaso é um pedaço verdadeiro da página
        assert "CHK-COMUM-06" in rel.ids_que_falharam("RECUSA"), trecho
