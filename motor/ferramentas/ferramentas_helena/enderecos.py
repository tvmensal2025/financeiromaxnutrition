"""Conferência de endereços (URL) e de números de IP. Sem rede: só texto e contas.

Aqui ficam as regras de "só endereços PÚBLICOS":
- só http e https; só portas 80 e 443; sem usuário e senha dentro do endereço;
- sem nomes internos (localhost, metadata, .internal, .local...) e sem nome sem ponto;
- IP escrito no endereço (3 formas: 127.0.0.1, [::1], 2130706433) é conferido ou recusado;
- caminho de ação (confirmar, login, pagar...) é recusado (catálogo: acesso_sem_efeito);
- consulta (?...) e fragmento (#...) são tirados do endereço.

A conferência do IP que o nome de fato resolve é feita depois, em rede.py, a cada salto.
"""

import ipaddress
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote, unquote, urlsplit

from .erros import ErroFerramenta

PORTAS_PERMITIDAS = (80, 443)
ESQUEMAS_PERMITIDOS = ("http", "https")
TAMANHO_MAXIMO_DA_URL = 2000

# helena-v2/servicos.yaml, ferramentas_nossas.ler_pagina.acesso_sem_efeito
PALAVRAS_DE_ACAO = frozenset(
    "confirmar confirm verificar verify aceitar accept convite invite indicacao ref "
    "descadastrar unsubscribe token login signin signup cadastro register checkout "
    "pagar pay".split()
)

NOMES_INTERNOS = frozenset({
    "localhost", "metadata", "metadata.google.internal", "instance-data",
    "kubernetes", "kubernetes.default", "host.docker.internal", "gateway.docker.internal",
})
SUFIXOS_INTERNOS = (
    ".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp",
    ".private", ".svc", ".localdomain",
)

# Redes que o Python considera "globais" ou que escondem um IPv4 interno dentro de um IPv6.
_NAT64 = ipaddress.ip_network("64:ff9b::/96")
_REDES_V6_BLOQUEADAS = tuple(ipaddress.ip_network(n) for n in (
    "::/96",           # IPv4 embutido no formato antigo (::127.0.0.1)
    "2001::/32",       # Teredo
    "2002::/16",       # 6to4
    "fec0::/10",       # site-local (descontinuado, mas o Python o chama de global)
    "64:ff9b:1::/48",  # NAT64 de uso local
))
_ROTULO = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")


def ip_e_publico(ip_texto: str) -> bool:
    """True só para IP alcançável pela internet pública. Texto que não é IP: False."""
    try:
        ip = ipaddress.ip_address(ip_texto)
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:                     # ::ffff:127.0.0.1
            return ip_e_publico(str(ip.ipv4_mapped))
        if ip in _NAT64:                                   # 64:ff9b::7f00:1
            return ip_e_publico(str(ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)))
        if any(ip in rede for rede in _REDES_V6_BLOQUEADAS):
            return False
    if ip.is_multicast:                                    # o Python chama 224.0.0.1 de global
        return False
    return ip.is_global


@dataclass(frozen=True)
class Endereco:
    """Endereço já conferido e normalizado (sem consulta nem fragmento)."""
    esquema: str
    host: str                    # minúsculo; nome em ASCII (xn--) ou IP sem colchetes
    porta: int
    caminho: str                 # já codificado; sempre começa com "/"
    ip_literal: Optional[str]    # preenchido quando o host é um IP escrito no endereço

    @property
    def url(self) -> str:
        host = f"[{self.host}]" if ":" in self.host else self.host
        padrao = 443 if self.esquema == "https" else 80
        porta = "" if self.porta == padrao else f":{self.porta}"
        return f"{self.esquema}://{host}{porta}{self.caminho}"

    @property
    def cabecalho_host(self) -> str:
        host = f"[{self.host}]" if ":" in self.host else self.host
        padrao = 443 if self.esquema == "https" else 80
        return host if self.porta == padrao else f"{host}:{self.porta}"


def mesmo_dominio(host_a: str, host_b: str) -> bool:
    """Mesmo site, aceitando só a diferença do "www." na frente."""
    def base(host):
        return host[4:] if host.startswith("www.") else host
    return base(host_a) == base(host_b)


