"""A tabela de leis: nome, URL oficial, texto vazio e status NÃO CONFERIDA. O validador NÃO inventa texto de lei."""
import json
from pathlib import Path

import pytest

import validador
from validador.contexto import ErroDeContexto, validar_tabela_de_leis

ARQUIVO = Path(validador.__file__).resolve().parent / "dados" / "leis.json"
TABELA = json.loads(ARQUIVO.read_text(encoding="utf-8"))
OBRIGATORIAS = ["LGPD", "Código Civil", "Lei 9.610/98", "Marco Civil", "CDC", "CLT", "ECA Digital", "Lei 15.123/2025"]


def test_as_oito_leis_do_plano_estao_na_tabela():
    nomes = " | ".join(l["nome"] + " " + " ".join(l.get("apelidos", [])) + " " + f"Lei {l['norma']['numero']}/{l['norma']['ano']}" for l in TABELA["leis"])
    assert len(TABELA["leis"]) == 8
    assert "LGPD" in nomes and "Código Civil" in nomes and "Direitos Autorais" in nomes and "Marco Civil" in nomes
    assert "CDC" in nomes and "CLT" in nomes and "ECA Digital" in nomes
    assert any(l["norma"]["numero"] == "9610" and l["norma"]["ano"] == 1998 for l in TABELA["leis"])
    assert any(l["norma"]["numero"] == "15123" and l["norma"]["ano"] == 2025 for l in TABELA["leis"])


def test_nenhum_texto_de_lei_foi_inventado():
    """O campo texto_oficial_a_conferir nasce VAZIO e o status NAO_CONFERIDA. Quem preenche é uma pessoa."""
    for lei in TABELA["leis"]:
        assert lei["texto_oficial_a_conferir"] == "", f"{lei['id']}: texto de lei não pode vir escrito por IA"
        assert lei["status"] == "NAO_CONFERIDA"
        assert lei["data_da_conferencia"] is None
        assert lei["notas_de_jurisprudencia"] == []


def test_cada_lei_tem_nome_e_url_oficial_https():
    ids = set()
    for lei in TABELA["leis"]:
        assert lei["nome"] and lei["id"].startswith("FON-LEI-") and lei["id"] not in ids
        ids.add(lei["id"])
        assert lei["url_oficial"].startswith("https://www.planalto.gov.br/")
        assert lei["url_conferida"] is False, "as URLs foram escritas sem internet: conferir antes de marcar como conferidas"


def test_marco_civil_art_19_exige_nota():
    mc = next(l for l in TABELA["leis"] if "Marco Civil" in l["nome"])
    assert mc["artigos_com_nota_obrigatoria"] == ["19"]


def test_a_propria_tabela_passa_na_conferencia():
    assert validar_tabela_de_leis(TABELA) is TABELA


@pytest.mark.parametrize("mexer,trecho", [
    (lambda t: t["leis"][0].update(status="CONFERIDA"), "texto oficial"),
    (lambda t: t["leis"][0].update(status="CONFERIDA", texto_oficial_a_conferir="x"), "data_da_conferencia"),
    (lambda t: t["leis"][0].update(status="TALVEZ"), "status"),
    (lambda t: t["leis"].append(dict(t["leis"][0])), "repetida"),
    (lambda t: t["leis"][0].pop("nome"), "nome"),
    (lambda t: t.__setitem__("leis", "nada"), "lista"),
])
def test_tabela_mal_preenchida_e_recusada(mexer, trecho):
    t = json.loads(json.dumps(TABELA))
    mexer(t)
    with pytest.raises(ErroDeContexto, match=trecho):
        validar_tabela_de_leis(t)


def test_cli_leis_mostra_que_nada_foi_conferido():
    import subprocess
    import sys

    saida = subprocess.run([sys.executable, "-m", "validador", "leis"], cwd=Path(validador.__file__).resolve().parent.parent,
                           capture_output=True, text=True, check=True).stdout
    assert saida.count("NAO_CONFERIDA") == 8 and saida.count("VAZIO") == 8 and "CONFERIDA " not in saida.replace("NAO_CONFERIDA", "")
