"""CHK do dossiê que a especificação cita e o código ainda NÃO tem (a fila de quem implementa).

O que é: a lista do dossiê. Ao implementar uma CHK, apague o id dela daqui (o teste falha se ficar id velho aqui, e falha se um caso
apontar para uma CHK que não existe no código nem está numa destas listas).
De onde vem: helena-v2/deliverables/dossie.yaml (checagens_codigo). Como mudar: só apagar a linha quando a CHK passar a existir;
se uma CHK nova não puder ser feita, acrescente o id com o motivo em comentário na mesma linha.

Hoje a lista está vazia: as oito CHK-DOSSIE-* estão em validador/checagens/spec_dossie_estrutura.py e spec_dossie_texto.py.
A CHK-DOSSIE-AUSENCIA (fase 2) pôde ser feita porque o adaptador entrega a cópia guardada das páginas lidas (paginas_lidas,
todas as partes). Limite conhecido, que não é uma CHK adiada: num roteiro, o "pedido da etapa" da CHK-DOSSIE-ENTIDADE é só o
pedido original do card; a instrução da etapa ainda não chega no contexto (ver o relato do agente do dossiê).
"""

IDS = frozenset()
