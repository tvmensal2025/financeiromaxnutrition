"""CHK da mudança de código (SRV-ENGENHARIA, Theo) que a especificação cita e o código ainda NÃO tem (a fila de quem implementa).

O que é: a lista do tipo mudanca_de_codigo. O serviço está em RASCUNHO (decisão do fundador de 17/10/2026, "Constrói, você aprova"):
só a especificação e os casos existem; nenhuma destas checagens está no código. Ao implementar uma CHK, apague o id dela daqui (o
teste falha se ficar id velho aqui, e falha se um caso apontar para uma CHK que não existe no código nem está numa destas listas).
De onde vem: helena-v2/deliverables/mudanca_de_codigo.yaml (checagens_codigo). Como mudar: só apagar a linha quando a CHK passar a existir.

Antes de implementar: o diff é lido hoje como texto livre pelas checagens comuns (CHK-COMUM-03 idioma, 04 sem HTML, 05 sem "agi fora"),
e código com marcação de página, mensagem de tela como "enviado com sucesso" ou linhas longas em inglês seria recusado. Falta um
tipo de campo "codigo" com tratamento próprio (ver docs/manual/programador/00-theo-engenheiro.md, "O que falta para ativar").
"""

IDS = frozenset([
    "CHK-ENGENHARIA-DIFF", "CHK-ENGENHARIA-BASE", "CHK-ENGENHARIA-ZONA", "CHK-ENGENHARIA-MIGRATION",
    "CHK-ENGENHARIA-SEGREDO", "CHK-ENGENHARIA-TESTE", "CHK-ENGENHARIA-MINIMA", "CHK-ENGENHARIA-SEM-EXECUCAO",
    "CHK-ENGENHARIA-PR", "CHK-ENGENHARIA-PACOTE",
])
