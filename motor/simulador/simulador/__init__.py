"""Simulador da esteira do Sistema Helena: IA de mentira + gerador de eventos + checador de invariantes.

Uso mais comum:

    from simulador import Referencia, rodar, campanha
    resultado = rodar(Referencia(), semente=7)
    print(resultado.resumo(), resultado.violacoes)
"""
from .alvo import Alvo
from .execucao import Campanha, Execucao, campanha, jogar, rodar
from .invariantes import INVARIANTES, Verificador, Violacao
from .mundo import Cenario, Mundo
from .referencia import Referencia

__all__ = ["Alvo", "Campanha", "Cenario", "Execucao", "INVARIANTES", "Mundo", "Referencia", "Verificador",
           "Violacao", "campanha", "jogar", "rodar"]
