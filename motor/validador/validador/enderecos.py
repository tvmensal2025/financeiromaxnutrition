"""Comparar endereços de internet sem cair em sites parecidos.

Regra de ouro: dois endereços são do MESMO SITE só se o nome do servidor (host) for igual, depois de:
  - minúsculas, sem "www." na frente, sem ponto final, sem porta padrão;
  - nomes com letras de outro alfabeto viram punycode (xn--...), que nunca é igual ao nome em letras latinas.
Sufixo (site.com.br.golpe.net), subdomínio (golpe.site.com.br), letras trocadas (rn por m) e
usuário na frente (site.com.br@golpe.net) NÃO são o mesmo site.
"""
import re
from urllib.parse import urlsplit

_HOST_VALIDO = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$")
_IPV4 = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def _partir(url: str):
    u = (url or "").strip()
    if not u:
        return None
    if "://" not in u:
        u = "http://" + u
    try:
        return urlsplit(u)
    except ValueError:
        return None


def host_de(url: str) -> str | None:
    """Nome do servidor, já normalizado. None se o endereço não for válido ou for um IP."""
    p = _partir(url)
    if p is None:
        return None
    try:
        host = p.hostname
        p.port  # valida a porta (levanta ValueError se for inválida)
    except ValueError:
        return None
    if not host or "\\" in (p.netloc or ""):
        return None
    host = host.lower().rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    try:
        host = host.encode("idna").decode("ascii")
    except UnicodeError:
        return None
    if not _HOST_VALIDO.match(host) or _IPV4.match(host):
        return None
    return host


def porta_de(url: str) -> int | None:
    """Porta escrita no endereço, ou None se for a padrão (80/443) ou não houver."""
    p = _partir(url)
    try:
        porta = p.port if p else None
    except ValueError:
        return -1
    return None if porta in (None, 80, 443) else porta


def mesmo_site(url_a: str, url_b: str, aceitar_subdominios: bool = False) -> bool:
    """url_a e url_b são do mesmo site? Com aceitar_subdominios, ajuda.site.com.br conta como site.com.br."""
    ha, hb = host_de(url_a), host_de(url_b)
    if ha is None or hb is None:
        return False
    if porta_de(url_a) != porta_de(url_b):
        return False
    if ha == hb:
        return True
    return aceitar_subdominios and ha.endswith("." + hb)


def chave_da_pagina(url: str) -> str | None:
    """Identificador comparável de uma página: host + caminho + consulta, sem esquema, âncora (#) ou barra final.

    A consulta (?a=b) conta: outra consulta pode ser outra página.
    """
    p = _partir(url)
    host = host_de(url)
    if p is None or host is None:
        return None
    caminho = (p.path or "").rstrip("/")
    porta = porta_de(url)
    consulta = f"?{p.query}" if p.query else ""
    return host + (f":{porta}" if porta else "") + caminho + consulta
