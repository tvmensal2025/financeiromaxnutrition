"""CHK de o relatório final que a especificação cita e o código ainda NÃO tem (a fila de quem implementa).

O que é: a lista o relatório final. Ao implementar uma CHK, apague o id dela daqui (o teste falha se ficar id velho aqui, e falha se um caso
apontar para uma CHK que não existe no código nem está numa destas listas).
De onde vem: helena-v2/deliverables/relatorio_final.yaml (checagens_codigo). Como mudar: só apagar a linha quando a CHK passar a existir.
"""

IDS = frozenset([
    "CHK-REL-SO-SECOES", "CHK-REL-TAMANHO-DAS-LINHAS", "CHK-REL-ORDEM",
    "CHK-REL-SEM-CODIGO", "CHK-REL-SEM-OTIMISMO", "CHK-REL-PACOTE",
    "CHK-REL-REFS", "CHK-REL-NUMEROS", "CHK-REL-RISCO-ALTO-NO-RESUMO",
    "CHK-REL-SEM-ACAO-NOVA",
])
