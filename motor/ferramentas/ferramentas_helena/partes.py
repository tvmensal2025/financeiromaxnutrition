"""Divisão do texto em partes de até N caracteres (padrão: 20 mil).

Regras:
- juntando as partes na ordem, volta exatamente o texto original;
- nenhuma parte passa de N caracteres e nenhuma vem vazia;
- o corte prefere o fim de um parágrafo, depois de uma linha, depois de uma frase,
  depois de um espaço; só corta no meio de uma palavra se não houver nada melhor.
  Assim uma cláusula curta nunca fica partida entre duas partes.
"""

from typing import List

_SEPARADORES = ("\n\n", "\n", ". ", "? ", "! ", "; ", " ")


def _ponto_de_corte(texto: str, inicio: int, limite: int) -> int:
    """Devolve o fim (exclusivo) da próxima parte, entre inicio+1 e limite."""
    if limite >= len(texto):
        return len(texto)
    piso = inicio + max(1, (limite - inicio) // 2)  # não aceita corte antes da metade
    for separador in _SEPARADORES:
        posicao = texto.rfind(separador, piso, limite)
        if posicao != -1:
            return posicao + len(separador)
    return limite


def dividir(texto: str, tamanho: int) -> List[str]:
    if tamanho < 1:
        raise ValueError("tamanho precisa ser positivo")
    partes = []
    inicio = 0
    while inicio < len(texto):
        fim = _ponto_de_corte(texto, inicio, inicio + tamanho)
        partes.append(texto[inicio:fim])
        inicio = fim
    return partes
