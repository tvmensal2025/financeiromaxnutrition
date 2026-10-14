"""Comparar endereços: o mesmo site é o mesmo servidor; sites parecidos NÃO são."""
import pytest

from validador import enderecos as E

PEDIDO = "https://www.plataformaexemplo.com.br/termos"


@pytest.mark.parametrize("url", [
    "https://www.plataformaexemplo.com.br/outra-pagina",
    "http://plataformaexemplo.com.br",
    "HTTPS://WWW.PlataformaExemplo.COM.BR/Termos",
    "https://plataformaexemplo.com.br:443/x",
    "http://www.plataformaexemplo.com.br:80/x",
    "https://www.plataformaexemplo.com.br./x",
    "plataformaexemplo.com.br/termos",
    "https://user:senha@www.plataformaexemplo.com.br/x",  # usuário na frente do servidor verdadeiro
])
def test_mesmo_site(url):
    assert E.mesmo_site(url, PEDIDO)


@pytest.mark.parametrize("url", [
    "https://www.plataformaexemplo.com.br.golpe.net/termos",  # sufixo
    "https://golpe.plataformaexemplo.com.br/termos",  # subdomínio
    "https://ajuda.plataformaexemplo.com.br/",  # subdomínio legítimo também não conta por padrão
    "https://www.plataformaexemplo.com/termos",  # outro final
    "https://www.plataformaexemplo.com.br:8443/termos",  # outra porta
    "https://www.plataformaexemp1o.com.br/termos",  # número no lugar de letra
    "https://www.plataformaexernplo.com.br/termos",  # rn no lugar de m
    "https://www.plataforma-exemplo.com.br/termos",
    "https://www.plataformaexemplo.com.br@golpe.net/termos",  # o servidor verdadeiro é golpe.net
    "https://www.plataformaexemplo.com.br\\@golpe.net/termos",
    "https://%77ww.plataformaexemplo.com.br/termos",
    "https://www.plataformaеxemplo.com.br/termos",  # e cirílico
    "https://www.plataformаexemplo.com.br/termos",  # a cirílico
    "http://203.0.113.5/termos",
    "https://golpe.net/?u=plataformaexemplo.com.br",
    "https://golpe.net/plataformaexemplo.com.br/termos",
    "",
    "não é um endereço",
])
def test_sites_parecidos_nao_sao_o_mesmo_site(url):
    assert not E.mesmo_site(url, PEDIDO)


def test_com_subdominios_aceitos_so_o_subdominio_verdadeiro_vale():
    assert E.mesmo_site("https://ajuda.plataformaexemplo.com.br/", PEDIDO, aceitar_subdominios=True)
    assert not E.mesmo_site("https://ajudaplataformaexemplo.com.br/", PEDIDO, aceitar_subdominios=True)  # sem ponto: outro nome
    assert not E.mesmo_site("https://plataformaexemplo.com.br.golpe.net/", PEDIDO, aceitar_subdominios=True)


def test_host_de():
    assert E.host_de("https://WWW.Exemplo.com.br:443/a?b=c#d") == "exemplo.com.br"
    assert E.host_de("exemplo.com.br") == "exemplo.com.br"
    assert E.host_de("https://www.plataformaеxemplo.com.br").startswith("xn--")  # letras de outro alfabeto viram punycode
    assert E.host_de("http://127.0.0.1/") is None
    assert E.host_de("http://exemplo..com/") is None
    assert E.host_de("http://exemplo.com:abc/") is None


def test_chave_da_pagina_ignora_ancora_e_barra_final_mas_nao_a_consulta():
    base = E.chave_da_pagina("https://www.site.com.br/termos")
    assert base == E.chave_da_pagina("HTTP://site.com.br/termos/#parte2") == "site.com.br/termos"
    assert E.chave_da_pagina("https://site.com.br/termos?ref=1") != base
    assert E.chave_da_pagina("https://site.com.br/Termos") != base  # caminho diferencia maiúsculas
    assert E.chave_da_pagina("lixo lixo") is None
