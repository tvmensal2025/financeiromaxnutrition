"""Limpeza do texto das páginas, antes de o agente ler.

O que sai:
- comentários HTML (inclusive o que nunca fecha: vale até o fim da página);
- script, style, noscript, template, svg, iframe e parecidos;
- elementos escondidos de forma direta: atributo hidden, input hidden, e style com
  display:none, visibility:hidden, opacity:0, font-size:0, fora da tela, cor transparente;
- caracteres invisíveis: largura zero, controles de direção, "tag characters" (U+E0000),
  seletores de variação, preenchimentos em branco, caracteres de controle.

O que NÃO dá para fazer aqui: saber se uma classe de CSS externa esconde um texto.
A defesa de verdade contra instrução plantada é outra: quem leu a internet só entrega
(motor) e a ferramenta marca todo conteúdo como "dado externo, não instrução".
"""

import re
import unicodedata
from html.parser import HTMLParser
from typing import List, Optional, Tuple
from urllib.parse import urljoin

ELEMENTOS_IGNORADOS = frozenset({
    "script", "style", "noscript", "template", "svg", "iframe", "object", "embed",
    "canvas", "audio", "video", "math", "datalist",
})
ELEMENTOS_VAZIOS = frozenset({
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
    "param", "source", "track", "wbr",
})
BLOCOS_DE_PARAGRAFO = frozenset({
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "table", "ul", "ol",
    "section", "article", "header", "footer", "nav", "main", "aside", "form",
    "fieldset", "figure", "details", "dl", "title", "body", "html",
})
BLOCOS_DE_LINHA = frozenset({
    "div", "li", "tr", "br", "hr", "dt", "dd", "figcaption", "summary", "caption",
    "address", "center", "menu", "thead", "tbody", "tfoot",
})
MAXIMO_DE_LINKS = 200

_ESTILO_ESCONDIDO = re.compile(
    r"(?:^|;)(?:display:none|visibility:(?:hidden|collapse)|opacity:0(?:\.0*)?"
    r"|font-size:0(?:px|pt|em|rem|%)?|color:transparent"
    r"|(?:left|top|text-indent):-\d{4,}(?:px|em|rem|pt)?)(?:!important)?(?=;|$)"
)
_COMENTARIO = re.compile(r"<!--(?:-?>|.*?(?:--!?>|\Z))", re.DOTALL)

# Caracteres que não se enxergam, mas o computador lê (a lista por categoria cobre o resto).
_INVISIVEIS_EXTRAS = frozenset(
    [0x00AD, 0x034F, 0x061C, 0x115F, 0x1160, 0x17B4, 0x17B5, 0x2800, 0x3164, 0xFFA0]
    + list(range(0x180B, 0x1810))
    + list(range(0xFE00, 0xFE10))
    + list(range(0xE0100, 0xE01F0))
)


def _substituto(caractere: str) -> Optional[str]:
    """None = manter o caractere; texto = trocar por ele ("" apaga)."""
    codigo = ord(caractere)
    if caractere == "\n":
        return None
    categoria = unicodedata.category(caractere)
    if categoria in ("Zl", "Zp") or codigo == 0x85:
        return "\n"
    if caractere == "\t" or categoria == "Zs":
        return " "
    if codigo in _INVISIVEIS_EXTRAS or categoria in ("Cc", "Cf", "Cs", "Co", "Cn"):
        return ""
    return None


def limpar_caracteres(texto: str) -> str:
    """Tira caracteres invisíveis e de controle; espaços raros viram espaço comum."""
    texto = texto.replace("\r\n", "\n").replace("\r", "\n")
    tabela = {}
    for caractere in set(texto):  # só os caracteres diferentes: rápido mesmo em texto grande
        troca = _substituto(caractere)
        if troca is not None:
            tabela[ord(caractere)] = troca
    return unicodedata.normalize("NFC", texto.translate(tabela))


