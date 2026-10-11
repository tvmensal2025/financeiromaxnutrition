"""CHK de o dossiê que a especificação cita e o código ainda NÃO tem (a fila de quem implementa).

O que é: a lista o dossiê. Ao implementar uma CHK, apague o id dela daqui (o teste falha se ficar id velho aqui, e falha se um caso
apontar para uma CHK que não existe no código nem está numa destas listas).
De onde vem: helena-v2/deliverables/dossie.yaml (checagens_codigo). Como mudar: só apagar a linha quando a CHK passar a existir.
"""

IDS = frozenset([
    "CHK-DOSSIE-FORMA", "CHK-DOSSIE-ENTIDADE", "CHK-DOSSIE-FATOS",
    "CHK-DOSSIE-SEPARACAO", "CHK-DOSSIE-LACUNAS", "CHK-DOSSIE-AUSENCIA",
    "CHK-DOSSIE-SEM-PROMESSA-DE-RENDA", "CHK-DOSSIE-SEM-ACAO-EXTERNA",
])
