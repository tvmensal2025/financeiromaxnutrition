"""Funções de texto usadas por todas as checagens (só biblioteca padrão).

Duas ideias simples:
  - normalizar(): deixa o texto "comparável" (aspas, espaços e travessões iguais) SEM mudar as palavras.
  - dobrar(): tira acento, maiúscula e letras parecidas de outros alfabetos (para procurar termos).
"""
import re
import unicodedata

# ---------------------------------------------------------------------------------------
# Caracteres invisíveis (categoria Unicode "Cf"). Lista escrita à mão para a importação ser
# rápida; um teste confere que ela cobre todos os caracteres Cf desta versão do Python.
# ---------------------------------------------------------------------------------------
FAIXAS_INVISIVEIS = [
    (0xAD, 0xAD), (0x600, 0x605), (0x61C, 0x61C), (0x6DD, 0x6DD), (0x70F, 0x70F),
    (0x890, 0x891), (0x8E2, 0x8E2), (0x180E, 0x180E), (0x200B, 0x200F), (0x202A, 0x202E),
    (0x2060, 0x2064), (0x2066, 0x206F), (0xFEFF, 0xFEFF), (0xFFF9, 0xFFFB), (0x110BD, 0x110BD),
    (0x110CD, 0x110CD), (0x13430, 0x1343F), (0x1BCA0, 0x1BCA3), (0x1D173, 0x1D17A),
    (0xE0001, 0xE0001), (0xE0020, 0xE007F),
]
INVISIVEIS = re.compile(
    "[" + "".join(f"{chr(a)}-{chr(b)}" if a != b else chr(a) for a, b in FAIXAS_INVISIVEIS) + "]"
)
# Controles (menos tab, quebra de linha e retorno) e separadores de linha/parágrafo Unicode.
CONTROLES = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
SEPARADORES_UNICODE = re.compile("[  ]")

# Aspas e apóstrofos: removidos dos dois lados da comparação (citação honesta pode trocar “ ” por ").
_ASPAS = "\"'“”„‟«»‹›‘’‚‛`´′″"
TABELA_ASPAS = {ord(c): None for c in _ASPAS}
# Travessões e hífens parecidos viram "-".
TABELA_TRACOS = {ord(c): "-" for c in "–—―−‐‑‒⁃﹘﹣－"}

_ESPACOS_HORIZONTAIS = re.compile(r"[^\S\n]+")
_QUEBRAS = re.compile(r" *\n[\s]*")


def normalizar_com_quebras(texto: str) -> str:
    """Forma B: NFKC, sem invisíveis, sem aspas, travessões iguais, espaços colapsados. Mantém UMA quebra de linha onde havia."""
    if not texto:
        return ""
    t = unicodedata.normalize("NFKC", texto)
    t = SEPARADORES_UNICODE.sub("\n", t)
    t = INVISIVEIS.sub("", t)
    t = CONTROLES.sub(" ", t)
    t = t.replace("İ", "I")  # evita o único caso em que minúscula muda o tamanho do texto
    t = t.translate(TABELA_ASPAS).translate(TABELA_TRACOS)
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    t = _ESPACOS_HORIZONTAIS.sub(" ", t)
    t = _QUEBRAS.sub("\n", t)
    return t.strip()


def normalizar(texto: str) -> str:
    """Forma A: igual à B, mas tudo em uma linha (cada quebra vira UM espaço; as posições não mudam)."""
    return normalizar_com_quebras(texto).replace("\n", " ")


def chave(texto: str) -> str:
    """Forma A em minúsculas: é com ela que citação e página são comparadas."""
    return normalizar(texto).lower()


# ---------------------------------------------------------------------------------------
# Procurar termos: sem acento, sem maiúscula, sem letras "parecidas" de outros alfabetos.
# ---------------------------------------------------------------------------------------
_PARECIDAS = {
    # cirílico
    "а": "a", "в": "b", "е": "e", "ё": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p",
    "с": "c", "т": "t", "у": "y", "х": "x", "і": "i", "ї": "i", "ј": "j", "ѕ": "s", "ԁ": "d",
    "ԛ": "q", "ԝ": "w", "ӏ": "l", "ь": "b", "ѵ": "v",
    # grego
    "α": "a", "β": "b", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t",
    "υ": "u", "χ": "x", "γ": "y", "η": "n", "μ": "u", "ω": "w",
    # latinas "especiais" que enganam o olho
    "ɡ": "g", "ɑ": "a", "ɩ": "i", "ο": "o", "ı": "i", "ȷ": "j", "ʀ": "r", "ɴ": "n",
}
TABELA_PARECIDAS = {ord(k): v for k, v in _PARECIDAS.items()}


def dobrar(texto: str) -> str:
    """Minúsculas, sem acento, sem invisíveis, com letras parecidas de outros alfabetos trocadas pelas latinas."""
    if not texto:
        return ""
    t = unicodedata.normalize("NFKC", texto)
    t = INVISIVEIS.sub("", t)
    t = t.lower().translate(TABELA_PARECIDAS)
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t


# ---------------------------------------------------------------------------------------
# Palavras, linhas e frases
# ---------------------------------------------------------------------------------------
def palavras(texto: str) -> list[str]:
    """Palavras como uma pessoa conta: pedaços separados por espaço que tenham pelo menos uma letra ou número."""
    return [p for p in texto.split() if any(c.isalnum() for c in p)]


def contar_palavras(texto: str) -> int:
    return len(palavras(texto))


_TOKEN_ALFA = re.compile(r"[^\W\d_]+", re.UNICODE)


def tokens_alfa(texto: str) -> list[str]:
    """Palavras só de letras, já dobradas (sem acento e minúsculas)."""
    return _TOKEN_ALFA.findall(dobrar(texto))


