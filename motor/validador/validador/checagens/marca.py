"""Marcas e grafias do texto:

CHK-COMUM-08  confiança declarada pela IA vira "autoavaliação da IA" (nunca entra na faixa do código).
CHK-COMUM-09  grafia oficial da marca: eLiving™ (DEC-023).
"""
import re

from .. import texto as T
from ..registro import checagem
from ..resultado import Falha

ID8, ID9 = "CHK-COMUM-08", "CHK-COMUM-09"

_CONFIANCA = [
    re.compile(r"\b(?:tenho|com|de)\s+(?:\d{1,3}\s?%|alta|total|plena|muita|absoluta)\s+(?:de\s+)?(?:certeza|confianca|seguranca)"),
    re.compile(r"\bconfianca\s*(?:alta|media|baixa|total|de\s*\d{1,3}\s?%|:\s*\d)"),
    re.compile(r"\b\d{1,3}\s?%\s+(?:de\s+)?(?:certeza|confianca|confiante|seguro|certo)"),
    re.compile(r"\bestou\s+(?:\d{1,3}\s?%\s+|muito\s+|bastante\s+|totalmente\s+)?(?:confiante|seguro|segura|certo|certa)"),
    re.compile(r"\btenho\s+certeza\b"),
]


@checagem(ID8, "Confiança da IA marcada como autoavaliação",
          "'Estou 95% seguro' dito pela IA parecia dado conferido e inflava a confiança do fundador no card.",
          ["C-13"], gravidade="MARCA")
def autoavaliacao_marcada(exe):
    if not exe.formato_ok:
        return None
    falhas = []
    if exe.acao == "ENTREGAR" and exe.acao_obj.get("autoavaliacao"):
        falhas.append(Falha(ID8, "AUTOAVALIACAO_DA_IA", "resposta.autoavaliacao",
                            "Confiança dita pela própria IA: chega marcada como 'autoavaliação da IA' e nunca entra na faixa do código.",
                            T.cortar(exe.acao_obj["autoavaliacao"])))
    for i in exe.itens:
        if i.tipo != "livre" or i.caminho == "autoavaliacao":
            continue
        f = T.dobrar(i.texto)
        if any(rx.search(f) for rx in _CONFIANCA):
            falhas.append(Falha(ID8, "AUTOAVALIACAO_NO_TEXTO", i.caminho,
                                "O texto traz confiança dita pela própria IA: chega marcada como 'autoavaliação da IA'.", T.cortar(i.texto)))
    return falhas


_MARCA = re.compile(r"(?<![A-Za-z0-9@/._-])([EeIi][-‐-―]?\s?[Ll][Ii][Vv][Ii][Nn][Gg])(?![A-Za-z0-9])(?!\.[a-zA-Z])")


@checagem(ID9, "Grafia oficial da marca: eLiving™",
          "A marca aparecia como 'E-living', 'Eliving' ou 'Iliving' em textos que vão a pessoas de fora (DEC-023).",
          ["DEC-023"])
def grafia_da_marca(exe):
    if not exe.formato_ok:
        return None
    falhas = []
    for i in exe.itens:
        if i.tipo == "original":
            continue
        for m in _MARCA.finditer(i.texto):
            achado = m.group(1)
            if re.search(r"\s", achado) and not (achado[0] in "EI" and achado.endswith("Living")):
                continue  # "e living" em minúsculas é o 'e' do português seguido de outra palavra
            if achado != "eLiving":
                falhas.append(Falha(ID9, "GRAFIA_DA_MARCA", i.caminho,
                                    f"A marca se escreve eLiving™ (e minúsculo, L maiúsculo, sem hífen). Veio '{achado}'.", achado))
    return falhas
