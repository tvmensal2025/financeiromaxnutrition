"""CHK de o parecer que a especificação cita e o código ainda NÃO tem (a fila de quem implementa).

O que é: a lista o parecer. Ao implementar uma CHK, apague o id dela daqui (o teste falha se ficar id velho aqui, e falha se um caso
apontar para uma CHK que não existe no código nem está numa destas listas).
De onde vem: helena-v2/deliverables/parecer.yaml (checagens_codigo). Como mudar: só apagar a linha quando a CHK passar a existir.
"""

IDS = frozenset([
    "CHK-PARECER-SO-SECOES", "CHK-PARECER-TAMANHO", "CHK-PARECER-PECAS",
    "CHK-PARECER-SEMAFORO", "CHK-PARECER-AJUSTE", "CHK-PARECER-TRECHO-DA-PECA",
    "CHK-PARECER-PASSOS-FIXOS", "CHK-PARECER-TEMAS", "CHK-PARECER-FUNDAMENTOS",
    "CHK-PARECER-CONDICOES", "CHK-PARECER-ADVOGADO", "CHK-PARECER-SEM-GARANTIA",
    "CHK-PARECER-TERMO-DO-PACOTE", "CHK-PARECER-LEI-NA-TABELA", "CHK-PARECER-LEI-NAO-CONFERIDA",
    "CHK-PARECER-NOTA-DE-JURISPRUDENCIA", "CHK-PARECER-TERMOS-INTEIROS", "CHK-PARECER-AUSENCIA",
])
