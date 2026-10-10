"""Funções de texto: normalização, letras invisíveis, frases e endereços."""
import random
import unicodedata

import pytest

from validador import texto as T


def test_normalizar_iguala_aspas_espacos_e_travessoes():
    assert T.normalizar('  “Olá”,   «mundo»  e  ‘tudo’ \t de bom ') == "Olá, mundo e tudo de bom"
    assert T.normalizar("a – b — c − d") == "a - b - c - d"
    assert T.normalizar("l’état n'est pas") == T.normalizar("l'état n’est pas") == "létat nest pas"


def test_normalizar_nao_muda_as_palavras_nem_os_acentos():
    assert T.normalizar("Não é válido") == "Não é válido"
    assert T.normalizar("Nao e valido") != T.normalizar("Não é válido")


def test_forma_a_e_forma_b_tem_as_mesmas_posicoes():
    rng = random.Random(1)
    alfabeto = list("abc áé\n\t  .,“”–") + ["​", " ", "\r\n"]
    for _ in range(500):
        t = "".join(rng.choice(alfabeto) for _ in range(rng.randint(0, 60)))
        b = T.normalizar_com_quebras(t)
        assert T.normalizar(t) == b.replace("\n", " ")
        assert len(T.normalizar(t)) == len(b)
        assert len(b.lower()) == len(b)


def test_chave_ignora_maiuscula_mas_nao_acento():
    assert T.chave("OLÁ,  Mundo") == "olá, mundo"
    assert T.chave("ola") != T.chave("olá")


def test_nfd_e_nfc_viram_a_mesma_coisa():
    assert T.chave(unicodedata.normalize("NFD", "vídeo é ação")) == T.chave("vídeo é ação")


def test_invisiveis_sao_removidos_na_normalizacao():
    assert T.normalizar("ga​nho﻿⁠ e­xtra") == "ganho extra"


def test_lista_de_invisiveis_cobre_todos_os_caracteres_Cf_desta_versao_do_python():
    faltando = [hex(c) for c in range(0x110000) if unicodedata.category(chr(c)) == "Cf" and not T.INVISIVEIS.match(chr(c))]
    assert faltando == [], f"acrescente em texto.FAIXAS_INVISIVEIS: {faltando}"


@pytest.mark.parametrize("entrada,esperado", [
    ("RENDA", "renda"),
    ("rénda", "renda"),
    ("Ação", "acao"),
    ("ＧＡＮＨＯ", "ganho"),  # letras largas
    ("rеnda", "renda"),  # e cirílico
    ("ɡanho", "ganho"),  # g latino alternativo
    ("ga​nho", "ganho"),
    ("Ǆ", "dž".replace("̌", "")),  # compatibilidade
])
def test_dobrar(entrada, esperado):
    assert T.dobrar(entrada) == esperado


def test_dobrar_posicional_nao_muda_o_tamanho():
    rng = random.Random(3)
    alfabeto = list("aáãçÇéÉ ,.-́") + ["ǆ", "ﬁ"]
    for _ in range(300):
        t = "".join(rng.choice(alfabeto) for _ in range(rng.randint(0, 40)))
        t = unicodedata.normalize("NFC", t)
        assert len(T.dobrar_posicional(t)) == len(t)


def test_palavras_e_contagem():
    assert T.palavras("Um — dois, 3 e (quatro)  ...") == ["Um", "dois,", "3", "e", "(quatro)"]
    assert T.contar_palavras("R$ 0,50 por hora") == 4


def test_linhas():
    assert T.linhas("a\n\n  b  \r\nc\r") == ["a", "b", "c"]


FRASES = "O usuário deve ter 18 anos. Conforme o art. 5º, não pode vender a conta.\nOutra linha aqui! Fim?"


def test_separar_frases_nao_quebra_em_abreviacao():
    assert T.separar_frases(FRASES) == ["O usuário deve ter 18 anos.", "Conforme o art. 5o, não pode vender a conta.", "Outra linha aqui!", "Fim?"]


def test_separar_frases_nao_quebra_em_numeros_nem_siglas():
    assert T.separar_frases("A Lei 9.610/98 vale. Dr. Silva disse R$ 0,50 por hora. Ok.") == [
        "A Lei 9.610/98 vale.", "Dr. Silva disse R$ 0,50 por hora.", "Ok."]


def test_inicio_e_fim_de_frase():
    b = T.normalizar_com_quebras("Primeira frase aqui. Segunda frase vai aqui, com vírgula. Terceira.\n- item de lista termina aqui")
    ini2 = b.index("Segunda")
    assert T.inicio_de_frase(b, 0) and T.inicio_de_frase(b, ini2)
    assert not T.inicio_de_frase(b, b.index("frase vai"))
    assert not T.inicio_de_frase(b, b.index("com vírgula"))
    fim2 = b.index(" Terceira") - 1  # posição do ponto
    assert T.fim_de_frase(b, fim2)
    assert not T.fim_de_frase(b, b.index(", com"))
    assert T.inicio_de_frase(b, b.index("item de lista"))  # depois do marcador "- "
    assert T.fim_de_frase(b, len(b))


def test_nao_ha_inicio_de_frase_depois_de_abreviacao_nem_de_inicial():
    b = T.normalizar_com_quebras("Conforme o art. 7o, vale. Fale com J. Silva hoje.")
    assert not T.inicio_de_frase(b, b.index("7o"))
    assert not T.inicio_de_frase(b, b.index("Silva"))


@pytest.mark.parametrize("texto,esperado", [
    ("Veja https://www.site.com.br/termos hoje.", ["https://www.site.com.br/termos"]),
    ("Veja (www.golpe.exemplo/x).", ["www.golpe.exemplo/x"]),
    ("O site golpe-exemplo.com.br atende.", ["golpe-exemplo.com.br"]),
    ("Fale com contato@eliving.com.br ou veja a Lei 9.610/98 e o item 1.5.", []),
    ("Arquivo relatorio.pdf e versão 2.0.", []),
    ("[aqui](https://a.com/b), depois http://c.org.", ["https://a.com/b", "http://c.org"]),
])
def test_achar_urls(texto, esperado):
    assert T.achar_urls(texto) == esperado


def test_cortar():
    assert T.cortar("a  b\nc", 10) == "a b c"
    assert len(T.cortar("x" * 500, 50)) == 50
