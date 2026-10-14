"""CHK de o parecer que a especificação cita e o código ainda NÃO tem (a fila de quem implementa).

O que é: a lista o parecer. Ao implementar uma CHK, apague o id dela daqui (o teste falha se ficar id velho aqui, e falha se um caso
apontar para uma CHK que não existe no código nem está numa destas listas).
De onde vem: helena-v2/deliverables/parecer.yaml (checagens_codigo). Como mudar: só apagar a linha quando a CHK passar a existir.

Estado: as 18 CHK-PARECER-* foram implementadas em validador/checagens/spec_parecer_*.py; nenhuma ficou adiada.
Se uma checagem do parecer voltar a ficar sem código, ponha o id de volta aqui com o motivo escrito na linha, assim:
    "CHK-PARECER-XXX",  # motivo: falta o dado X, que só o motor real entrega
"""

# Aproximações conhecidas (a checagem existe e pega o defeito da especificação, mas não vê tudo o que o YAML sugere):
#   CHK-PARECER-PECAS            com mais de uma versão da mesma peça no pacote, só acha número de versão trocado quando o trecho da linha
#                                existe só em OUTRA versão (o motor real deve entregar só a versão aprovada; ver pedidos ao agente principal).
#   CHK-PARECER-AUSENCIA         frase de ausência exige que exista alguma linha em ausencias; ligar a frase à linha certa é do revisor (RUB-PARECER-02).
#   CHK-PARECER-LEI-NA-TABELA    lê a tabela de contexto["pedido"]["pacote_do_parecer"]["tabela_de_leis"] (linhas com referencia, texto/texto_oficial);
#                                o desenho final da tabela publicada (FON-LEIS-v<n>) ainda não existe.
#   CHK-PARECER-TERMO-DO-PACOTE  pacote sem lista passa em silêncio; o aviso 'pacote sem lista de termos' da faixa é montado fora do validador.
IDS = frozenset([
])
