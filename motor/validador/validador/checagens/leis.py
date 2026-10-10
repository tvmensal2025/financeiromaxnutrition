"""Tabela de leis — quatro checagens:

CHK-LEI-01  lei citada FORA da tabela chega marcada "não conferida" (lei com ano no futuro, ou com número e
            ano que não batem com a tabela, é RECUSA: não pode existir assim).
CHK-LEI-02  artigo citado sem o trecho vem RECUSADO; se a lei já foi conferida, o trecho tem de existir no texto oficial.
CHK-LEI-03  lei da tabela cujo texto oficial AINDA NÃO foi conferido pelo fundador: marca em todo uso.
CHK-LEI-04  artigo que exige nota de jurisprudência (ex.: art. 19 do Marco Civil) usado sem a nota: marca.

O validador NÃO sabe o texto de nenhuma lei: quem preenche `texto_oficial_a_conferir` é uma pessoa (ver README).
Enquanto estiver vazio, o status é NAO_CONFERIDA e todo uso de lei sai com marca.
"""
import bisect
import functools
import re
import unicodedata
from dataclasses import dataclass

from .. import enderecos as E
from .. import texto as T
from ..contexto import validar_tabela_de_leis
from ..execucao import Pagina
from ..registro import CONFIG, carregar_json, checagem
from ..resultado import Falha

ID1, ID2, ID3, ID4 = "CHK-LEI-01", "CHK-LEI-02", "CHK-LEI-03", "CHK-LEI-04"


# ---------------------------------------------------------------------------------------
# A tabela
# ---------------------------------------------------------------------------------------
def conferida(lei: dict) -> bool:
    return lei.get("status") == "CONFERIDA" and bool((lei.get("texto_oficial_a_conferir") or "").strip())


@functools.lru_cache(maxsize=1)
def _tabela_padrao() -> dict:
    return validar_tabela_de_leis(carregar_json("leis.json"))


def tabela(exe) -> dict:
    """Tabela de leis desta execução: a do contexto (para testes) ou a do arquivo dados/leis.json."""
    return exe.contexto.get("tabela_de_leis") or _tabela_padrao()  # a do contexto já foi conferida em conferir_contexto


def lei_por_id(exe, id_: str):
    for lei in tabela(exe)["leis"]:
        if lei["id"] == id_:
            return lei
    return None


def como_pagina(lei: dict) -> Pagina:
    return Pagina(lei["id"], lei.get("url_oficial", ""), "lei", None, 1, {1: lei["texto_oficial_a_conferir"]})


# ---------------------------------------------------------------------------------------
# Achar leis e artigos no texto
# ---------------------------------------------------------------------------------------
@dataclass
class Mencao:
    inicio: int
    fim: int
    texto: str
    lei: dict | None  # linha da tabela, ou None se estiver fora dela
    motivo: str = ""  # para lei fora da tabela: LEI_FORA_DA_TABELA, LEI_COM_ANO_NO_FUTURO, NUMERO_E_ANO_NAO_BATEM


_NORMA_NUMERADA = re.compile(
    r"\b(?P<tipo>Lei\s+Complementar|Lei|Decreto-Lei|Decreto|Medida\s+Provis[óo]ria|Resolu[çc][ãa]o|Portaria)\s*"
    r"(?:n[ºo°.]{0,2}\s*)?(?P<num>\d{1,3}(?:\.\d{3})+|\d{3,6})"
    r"(?:\s*/\s*(?P<ano>\d{4}|\d{2})\b|\s*,\s*de\s+\d{1,2}\s+de\s+\w+\s+de\s+(?P<ano2>\d{4}))?"
)
_NOMES_FORA = re.compile(
    r"\b(?:Constitui[çc][ãa]o\s+(?:Federal|da\s+Rep[úu]blica)|CF/(?:19)?88|C[óo]digo\s+Penal|C[óo]digo\s+de\s+Processo\s+(?:Civil|Penal)|"
    r"C[óo]digo\s+Tribut[áa]rio\s+Nacional|Estatuto\s+da\s+Crian[çc]a\s+e\s+do\s+Adolescente|Estatuto\s+da\s+Pessoa\s+Idosa|"
    r"Estatuto\s+do\s+Idoso|CPC|CPP|CTN|ECA(?!\s+Digital))\b"
)
_LEI_COM_NOME = re.compile(r"\bLei\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][\wÀ-ÿ]+){0,4}")


