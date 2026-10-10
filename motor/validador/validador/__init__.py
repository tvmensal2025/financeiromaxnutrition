"""Validador de entregas do Sistema Helena (portão 1: código puro, sem IA). Ver README.md."""
from .contexto import ErroDeContexto
from .nucleo import validar
from .registro import CHECAGENS
from .resultado import VERSAO, Falha, Relatorio

__all__ = ["validar", "ErroDeContexto", "CHECAGENS", "Falha", "Relatorio", "VERSAO"]
