"""Banco de casos: DEFEITOS (cada um com a checagem que DEVE pegar) e HONESTAS (têm de passar)."""
from .defeitos_citacao import DEFEITOS as _CITACAO
from .defeitos_fonte_calculo import DEFEITOS as _FONTE_CALCULO
from .defeitos_formato import DEFEITOS as _FORMATO
from .defeitos_leis_temas_ganho import DEFEITOS as _LEIS_TEMAS_GANHO
from .honestas import HONESTAS as _HONESTAS_ANTIGAS
from .spec_calculo import DEFEITOS as _CALCULO_SPEC, HONESTAS as _HONESTAS_CALCULO_SPEC

DEFEITOS = [*_FORMATO, *_CITACAO, *_FONTE_CALCULO, *_LEIS_TEMAS_GANHO, *_CALCULO_SPEC]
HONESTAS = [*_HONESTAS_ANTIGAS, *_HONESTAS_CALCULO_SPEC]

__all__ = ["DEFEITOS", "HONESTAS"]