def _ano(txt):
    if not txt:
        return None
    a = int(txt)
    if len(txt) == 2:
        a += 2000 if a <= 30 else 1900
    return a


def _normalizar_numero(txt: str) -> str:
    return txt.replace(".", "").lstrip("0")


def _tipo_da_norma(txt: str) -> str:
    t = re.sub(r"\s+", " ", txt)
    return "Lei" if t.startswith("Lei") and "Complementar" not in t else t


def _apelidos_compilados(exe) -> list:
    """[(lei, regex do apelido, é sigla?, apelido)] — montado uma vez por execução, do mais comprido para o mais curto."""
    def montar():
        saida = []
        for lei in tabela(exe)["leis"]:
            for ap in sorted(set(lei.get("apelidos", [])) | {lei["nome"]}, key=len, reverse=True):
                rx = re.compile(r"(?<![a-z0-9])" + re.escape(T.dobrar_posicional(ap)) + r"(?![a-z0-9])")
                saida.append((lei, rx, ap.isupper() and len(ap) <= 8, ap))
        return saida
    return exe.memo("apelidos_de_leis", montar)


def mencoes(base: str, exe) -> list:
    """Leis citadas num texto (já em NFKC), na ordem em que aparecem. Tabela primeiro, depois norma numerada, depois nomes."""
    leis = tabela(exe)["leis"]
    achadas, ocupado = [], bytearray(len(base))  # ocupado[i] = 1 se o caractere i já faz parte de uma lei achada

    def livre(a, b):
        return not any(ocupado[a:b])

    def ocupar(a, b):
        ocupado[a:b] = b"\x01" * (b - a)

    fold = T.dobrar_posicional(base)
    # 1) apelidos e nomes da tabela
    candidatos = []
    for lei, rx, sigla, ap in _apelidos_compilados(exe):
        for m in rx.finditer(fold):
            if sigla and base[m.start():m.end()] != ap:
                continue
            candidatos.append((m.start(), m.end(), lei))
    for a, b, lei in sorted(candidatos, key=lambda x: (-(x[1] - x[0]), x[0])):
        if livre(a, b):
            ocupar(a, b)
            achadas.append(Mencao(a, b, base[a:b], lei))
    # 2) leis e decretos com número
    for m in _NORMA_NUMERADA.finditer(base):
        a, b = m.start(), m.end()
        if not livre(a, b):
            continue
        ocupar(a, b)
        tipo, num, ano = _tipo_da_norma(m.group("tipo")), _normalizar_numero(m.group("num")), _ano(m.group("ano") or m.group("ano2"))
        achada = next((l for l in leis if l.get("norma", {}).get("tipo") == tipo and l["norma"].get("numero") == num), None)
        if achada is not None:
            if ano is not None and ano != achada["norma"].get("ano"):
                achadas.append(Mencao(a, b, m.group(0), None, "NUMERO_E_ANO_NAO_BATEM"))
            else:
                achadas.append(Mencao(a, b, m.group(0), achada))
        elif ano is not None and ano > exe.hoje.year:
            achadas.append(Mencao(a, b, m.group(0), None, "LEI_COM_ANO_NO_FUTURO"))
        else:
            achadas.append(Mencao(a, b, m.group(0), None, "LEI_FORA_DA_TABELA"))
    # 3) outros nomes de lei
    for rx in (_NOMES_FORA, _LEI_COM_NOME):
        for m in rx.finditer(base):
            if livre(m.start(), m.end()):
                ocupar(m.start(), m.end())
                achadas.append(Mencao(m.start(), m.end(), m.group(0), None, "LEI_FORA_DA_TABELA"))
    return sorted(achadas, key=lambda x: x.inicio)


_ART_INICIO = re.compile(r"\b(?:artigos?|arts?\.?)\s*", re.I)
_ART_NUM = re.compile(r"(\d+)\s*[ºo°]?(?:\s*-\s*[A-Z]\b)?")
_ART_SEP = re.compile(r"\s*(?:,|;|\be\b|\ba\b|\bao\b|à)\s*")


