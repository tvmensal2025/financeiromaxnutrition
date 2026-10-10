"""Banco de casos: defeitos plantados e respostas honestas.

Cada caso parte de uma resposta honesta de tests/fabrica.py e muda UM detalhe (os "remendos").
Remendo = (caminho, valor). Caminho começa com:
    r.   a resposta do agente        (ex.: "r.entrega.resumo_executivo")
    c.   o contexto da execução      (ex.: "c.paginas_lidas[0].partes.1")
  "[n]" escolhe o item n de uma lista; "caminho+" ACRESCENTA o valor numa lista.
  "r" sozinho troca a resposta inteira. "r~prefixo", "r~sufixo", "r~duplicar", "r~lista" mexem no texto final enviado.
Valores especiais:  DEL (apaga a chave)   Sub("velho", "novo") (troca um pedaço do texto que já existe).
"""
import copy
import json
import re
from dataclasses import dataclass, field

from . import fabrica


class _Apagar:
    def __repr__(self):
        return "DEL"


DEL = _Apagar()


@dataclass(frozen=True)
class Sub:
    velho: str
    novo: str


@dataclass
class Defeito:
    id: str
    base: str
    descricao: str
    esperado: tuple  # (id da checagem, motivo ou None, gravidade ou None)
    remendos: list = field(default_factory=list)


@dataclass
class Honesta:
    id: str
    base: str
    descricao: str
    remendos: list = field(default_factory=list)
    marcas: tuple = ()  # IDs que PODEM aparecer como marca (e só eles); vazio = tem de passar limpa


_PASSO = re.compile(r"([^.\[\]]+)|\[(\d+)\]")


def _passos(caminho: str):
    return [(m.group(1), None) if m.group(1) else (None, int(m.group(2))) for m in _PASSO.finditer(caminho)]


def _aplicar_um(raiz, caminho, valor):
    acrescentar = caminho.endswith("+")
    passos = _passos(caminho[:-1] if acrescentar else caminho)
    alvo = raiz
    for chave, indice in passos[:-1]:
        alvo = alvo[chave] if chave is not None else alvo[indice]
    chave, indice = passos[-1]
    k = chave if chave is not None else indice
    if acrescentar:
        alvo[k].append(copy.deepcopy(valor))
    elif valor is DEL:
        del alvo[k]
    elif isinstance(valor, Sub):
        assert valor.velho in alvo[k], f"remendo: {valor.velho!r} não está em {caminho}"
        alvo[k] = alvo[k].replace(valor.velho, valor.novo)
    else:
        alvo[k] = copy.deepcopy(valor)


def montar(base: str, remendos):
    """Devolve (resposta, contexto) já remendados. `resposta` pode virar texto se o remendo trocar r por texto."""
    resposta, contexto = fabrica.BASES[base]()
    caixa = {"r": resposta, "c": contexto}
    for caminho, valor in remendos:
        if caminho == "r":  # troca a resposta inteira
            caixa["r"] = copy.deepcopy(valor)
            continue
        if caminho.startswith("r~"):
            continue  # operações sobre o texto final, aplicadas no fim
        raiz, _, resto = caminho.partition(".")
        _aplicar_um(caixa[raiz], resto, valor)
    r = caixa["r"]
    if not isinstance(r, str):
        r = json.dumps(r, ensure_ascii=False, default=str)
    for op, valor in (rem for rem in remendos if rem[0].startswith("r~")):
        if op == "r~prefixo":
            r = valor + r
        elif op == "r~sufixo":
            r = r + valor
        elif op == "r~duplicar":
            r = r + "\n" + r
        elif op == "r~lista":
            r = "[" + ", ".join([r] * valor) + "]"
    return r, caixa["c"]
