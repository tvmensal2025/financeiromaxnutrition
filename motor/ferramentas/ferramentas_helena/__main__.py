"""Partida do servidor: python -m ferramentas_helena [opções]. Veja o README.md.

Exemplo (Clara, com as duas ferramentas):
  python -m ferramentas_helena --execucao E-123-n4 --diretorio /tmp/exec/E-123-n4 \
      --ferramentas ler_pagina --max-partes 30 --max-total 45 \
      --lista-de-enderecos fontes.txt

Servidor vazio (serviço que não usa internet):
  python -m ferramentas_helena --execucao E-9-n1 --diretorio /tmp/exec/E-9-n1 \
      --servidor-vazio --max-total 3
"""

import argparse
import sys
from pathlib import Path

from .busca import ADAPTADORES
from .erros import ErroDeConfiguracao
from .parametros import FERRAMENTAS_CONHECIDAS, TAMANHO_MAXIMO_DA_PARTE, Parametros
from .servidor import Servidor, executar_stdio

CODIGO_DE_SAIDA_CONFIGURACAO = 2


def _montar_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ferramentas_helena", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--execucao", required=True, help="identificador da execução")
    p.add_argument("--diretorio", required=True, type=Path, help="pasta da execução (registro, estado, cópias)")
    lista = p.add_mutually_exclusive_group(required=True)
    lista.add_argument("--ferramentas", help=f"lista por extenso, separada por vírgula: {','.join(FERRAMENTAS_CONHECIDAS)}")
    lista.add_argument("--servidor-vazio", action="store_true", help="sem nenhuma ferramenta")
    p.add_argument("--max-total", required=True, type=int, help="chamadas_total da ficha")
    p.add_argument("--max-buscas", type=int, default=0, help="buscas da ficha")
    p.add_argument("--max-partes", type=int, default=0, help="partes_de_pagina da ficha")
    fontes = p.add_mutually_exclusive_group()
    fontes.add_argument("--lista-de-enderecos", type=Path,
                        help="arquivo com um endereço permitido por linha (linhas com # são ignoradas)")
    fontes.add_argument("--qualquer-endereco-publico", action="store_true",
                        help="sem lista: qualquer endereço público (só quando o pedido não exige lista)")
    p.add_argument("--busca", choices=sorted(ADAPTADORES), default="desligada", help="adaptador de busca")
    p.add_argument("--tempo-leitura-s", type=float, default=20.0)
    p.add_argument("--tamanho-parte", type=int, default=TAMANHO_MAXIMO_DA_PARTE)
    return p


def _ler_lista(caminho: Path):
    linhas = caminho.read_text(encoding="utf-8").splitlines()
    return tuple(l.strip() for l in linhas if l.strip() and not l.strip().startswith("#"))


def montar_parametros(argumentos) -> Parametros:
    if argumentos.servidor_vazio:
        ferramentas = ()
    else:
        ferramentas = tuple(n.strip() for n in argumentos.ferramentas.split(",") if n.strip())
        if not ferramentas:
            raise ErroDeConfiguracao("--ferramentas vazio: para nenhuma ferramenta use --servidor-vazio.")
    if argumentos.lista_de_enderecos is not None:
        lista = _ler_lista(argumentos.lista_de_enderecos)
    elif argumentos.qualquer_endereco_publico:
        lista = None
    elif ferramentas:
        raise ErroDeConfiguracao("com ferramentas, diga a lista: --lista-de-enderecos ARQUIVO "
                                 "ou --qualquer-endereco-publico.")
    else:
        lista = ()  # servidor vazio: não há o que liberar
    return Parametros(
        execucao=argumentos.execucao, diretorio=argumentos.diretorio, ferramentas=ferramentas,
        max_total=argumentos.max_total, max_buscas=argumentos.max_buscas, max_partes=argumentos.max_partes,
        lista_de_enderecos=lista, tamanho_parte=argumentos.tamanho_parte,
        tempo_leitura_s=argumentos.tempo_leitura_s,
    )


def principal(argv=None) -> int:
    argumentos = _montar_parser().parse_args(argv)
    try:
        parametros = montar_parametros(argumentos)
        servidor = Servidor(parametros, adaptador=ADAPTADORES[argumentos.busca]())
    except (ErroDeConfiguracao, OSError) as erro:
        print(f"ferramentas_helena: configuração inválida: {erro}", file=sys.stderr)
        return CODIGO_DE_SAIDA_CONFIGURACAO
    return executar_stdio(servidor)


if __name__ == "__main__":
    sys.exit(principal())
