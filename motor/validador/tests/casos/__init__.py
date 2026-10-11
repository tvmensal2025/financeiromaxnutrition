"""Banco de casos: DEFEITOS (cada um com a checagem que DEVE pegar) e HONESTAS (têm de passar).

Os arquivos defeitos_*.py e honestas.py são os das checagens antigas (feitas à mão). Os arquivos spec_<tipo>.py (um por tipo da
especificação v3.1: spec_dossie.py, ...) são achados SOZINHOS aqui: cada um define DEFEITOS e HONESTAS e entra no banco; não há lista
para atualizar.
"""
import importlib
import pkgutil

from .defeitos_citacao import DEFEITOS as _CITACAO
from .defeitos_fonte_calculo import DEFEITOS as _FONTE_CALCULO
from .defeitos_formato import DEFEITOS as _FORMATO
from .defeitos_leis_temas_ganho import DEFEITOS as _LEIS_TEMAS_GANHO
from .honestas import HONESTAS as _HONESTAS

_POR_TIPO = [importlib.import_module(f"{__name__}.{m.name}") for m in pkgutil.iter_modules(__path__) if m.name.startswith("spec_")]

DEFEITOS = [*_FORMATO, *_CITACAO, *_FONTE_CALCULO, *_LEIS_TEMAS_GANHO, *(d for m in _POR_TIPO for d in m.DEFEITOS)]
HONESTAS = [*_HONESTAS, *(h for m in _POR_TIPO for h in m.HONESTAS)]

__all__ = ["DEFEITOS", "HONESTAS"]