def normalizar_espacos(texto: str) -> str:
    linhas = [re.sub(r"[ \t\f\v]+", " ", linha).strip() for linha in texto.split("\n")]
    texto = "\n".join(linhas)
    return re.sub(r"\n{3,}", "\n\n", texto).strip()


def _esta_escondido(atributos: dict) -> bool:
    if "hidden" in atributos or (atributos.get("type") or "").lower() == "hidden":
        return True
    estilo = re.sub(r"\s+", "", (atributos.get("style") or "").lower())
    return bool(_ESTILO_ESCONDIDO.search(estilo))


class _Extrator(HTMLParser):
    def __init__(self, url_base: str):
        super().__init__(convert_charrefs=True)
        self.url_base = url_base
        self.pedacos: List[str] = []
        self.links: List[str] = []
        self._pilha: List[Tuple[str, bool]] = []
        self._escondendo = 0
        self._quebra_pendente = 0   # quebras pedidas por blocos; várias seguidas valem só a maior

    def handle_starttag(self, tag, attrs):
        atributos = {nome: (valor or "") for nome, valor in attrs}
        escondido = tag in ELEMENTOS_IGNORADOS or _esta_escondido(atributos)
        if tag in ELEMENTOS_VAZIOS:
            if not escondido and not self._escondendo:
                if tag == "br":
                    self.pedacos.append("\n")
                elif tag in BLOCOS_DE_LINHA:
                    self._pedir_quebra(1)
            return
        if tag == "a" and not escondido and not self._escondendo:
            self._guardar_link(atributos.get("href", ""))
        self._pilha.append((tag, escondido))
        if escondido:
            self._escondendo += 1
        elif not self._escondendo:
            self._pedir_quebra_do_bloco(tag)

    def handle_startendtag(self, tag, attrs):
        # <div/> não fecha nada em HTML; só tratamos como início e fim imediatos.
        self.handle_starttag(tag, attrs)
        if tag not in ELEMENTOS_VAZIOS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        indices = [i for i, (nome, _) in enumerate(self._pilha) if nome == tag]
        if not indices:
            return
        alvo = indices[-1]
        while len(self._pilha) > alvo:
            nome, escondido = self._pilha.pop()
            if escondido:
                self._escondendo -= 1
            elif not self._escondendo:
                if nome in ("td", "th"):
                    self.pedacos.append(" ")
                else:
                    self._pedir_quebra_do_bloco(nome)

    def handle_data(self, dados):
        if self._escondendo:
            return
        if self._quebra_pendente and dados.strip():
            self.pedacos.append("\n" * self._quebra_pendente)
            self._quebra_pendente = 0
        self.pedacos.append(dados)

    def _pedir_quebra(self, quantidade: int):
        self._quebra_pendente = max(self._quebra_pendente, quantidade)

    def _pedir_quebra_do_bloco(self, tag: str):
        if tag in BLOCOS_DE_PARAGRAFO:
            self._pedir_quebra(2)
        elif tag in BLOCOS_DE_LINHA:
            self._pedir_quebra(1)

    # Comentários, declarações e instruções de processamento: não fazemos nada (somem).

    def _guardar_link(self, href: str):
        href = href.strip()
        if not href or href.startswith("#") or len(self.links) >= MAXIMO_DE_LINKS:
            return
        try:
            absoluto = urljoin(self.url_base, href)
        except ValueError:
            return
        if absoluto.lower().startswith(("http://", "https://")) and len(absoluto) <= 300 \
                and absoluto not in self.links:
            self.links.append(absoluto)


def extrair_texto_html(html: str, url_base: str) -> Tuple[str, List[str]]:
    """HTML -> (texto limpo, links http/https visíveis)."""
    html = _COMENTARIO.sub("", html)
    extrator = _Extrator(url_base)
    extrator.feed(html)
    extrator.close()
    texto = normalizar_espacos(limpar_caracteres("".join(extrator.pedacos)))
    return texto, extrator.links


def extrair_texto_simples(texto: str) -> str:
    return normalizar_espacos(limpar_caracteres(texto))
