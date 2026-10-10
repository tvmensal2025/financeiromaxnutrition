"""Banco de casos: DEFEITOS (cada um com a checagem que DEVE pegar) e HONESTAS (têm de passar)."""
from .defeitos_citacao import DEFEITOS as _CITACAO
from .defeitos_fonte_calculo import DEFEITOS as _FONTE_CALCULO
from .defeitos_formato import DEFEITOS as _FORMATO
from .defeitos_leis_temas_ganho import DEFEITOS as _LEIS_TEMAS_GANHO
from .honestas import HONESTAS

DEFEITOS = [*_FORMATO, *_CITACAO, *_FONTE_CALCULO, *_LEIS_TEMAS_GANHO]

__all__ = ["DEFEITOS", "HONESTAS"]
