"""CHK de o roteiro de treinamento que a especificação cita e o código ainda NÃO tem (a fila de quem implementa).

O que é: a lista o roteiro de treinamento. Ao implementar uma CHK, apague o id dela daqui (o teste falha se ficar id velho aqui, e falha se um caso
apontar para uma CHK que não existe no código nem está numa destas listas).
De onde vem: helena-v2/deliverables/roteiro_treinamento.yaml (checagens_codigo). Como mudar: só apagar a linha quando a CHK passar a existir.

Situação hoje: as dez (CHK-TREINO-01 a 10) estão no código, em validador/checagens/spec_treino_*.py; por isso a lista está vazia.
Atenção a CHK-TREINO-10 (só vale no card da eLiving, BIZ-004): ela existe e tem testes próprios (tests/test_spec_treino.py), mas ainda
NÃO tem caso da especificação que a prove, porque todos os pedidos de teste deste serviço são da Humano Digital (BIZ-003). O quadro de
cobertura a mostra como FUTURA "sem resposta boa da especificação que a exercite" até alguém acrescentar em helena-v2/casos/SRV-ROTEIRO-TREINAMENTO
uma variante BIZ-004 no pedido.yaml, uma resposta boa e um defeito com deve_falhar_em: CHK-TREINO-10.
Também falta mostrar na faixa do card o aviso "pacote sem lista de termos" (CHK-TREINO-02 passa nesse caso, como a especificação manda;
o aviso fica guardado em exe.memoria["avisos_da_faixa"], mas o validador ainda não tem por onde mostrá-lo; ver spec_treino_termos.py).
"""

IDS = frozenset()
