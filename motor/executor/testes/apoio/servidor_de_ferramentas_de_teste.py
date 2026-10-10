"""Servidor de ferramentas de TESTE: o servidor de verdade, com uma busca que SEMPRE responde bem.

O servidor de produção só liga a busca "desligada" (que recusa) e a internet não existe nos testes.
Sem isso, toda chamada de ferramenta daria erro, e o Hermes real corta o laço sozinho depois de 3
erros seguidos (um disjuntor dele). Para provar o limite de chamadas é preciso um laço de chamadas
que DÃO CERTO: este arquivo faz isso reaproveitando o servidor, o contador e o protocolo de verdade.

Uso (igual ao de produção):  python servidor_de_ferramentas_de_teste.py --execucao ... --diretorio ...
"""

import sys

from ferramentas_helena.__main__ import CODIGO_DE_SAIDA_CONFIGURACAO, _montar_parser, montar_parametros
from ferramentas_helena.busca import AdaptadorBusca, ResultadoBusca
from ferramentas_helena.erros import ErroDeConfiguracao
from ferramentas_helena.servidor import Servidor, executar_stdio


class BuscaQueSempreResponde(AdaptadorBusca):
    nome = "sempre_responde"

    def buscar(self, consulta, limite):
        return [ResultadoBusca(titulo="Resultado de teste", url="https://exemplo.org/pagina", trecho="trecho de teste")]


def principal(argv=None) -> int:
    argumentos = _montar_parser().parse_args(argv)
    try:
        servidor = Servidor(montar_parametros(argumentos), adaptador=BuscaQueSempreResponde())
    except (ErroDeConfiguracao, OSError) as erro:
        print(f"servidor de teste: configuração inválida: {erro}", file=sys.stderr)
        return CODIGO_DE_SAIDA_CONFIGURACAO
    return executar_stdio(servidor)


if __name__ == "__main__":
    sys.exit(principal())