def artigos(base: str) -> list:
    """[(posição, número do artigo)] — entende 'art. 7º', 'arts. 7º e 11', 'artigo 19'."""
    achados = []
    for m in _ART_INICIO.finditer(base):
        i = m.end()
        while True:
            n = _ART_NUM.match(base, i)
            if not n:
                break
            achados.append((m.start(), n.group(1)))
            i = n.end()
            s = _ART_SEP.match(base, i)
            if s and _ART_NUM.match(base, s.end()):
                i = s.end()
            else:
                break
    return achados


_CITADO_ENTRE_ASPAS = re.compile(r"“([^”]+)”|\"([^\"]+)\"|«([^»]+)»|‘([^’]+)’")
_NOTA = re.compile(r"jurisprudenc|\bstf\b|\bstj\b|sumula|tese de repercussao|\btema \d+|tribunal|entendimento d[oa]s? ")


def _trechos_entre_aspas(base: str) -> list:
    return [next(g for g in m.groups() if g) for m in _CITADO_ENTRE_ASPAS.finditer(base)]


# ---------------------------------------------------------------------------------------
# Análise única (as 4 checagens leem o resultado)
# ---------------------------------------------------------------------------------------
def _so_texto(v) -> str:
    return v if isinstance(v, str) else ""


def _mais_perto(ms: list, inicios: list, pos: int):
    """A menção de lei mais próxima da posição `pos` (ms está ordenada por início)."""
    k = bisect.bisect_left(inicios, pos)
    return min(ms[max(0, k - 2):k + 2], key=lambda x: min(abs(x.inicio - pos), abs(x.fim - pos)))


def _aponta_para_a_lei(exe, citacao, lei: dict) -> bool:
    """A citação é da fonte importada da lei, ou de uma página lida que é o site oficial da lei?"""
    d = citacao.dados
    if d.get("fonte_importada_id") == lei["id"]:
        return True
    pagina = exe.pagina(d.get("leitura_id"))
    alvo = E.chave_da_pagina(lei.get("url_oficial", ""))
    return bool(pagina and alvo and E.chave_da_pagina(pagina.url) == alvo)


