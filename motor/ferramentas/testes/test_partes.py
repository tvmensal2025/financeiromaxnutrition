"""Divisão em partes de até 20 mil caracteres."""

import random

import pytest

from ferramentas_helena.partes import dividir


def paragrafos(quantidade, tamanho, semente=1):
    gerador = random.Random(semente)
    letras = "abcdefghijklmnopqrstuvwxyz"
    saida = []
    for i in range(quantidade):
        palavras = []
        while sum(len(p) + 1 for p in palavras) < tamanho:
            palavras.append("".join(gerador.choice(letras) for _ in range(gerador.randint(2, 9))))
        saida.append(f"P{i}: " + " ".join(palavras).capitalize() + ".")
    return "\n\n".join(saida)


def test_texto_pequeno_e_uma_parte_so():
    assert dividir("ola mundo", 20_000) == ["ola mundo"]


def test_texto_vazio_nao_tem_partes():
    assert dividir("", 20_000) == []


def test_tamanho_invalido():
    with pytest.raises(ValueError):
        dividir("x", 0)


def test_texto_do_tamanho_exato_e_uma_parte():
    assert len(dividir("a" * 20_000, 20_000)) == 1
    assert len(dividir("a" * 20_001, 20_000)) == 2


@pytest.mark.parametrize("semente", range(8))
def test_propriedades_em_texto_de_300_mil_caracteres(semente):
    texto = paragrafos(300, 1000, semente)
    partes = dividir(texto, 20_000)
    assert "".join(partes) == texto                       # juntando, volta o original
    assert all(0 < len(p) <= 20_000 for p in partes)      # nenhuma passa do limite nem vem vazia
    assert len(partes) >= len(texto) // 20_000


def test_corta_no_fim_de_paragrafo_quando_da():
    texto = paragrafos(100, 3000)
    for parte in dividir(texto, 20_000)[:-1]:
        assert parte.endswith("\n\n")


@pytest.mark.parametrize("semente", range(5))
def test_paragrafo_curto_nunca_fica_partido(semente):
    texto = paragrafos(200, 1500, semente)
    partes = dividir(texto, 20_000)
    for paragrafo in texto.split("\n\n"):
        assert sum(paragrafo in p for p in partes) == 1, paragrafo[:40]


def test_sem_paragrafos_corta_em_frase_depois_em_espaco():
    frases = " ".join(f"Esta é a frase número {i} do texto." for i in range(2000))
    partes = dividir(frases, 20_000)
    assert "".join(partes) == frases
    for parte in partes[:-1]:
        assert parte.endswith(". ")


def test_palavra_gigante_sem_espaco_corta_duro():
    texto = "x" * 50_000
    partes = dividir(texto, 20_000)
    assert [len(p) for p in partes] == [20_000, 20_000, 10_000]


def test_cobre_texto_com_acentos_e_emoji():
    texto = ("Ação é coração 😀 " * 3000)
    partes = dividir(texto, 5_000)
    assert "".join(partes) == texto and all(len(p) <= 5_000 for p in partes)