def linhas(texto: str) -> list[str]:
    """Linhas não vazias do texto (cada uma é um 'parágrafo' para as checagens)."""
    return [l.strip() for l in (texto or "").replace("\r\n", "\n").replace("\r", "\n").split("\n") if l.strip()]


# Abreviações que terminam em ponto sem terminar a frase.
ABREVIACOES = {
    "art", "arts", "cap", "caps", "inc", "par", "pag", "pags", "p", "pp", "no", "nos", "n", "sr", "sra", "srs",
    "dr", "dra", "prof", "profa", "ex", "exs", "vs", "cf", "obs", "tel", "av", "r", "ltda", "cia", "etc",
    "sec", "vol", "fig", "jr", "mr", "mrs", "ms", "st", "inc", "co", "ltd", "al", "min", "max", "aprox",
    "ref", "fl", "fls", "apud", "ibid", "op", "cit", "u.s", "e.g", "i.e", "a.m", "p.m",
}


def _termina_em_abreviacao(texto: str, pos: int) -> bool:
    """O ponto em texto[pos] faz parte de uma abreviação (art., nº, Dr., R., 4.)?"""
    ini = pos
    while ini > 0 and not texto[ini - 1].isspace():
        ini -= 1
    palavra = texto[ini:pos].strip("()[]").lower()
    if palavra in ABREVIACOES:
        return True
    if len(palavra) == 1 and palavra.isalpha():
        return True  # "R. Silva", "J. K."
    if "." in palavra:  # siglas com pontos: "u.s", "e.g"
        return True
    return False


_MARCADOR_DE_LISTA = re.compile(r"^\s*(?:[-•*·]|\d+[.)]|[a-zA-Z][.)])\s*$")


def inicio_de_frase(texto_b: str, pos: int) -> bool:
    """A posição `pos` (na forma B) começa uma frase?"""
    if pos <= 0:
        return True
    # só espaços/marcador de lista entre o começo da linha e `pos`
    ini_linha = texto_b.rfind("\n", 0, pos) + 1
    if _MARCADOR_DE_LISTA.match(texto_b[ini_linha:pos]) or texto_b[ini_linha:pos].strip() == "":
        return True
    j = pos - 1
    while j >= 0 and texto_b[j] == " ":
        j -= 1
    if j < 0:
        return True
    if texto_b[j] not in ".!?":
        return False
    if _termina_em_abreviacao(texto_b, j) and texto_b[j] == ".":
        return False
    # a próxima letra tem de "parecer" começo de frase
    c = texto_b[pos]
    return c.isupper() or c.isdigit() or not c.isalpha()


def fim_de_frase(texto_b: str, pos: int) -> bool:
    """A posição `pos` (logo DEPOIS do último caractere do trecho, forma B) termina uma frase?"""
    n = len(texto_b)
    if pos >= n or texto_b[pos] == "\n":
        return True
    if texto_b[pos] in ".!?":
        if texto_b[pos] == "." and _termina_em_abreviacao(texto_b, pos):
            return False
        k = pos
        while k < n and texto_b[k] in ".!?…":
            k += 1
        return k >= n or texto_b[k] in " \n"
    return False


def spans_de_frases(texto_b: str) -> list[tuple[int, int]]:
    """Posições (início, fim) de cada frase de um texto na forma B (com quebras de linha)."""
    spans, ini, i, n = [], 0, 0, len(texto_b)

    def fechar(fim_exclusivo):
        nonlocal ini
        a, b = ini, fim_exclusivo
        while a < b and texto_b[a].isspace():
            a += 1
        while b > a and texto_b[b - 1].isspace():
            b -= 1
        if b > a:
            spans.append((a, b))
        ini = fim_exclusivo

    while i < n:
        c = texto_b[i]
        if c == "\n":
            fechar(i + 1)
        elif c in ".!?" and not (c == "." and _termina_em_abreviacao(texto_b, i)):
            k = i
            while k + 1 < n and texto_b[k + 1] in ".!?…":
                k += 1
            if k + 1 >= n or texto_b[k + 1] in " \n":
                fechar(k + 1)
                i = k
        i += 1
    fechar(n)
    return spans


def separar_frases(texto: str) -> list[str]:
    """Divide um texto em frases (usado pelas checagens que olham 'a frase onde aparece X')."""
    b = normalizar_com_quebras(texto)
    return [b[a:z] for a, z in spans_de_frases(b)]


def dobrar_posicional(texto: str) -> str:
    """Como dobrar(), mas cada caractere vira exatamente UM caractere (as posições não mudam)."""
    return "".join(unicodedata.normalize("NFD", c)[0].lower() for c in texto)


# ---------------------------------------------------------------------------------------
# Endereços (links)
# ---------------------------------------------------------------------------------------
_TLDS = "com|net|org|br|io|app|co|me|info|gov|edu|dev|tech|ai|site|online|xyz|pt|us|uk|eu|ly|tv|shop|store|club|top|link"
RE_URL = re.compile(
    r"(?:https?://|www\.)[^\s<>\"'“”‘’«»\])]+"
    r"|(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:" + _TLDS + r")(?![a-z0-9-])(?:/[^\s<>\"'“”‘’«»\])]*)?",
    re.IGNORECASE,
)


def achar_urls(texto: str) -> list[str]:
    """Endereços escritos no texto (com http, com www ou só o domínio), sem pontuação no fim."""
    achados = []
    for m in RE_URL.finditer(texto or ""):
        u = m.group(0).rstrip(".,;:!?)")
        if u:
            achados.append(u)
    return achados


def cortar(texto: str, tamanho: int = 120) -> str:
    """Trecho curto para mostrar no relatório."""
    t = " ".join((texto or "").split())
    return t if len(t) <= tamanho else t[: tamanho - 1] + "…"
