"""CHK do cálculo (Caio) que a especificação cita e o código ainda NÃO tem (a fila de quem implementa).

O que é: a lista do cálculo. Está VAZIA: as 12 checagens (CHK-CALCULO-01 a 12) existem em
validador/checagens/spec_calculo_*.py. Ao descobrir uma CHK nova no YAML, acrescente o id aqui até implementá-la
(o teste falha se ficar id velho aqui, e falha se um caso apontar para uma CHK que não existe no código nem está numa destas listas).
De onde vem: helena-v2/deliverables/calculo.yaml (checagens_codigo). Como mudar: só apagar a linha quando a CHK passar a existir.

Partes de checagens que o código NÃO consegue conferir sozinho (a checagem existe e confere o resto):
  - CHK-CALCULO-02: o VALOR das decisões vigentes. O contexto só traz o id da decisão (o motor lê o valor na hora); por isso o
    DADO_DO_FUNDADOR é conferido pelo trecho literal da fonte (pedido ou pacote), que é o que a especificação manda.
  - CHK-CALCULO-03: "na_faixa" (mostrar a data do câmbio na faixa do card) é do app, não do validador.
  - CHK-CALCULO-11: "pacote sem lista de termos" na faixa também é do app; sem lista a checagem passa, como a especificação manda.
"""

IDS = frozenset()
