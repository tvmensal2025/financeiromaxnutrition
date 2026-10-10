"""CHK-GANHO-01: o convite não pode ter nenhum termo de ganho.

O convite vai a estranhos em nome do fundador; "complemente sua renda" seria promessa de ganho (risco legal).
A lista de termos fica em dados/termos_de_ganho.json (palavras inteiras, radicais e expressões).

Disfarces que a checagem desfaz antes de procurar:
  - acento e maiúscula (RENDA, rénda);  letras de outro alfabeto parecidas com as latinas (rеnda com "е" russo);
  - letras largas ou compatíveis (ＲＥＮＤＡ);  caracteres invisíveis no meio da palavra;
  - letras separadas (r e n d a, r.e.n.d.a, ren-da, ren_da);
  - números e símbolos no lugar de letras (r3nda, g4nh0, d0lares, reai$);
  - símbolos de moeda (R$, US$, $50, 50$, $$$) e emojis de dinheiro.
"""
import functools
import re

from .. import texto as T
from ..registro import carregar_json, checagem
from ..resultado import Falha

ID = "CHK-GANHO-01"

_LEET = {"0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "|": "l"}
_EMOJIS = set("💰💵💴💶💷💸🤑💲🪙")
_SIMBOLOS = [
    re.compile(r"(?<![a-z0-9])r\s?\$"), re.compile(r"(?<![a-z0-9])us\s?\$"), re.compile(r"(?<![a-z0-9])u\s?\$\s?s?(?![a-z0-9])"),
    re.compile(r"\$\s?\d"), re.compile(r"\d\s?\$"), re.compile(r"\${2,}"),
    re.compile(r"\b\d+\s*(?:reais|real)\b"), re.compile(r"\b(?:um|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|cem|mil|milhao|milhoes)\s+real\b"),
    re.compile(r"\d\s*/\s*(?:h|hr|hora)\b"), re.compile(r"\bp\s*/\s*hora\b"),
]
_SEPARADORES_INTERNOS = re.compile(r"(?<=[a-z0-9])[-_.*·•/\\|~^+=,:;'\"`´]+(?=[a-z0-9])")
_LETRAS_SOLTAS = re.compile(r"(?<![a-z0-9])(?:[a-z0-9][ \t.\-_*]+){2,}[a-z0-9](?![a-z0-9])")
_TOKEN = re.compile(r"[a-z0-9@$!|]+")


@functools.lru_cache(maxsize=1)
def _dados():
    d = carregar_json("termos_de_ganho.json")
    return (set(d["palavras"]), tuple(d["radicais"]),
            tuple(" ".join(T.dobrar(e).split()) for e in d["expressoes"]))


def _variantes(token: str):
    """O token como está e, se tiver número/símbolo no meio de letras, as leituras de 'leet' (r3nda -> renda)."""
    yield token
    if any(c.isalpha() for c in token) and any(c in _LEET or c == "1" for c in token):
        base = "".join(_LEET.get(c, c) for c in token)
        yield base.replace("1", "i")
        yield base.replace("1", "l")


def _palavra_proibida(palavra: str, palavras, radicais):
    if palavra in palavras:
        return palavra
    for r in radicais:
        if palavra.startswith(r):
            return palavra
    return None


def _acha(texto: str):
    """Devolve o termo de ganho encontrado no texto (como foi achado), ou None."""
    palavras, radicais, expressoes = _dados()
    if any(c in _EMOJIS for c in texto):
        return "emoji de dinheiro"
    f = T.dobrar(texto)
    for rx in _SIMBOLOS:
        m = rx.search(f)
        if m:
            return m.group(0)
    vistas = []
    # visão 1: como está; visão 2: sem separadores no meio da palavra; visão 3: letras soltas juntadas
    for visao in (f, _SEPARADORES_INTERNOS.sub("", f)):
        tokens = _TOKEN.findall(visao)
        for tk in tokens:
            for v in _variantes(tk):
                achada = _palavra_proibida(v, palavras, radicais)
                if achada:
                    return tk
        vistas.append(" ".join(tokens))
    for m in _LETRAS_SOLTAS.finditer(f):
        junto = re.sub(r"[ \t.\-_*]+", "", m.group(0))
        for v in _variantes(junto):
            if _palavra_proibida(v, palavras, radicais):
                return m.group(0)
    for juntas in vistas:
        padrao = f" {juntas} "
        for e in expressoes:
            if f" {e} " in padrao:
                return e
    return None


@checagem(ID, "Convite sem termo de ganho",
          "O convite podia prometer ganho sem dizer ('complemente sua renda'); o texto vai a estranhos em nome do fundador.",
          ["C-11"])
def sem_termo_de_ganho(exe):
    if exe.acao != "ENTREGAR" or not exe.opcao("proibir_termos_de_ganho", False):
        return None
    falhas = []
    for i in exe.itens:
        if i.tipo != "livre":
            continue
        achado = _acha(i.texto)
        if achado:
            falhas.append(Falha(ID, "TERMO_DE_GANHO", i.caminho,
                                f"O convite não pode ter termo de ganho ('{achado}'). Tire qualquer menção a dinheiro, renda, ganho, valor por hora ou parecidos.", T.cortar(i.texto)))
    return falhas
