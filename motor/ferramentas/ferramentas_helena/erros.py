"""Erros do servidor de ferramentas.

Dois tipos, de propósito:
- ErroFerramenta: falha esperada de uma chamada. O agente recebe o código e a mensagem
  (em português). O detalhe técnico vai só para o registro, nunca para o agente.
- ErroDeConfiguracao: parâmetros errados na partida. O servidor não liga.
"""


class ErroFerramenta(Exception):
    """Falha esperada de uma ferramenta (endereço recusado, tempo esgotado, limite...)."""

    def __init__(self, codigo: str, mensagem: str, detalhe: str = ""):
        super().__init__(f"{codigo}: {mensagem}")
        self.codigo = codigo
        self.mensagem = mensagem
        self.detalhe = detalhe


class ErroDeConfiguracao(ValueError):
    """Parâmetros inválidos na partida do servidor."""


class CopiaAdulterada(Exception):
    """A cópia guardada de uma página não bate mais com o hash gravado."""
