"""CHK-COMUM-03: o texto do agente está em português?

Heurística simples e explicável (sem IA, sem biblioteca):
  1. Pegamos as palavras só de letras (sem acento e em minúsculas).
  2. Contamos quantas são "palavrinhas de ligação" (o, os, uma, não, com, para, pelo...) que só existem
     em português, quantas só em inglês (the, of, and, is...) e quantas só em espanhol (el, los, y, con...).
     Palavras que existem em duas línguas (de, que, para, por, se...) NÃO contam, para não confundir.
  3. Letras que só o português usa (ã, õ, ç, à, â, ê, ô) contam como ponto a favor do português.
  4. Dinheiro não conta como palavra: "US$ 0,50" e "R$ 540" saem antes da conta (o "US" colado no cifrão parecia
     a palavra inglesa "us" e fazia uma frase em português com muitos números parecer inglesa). Números já não entram.
  5. Dizemos "não é português" só quando OUTRA língua aparece com força e o português quase não aparece.
Texto curto (menos palavras que o mínimo da configuração) não é julgado: não dá para ter certeza.

A citação ORIGINAL (trecho_original) pode estar em outra língua e não entra aqui; a tradução entra.
"""
import re

from .. import texto as T
from ..registro import CONFIG, checagem
from ..resultado import Falha

ID = "CHK-COMUM-03"

_PT = set("""o os as um uma uns umas nao sim ao aos pelo pela pelos pelas nas na dos das do da em com mas ou mais
tambem ja ate apos sem ha foi sao era eram ser sera serao sendo tem tinha teve ter deve devem deverao pode podem
poderao esta estao este esse essa isso isto aquele aquela voce voces seu sua seus suas meu minha nosso nossa
nossos nossas ele ela eles elas onde qual quais cada todo toda todos todas muito muita muitos muitas pouco
quando como porque ainda sempre nunca depois antes entao assim apenas somente cada outro outra outros outras
fazer faz fez feito vai vao fica ficam sobre durante conforme segundo mesmo mesma lhe lhes dele dela deles delas
aqui ali la agora hoje ontem amanha de que para por se no nos e a desde entre""".split())
_EN = set("""the of and to in is that for it with as was on are this be by at from or an have has had not you your we
our will can may must all any their they which if but do does did shall should would could been being were
there than then them these those what when where who whom whose why how into about over under between through
also only more most such other some very just its it's he she his her him my me us i""".split())
_ES = set("""el los las y en un una unos unas del al es son lo le les se su sus pero porque tambien muy mas esta estan
hay fue fueron como cuando donde que cual cuales sin sobre entre desde hasta todo todos cada nuestro nuestra
tiene tienen puede pueden debe deben ser hacer con por para este ese eso esto aqui ahora hoy ayer mientras
usted ustedes nosotros ellos ellas antes siempre nunca durante segun mismo misma otro otra otros otras ahora
entonces asi solo despues ya de a e la no nos""".split())

# Palavras que existem em mais de uma língua ficam de fora de todas as listas.
_COMUNS = (_PT & _EN) | (_PT & _ES) | (_EN & _ES)
PT, EN, ES = _PT - _COMUNS, _EN - _COMUNS, _ES - _COMUNS
_ACENTOS_DO_PT = re.compile(r"[ãõçàâêô]")  # letras que o inglês e o espanhol não usam
_MOEDA = re.compile(r"\b[a-z]{1,3}\$")  # "us$", "r$", "c$", "hk$": sigla colada no cifrão, não é palavra


def pontuar(texto: str) -> dict:
    """Parte (0 a 1) das palavras que são exclusivas de cada língua. Útil para os testes e para explicar a decisão."""
    base = _MOEDA.sub(" ", T.normalizar(texto).lower())
    tokens = re.findall(r"[^\W\d_]+", base)
    n = len(tokens)
    if n == 0:
        return {"palavras": 0, "pt": 0.0, "en": 0.0, "es": 0.0}
    dobradas = [T.dobrar(t) for t in tokens]
    pt = sum(1 for t in dobradas if t in PT) + sum(1 for t in tokens if _ACENTOS_DO_PT.search(t))
    en = sum(1 for t in dobradas if t in EN)
    es = sum(1 for t in dobradas if t in ES)
    return {"palavras": n, "pt": pt / n, "en": en / n, "es": es / n}


def esta_em_portugues(texto: str, minimo_de_palavras: int | None = None) -> bool | None:
    """True/False, ou None quando o texto é curto demais para julgar."""
    cfg = CONFIG["idioma"]
    p = pontuar(texto)
    if p["palavras"] < (minimo_de_palavras if minimo_de_palavras is not None else cfg["min_palavras_para_julgar"]):
        return None
    outro = max(p["en"], p["es"])
    if outro >= cfg["parte_minima_do_outro_idioma"] and outro > 2 * p["pt"]:
        return False
    if p["pt"] < cfg["parte_minima_do_portugues"] and outro >= cfg["parte_minima_do_outro_idioma"] / 2:
        return False
    return True


@checagem(ID, "Texto em português",
          "Entrega em inglês ou espanhol (ou com parágrafos inteiros em outra língua) chegava ao fundador sem aviso; só a citação original pode estar em outra língua.",
          ["CONF-21"])
def portugues(exe):
    if not exe.formato_ok:
        return None
    livres = [i for i in exe.itens if i.tipo in ("livre", "traducao")]
    if not livres:
        return None
    falhas = []
    cfg = CONFIG["idioma"]
    for i in livres:
        if esta_em_portugues(i.texto, cfg["min_palavras_por_trecho"]) is False:
            falhas.append(Falha(ID, "TEXTO_FORA_DO_PORTUGUES", i.caminho, "Este trecho não está em português. Escreva em português (só a citação original pode ficar em outra língua).", T.cortar(i.texto)))
    if not falhas:
        todo = " ".join(i.texto for i in livres)
        if esta_em_portugues(todo) is False:
            falhas.append(Falha(ID, "TEXTO_FORA_DO_PORTUGUES", "entrega", "O conjunto do texto não está em português.", T.cortar(todo)))
    return falhas
