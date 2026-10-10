"""CHK-COMUM-04: texto puro — sem HTML, script, imagem ou caractere invisível.

O que o agente escreve aparece no app como texto simples. Código de página escondido num texto (ou letras
invisíveis que mudam o que o revisor lê) poderia virar instrução para a próxima tarefa ou imagem espiã.
A checagem olha TODA string da resposta (valores e também nomes de campo), não só os textos de seção.
"""
import re
import unicodedata

from .. import texto as T
from ..registro import checagem
from ..resultado import Falha

ID = "CHK-COMUM-04"

_TAGS = ("html head body script style img a div span p br hr iframe object embed form input button link meta svg "
         "table tr td th ul ol li h1 h2 h3 h4 h5 h6 b i u em strong font center section article nav header footer main "
         "video audio source canvas noscript base title textarea select option label details summary marquee applet "
         "frame frameset param math").split()
_NOMES = "|".join(_TAGS)

PADROES = [
    ("HTML_OU_SCRIPT", re.compile(rf"<\s*/?\s*(?:{_NOMES})\b[^>]*>", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"<![a-z-]|<\?[a-z]|<!--|-->", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"<[a-z][a-z0-9-]*\s+[a-z-]+\s*=\s*[\"'][^>]*>", re.I)),
    ("HTML_OU_SCRIPT", re.compile(rf"&lt;\s*/?\s*(?:{_NOMES}|!--)", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"&#(?:0*60|x0*3c);\s*/?[a-z!]", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"(?:javascript|vbscript)\s*:", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:|v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"&amp;(?:lt|#0*60|#x0*3c);\s*/?[a-z!]", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"\bon(?:click|load|error|mouse\w+|focus|blur|submit|change|input|key\w+|toggle|animation\w+|pointer\w+|begin|end)\s*=", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"data\s*:\s*(?:text/html|image/|application/|;base64)", re.I)),
    ("HTML_OU_SCRIPT", re.compile(r"\bon[a-z]{3,}\s*=\s*[\"']", re.I)),
    ("IMAGEM", re.compile(r"!\[[^\]]*\]\([^)]*\)")),
]


def _strings(obj, caminho="resposta"):
    """Todas as strings (valores e nomes de campo) com o caminho de cada uma."""
    if isinstance(obj, str):
        yield caminho, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield f"{caminho}.{k}", str(k)
            yield from _strings(v, f"{caminho}.{k}")
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            yield from _strings(v, f"{caminho}[{i}]")


@checagem(ID, "Texto puro: sem HTML, script, imagem ou caractere invisível",
          "Código de página, imagem espiã ou letra invisível escondidos num texto de IA podiam virar instrução ou clique no app.",
          ["M-13", "B-9"])
def texto_puro(exe):
    if not exe.formato_ok or not isinstance(exe.acao_obj, dict):
        return None
    falhas = []
    for caminho, s in _strings(exe.acao_obj):
        motivo = None
        s = unicodedata.normalize("NFKC", s)  # "＜script＞" com letras largas vira "<script>"
        for nome, rx in PADROES:
            m = rx.search(s)
            if m:
                motivo, achado = nome, m.group(0)
                break
        if motivo:
            msg = "Há código de página (HTML ou script) no texto. Escreva só texto puro." if motivo == "HTML_OU_SCRIPT" else "Há uma imagem no texto. Escreva só texto puro."
            falhas.append(Falha(ID, motivo, caminho, msg, T.cortar(achado)))
            continue
        m = T.INVISIVEIS.search(s) or T.CONTROLES.search(s) or T.SEPARADORES_UNICODE.search(s)
        if m:
            falhas.append(Falha(ID, "CARACTERE_INVISIVEL", caminho,
                                f"Há um caractere invisível no texto (código U+{ord(m.group(0)):04X}). Retire.", T.cortar(s)))
    return falhas