def _analisar(exe) -> dict:
    saida = {ID1: [], ID2: [], ID3: [], ID4: []}
    confere_leis = bool(exe.opcao("confere_leis", False))
    cfg = CONFIG["leis"]
    ja_marcada = set()
    houve = False
    # citação que aponta para uma lei da tabela ainda sem texto oficial não pode ser conferida: marca (mesmo que a frase não nomeie a lei)
    for c in exe.citacoes:
        lei = lei_por_id(exe, c.dados.get("fonte_importada_id")) if isinstance(c.dados.get("fonte_importada_id"), str) else None
        if lei is not None and not conferida(lei) and lei["id"] not in ja_marcada:
            houve = True
            ja_marcada.add(lei["id"])
            saida[ID3].append(Falha(ID3, "TEXTO_OFICIAL_NAO_CONFERIDO", c.caminho,
                                    f"{lei['nome']}: o texto oficial desta lei ainda não foi conferido na tabela, então a citação não pode ser conferida. Chega marcada 'lei não conferida'.",
                                    T.cortar(_so_texto(c.dados.get("trecho_original")))))
    for item in exe.itens:
        if item.tipo != "livre":
            continue
        base = unicodedata.normalize("NFKC", item.texto)
        ms, arts = mencoes(base, exe), artigos(base)
        inicios = [x.inicio for x in ms]
        if not ms and not (arts and confere_leis):
            continue
        houve = True
        # leis fora da tabela / dados que não batem
        for m in ms:
            if m.lei is None:
                saida[ID1].append(Falha(ID1, m.motivo, item.caminho, {
                    "LEI_FORA_DA_TABELA": f"Lei não conferida: '{m.texto}' não está na tabela de leis. Chega ao fundador marcada 'não conferida'.",
                    "LEI_COM_ANO_NO_FUTURO": f"'{m.texto}' tem ano no futuro: essa lei não pode existir ainda. Corrija ou retire.",
                    "NUMERO_E_ANO_NAO_BATEM": f"'{m.texto}': o número e o ano não batem com a tabela de leis. Confira a lei.",
                }[m.motivo], m.texto))
            elif not conferida(m.lei) and m.lei["id"] not in ja_marcada:
                ja_marcada.add(m.lei["id"])
                saida[ID3].append(Falha(ID3, "TEXTO_OFICIAL_NAO_CONFERIDO", item.caminho,
                                        f"{m.lei['nome']}: o texto oficial desta lei ainda não foi conferido na tabela. Chega marcada 'lei não conferida'.", m.texto))
        # artigos
        quotes = [q for q in _trechos_entre_aspas(base) if T.contar_palavras(q) >= cfg["min_palavras_do_trecho"]]
        for pos, numero in arts:
            if not ms:
                if confere_leis:
                    saida[ID2].append(Falha(ID2, "ARTIGO_SEM_LEI", item.caminho, f"O artigo {numero} vem sem dizer de que lei é. Diga a lei e cite o trecho.", base[pos:pos + 30]))
                continue
            m = _mais_perto(ms, inicios, pos)
            if m.lei is None:
                continue  # lei fora da tabela: já marcada em CHK-LEI-01
            lei = m.lei
            cits = [c for c in (item.grupo.citacoes if item.grupo else []) if _aponta_para_a_lei(exe, c, lei)]
            cits = [c for c in cits if T.contar_palavras(_so_texto(c.dados.get("trecho_original"))) >= cfg["min_palavras_do_trecho"]]
            if not quotes and not cits:
                saida[ID2].append(Falha(ID2, "ARTIGO_SEM_TRECHO", item.caminho,
                                        f"O artigo {numero} ({lei['nome']}) vem sem o trecho. Cite o trecho do artigo, entre aspas ou numa citação da tabela de leis.", base[pos:pos + 30]))
            elif quotes and not cits and conferida(lei):
                texto_oficial = T.chave(lei["texto_oficial_a_conferir"])
                if not any(T.chave(q).strip(" .,;:!?…") in texto_oficial for q in quotes):
                    saida[ID2].append(Falha(ID2, "TRECHO_NAO_CONFERE_COM_A_TABELA", item.caminho,
                                            f"O trecho citado do artigo {numero} não existe no texto oficial de '{lei['nome']}' guardado na tabela.", T.cortar(quotes[0])))
            digitos = re.sub(r"\D", "", numero)
            if digitos in set(lei.get("artigos_com_nota_obrigatoria", [])):
                contexto_nota = T.dobrar(" ".join([item.texto] + ([item.grupo.texto] if item.grupo else [])))
                if not _NOTA.search(contexto_nota):
                    saida[ID4].append(Falha(ID4, "ARTIGO_SEM_NOTA_DE_JURISPRUDENCIA", item.caminho,
                                            f"O artigo {numero} ({lei['nome']}) exige nota de jurisprudência junto, e ela não veio. Chega marcado.", base[pos:pos + 30]))
    return saida if houve else None


def _resultado(exe, id_):
    if not exe.formato_ok or exe.acao is None:
        return None
    r = exe.memo("analise_de_leis", lambda: _analisar(exe) or {})
    return r.get(id_) if r else None


@checagem(ID1, "Lei citada está na tabela de leis",
          "Uma lei inventada (ou que ninguém conferiu) podia aparecer num parecer com cara de segura.",
          ["K-18", "C-10"], gravidade="MARCA")
def lei_na_tabela(exe):
    return _resultado(exe, ID1)


@checagem(ID2, "Artigo vem com o trecho da tabela",
          "Artigo citado sem o trecho (ou com trecho que não está no texto oficial) não dá para conferir.",
          ["K-18", "C-10"])
def artigo_com_trecho(exe):
    return _resultado(exe, ID2)


@checagem(ID3, "Texto oficial da lei conferido na tabela",
          "A tabela de leis nasce com o texto oficial vazio; enquanto o fundador não conferir, todo uso de lei sai marcado.",
          ["K-18", "C-10"], gravidade="MARCA")
def lei_conferida(exe):
    return _resultado(exe, ID3)


@checagem(ID4, "Artigo com nota de jurisprudência quando exigida",
          "Artigo cujo sentido os tribunais mudaram (ex.: art. 19 do Marco Civil) era citado como se valesse sozinho.",
          ["C-10"], gravidade="MARCA")
def artigo_com_nota(exe):
    return _resultado(exe, ID4)