def _recusar_interno(detalhe: str):
    raise ErroFerramenta(
        "bloqueado_endereco_interno",
        "Só leio endereços públicos da internet. Este endereço é interno ou reservado.",
        detalhe,
    )


def _sem_acento(texto: str) -> str:
    decomposto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in decomposto if not unicodedata.combining(c))


def _caminho_de_acao(caminho: str) -> Optional[str]:
    texto = caminho
    for _ in range(2):  # decodifica até duas vezes (%2563 -> %63 -> c)
        texto = unquote(texto)
    palavras = set(re.split(r"[^a-z0-9]+", _sem_acento(texto).lower()))
    achadas = sorted(palavras & PALAVRAS_DE_ACAO)
    return achadas[0] if achadas else None


def _parece_numerico(host: str) -> bool:
    rotulos = host.split(".")
    return rotulos[-1].isdigit() or any(r.startswith("0x") for r in rotulos)


def analisar_url(texto) -> Endereco:
    """Confere o endereço e devolve a forma normalizada. Recusa com ErroFerramenta."""
    if not isinstance(texto, str) or not texto.strip():
        raise ErroFerramenta("endereco_invalido", "Informe o endereço completo, começando com https://.")
    texto = texto.strip()
    if len(texto) > TAMANHO_MAXIMO_DA_URL:
        raise ErroFerramenta("endereco_invalido", "Endereço longo demais.")
    if re.search(r"[\x00-\x20\x7f\\]", texto):
        raise ErroFerramenta("endereco_invalido", "Endereço com espaço, quebra de linha ou caractere de controle.")
    try:
        partes = urlsplit(texto)
    except ValueError:
        raise ErroFerramenta("endereco_invalido", "Endereço mal formado.")

    if partes.scheme.lower() not in ESQUEMAS_PERMITIDOS:
        raise ErroFerramenta("esquema_nao_permitido", "O endereço precisa começar com http:// ou https://.")
    esquema = partes.scheme.lower()

    if "@" in partes.netloc or partes.username is not None or partes.password is not None:
        raise ErroFerramenta("credenciais_na_url", "Endereço com usuário ou senha não é aceito.")

    try:
        porta = partes.port
        host = partes.hostname
    except ValueError:
        raise ErroFerramenta("endereco_invalido", "Porta ou endereço mal formado.")
    if not host:
        raise ErroFerramenta("endereco_invalido", "Endereço sem nome de site.")
    if porta is None:
        porta = 443 if esquema == "https" else 80
    if porta not in PORTAS_PERMITIDAS:
        raise ErroFerramenta("porta_nao_permitida", "Só são aceitas as portas 80 e 443.", f"porta={porta}")
    if "%" in host:
        raise ErroFerramenta("endereco_invalido", "Endereço com escopo de rede não é aceito.")

    ip_literal = None
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None:
        if not ip_e_publico(str(ip)):
            _recusar_interno(f"ip_literal={ip}")
        ip_literal = str(ip)
        host = ip.compressed
    else:
        if ":" in host:
            raise ErroFerramenta("endereco_invalido", "Endereço mal formado.")
        try:  # o IDNA troca pontos e números "largos" por comuns: só depois dá para conferir
            host = host.rstrip(".").encode("idna").decode("ascii").lower()
        except UnicodeError:
            raise ErroFerramenta("endereco_invalido", "Nome de site inválido.")
        if _parece_numerico(host):
            raise ErroFerramenta("endereco_invalido", "Endereço numérico fora do padrão não é aceito.")
        rotulos = host.split(".")
        if len(host) > 253 or not all(_ROTULO.match(r) for r in rotulos):
            raise ErroFerramenta("endereco_invalido", "Nome de site inválido.")
        if len(rotulos) < 2 or host in NOMES_INTERNOS or host.endswith(SUFIXOS_INTERNOS):
            _recusar_interno(f"nome={host}")

    caminho = partes.path or "/"
    palavra = _caminho_de_acao(caminho)
    if palavra:
        raise ErroFerramenta(
            "caminho_de_acao",
            "Este endereço parece uma ação (confirmar, entrar, pagar...), não uma página para ler.",
            f"palavra={palavra}",
        )
    caminho = quote(caminho, safe="/%:@!$&'()*+,;=-._~")
    return Endereco(esquema=esquema, host=host, porta=porta, caminho=caminho, ip_literal=ip_literal)
