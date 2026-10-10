"""Linha de comando do validador.

    python -m validador validar --resposta r.json --contexto c.json [--saida v.json] [--texto]
    python -m validador checagens        # lista as checagens, o furo que cada uma fecha e a gravidade
    python -m validador leis             # situação da tabela de leis (quais ainda não foram conferidas)

Códigos de saída: 0 = aprovada (pode ter marcas); 1 = recusada; 2 = erro de uso ou de arquivo.
"""
import argparse
import json
import sys
from pathlib import Path

from .contexto import ErroDeContexto
from .nucleo import validar
from .registro import CHECAGENS, carregar_json


def _ler_texto(caminho: str) -> str:
    return Path(caminho).read_text(encoding="utf-8")


def _texto_do_relatorio(rel) -> str:
    linhas = [f"Veredito: {rel.veredito}  ({len(rel.recusas)} recusa(s), {len(rel.marcas)} marca(s), {rel.para_dict()['tempo_ms']} ms)"]
    for titulo, lista in (("RECUSAS (voltam ao autor)", rel.recusas), ("MARCAS (seguem com aviso)", rel.marcas)):
        if lista:
            linhas.append(f"\n{titulo}:")
            for f in lista:
                linhas.append(f"  [{f.id}] {f.motivo}\n      onde: {f.item}\n      o que fazer: {f.mensagem}" + (f"\n      trecho: {f.trecho}" if f.trecho else ""))
    if rel.premissas:
        linhas.append("\nPremissas (o código não confere; o fundador confirma):")
        for p in rel.premissas:
            linhas.append(f"  - {p['id']} = {p['valor']} {p['unidade']}")
    return "\n".join(linhas)


def principal(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="validador", description="Portão 1 das entregas do Sistema Helena.")
    sub = ap.add_subparsers(dest="comando", required=True)
    v = sub.add_parser("validar", help="valida uma resposta de agente")
    v.add_argument("--resposta", required=True, help="arquivo com a resposta do agente (JSON da ação)")
    v.add_argument("--contexto", required=True, help="arquivo JSON com o contexto da execução (modelo, páginas lidas, decisões)")
    v.add_argument("--saida", help="grava o relatório JSON neste arquivo")
    v.add_argument("--texto", action="store_true", help="mostra o relatório em texto simples em vez de JSON")
    sub.add_parser("checagens", help="lista as checagens")
    sub.add_parser("leis", help="mostra a situação da tabela de leis")
    args = ap.parse_args(argv)

    if args.comando == "checagens":
        for c in (CHECAGENS[i] for i in sorted(CHECAGENS)):
            print(f"{c.id}  [{c.gravidade}]  {c.nome}\n    fecha: {', '.join(c.fecha_furos)}\n    porque: {c.o_que_fecha}")
        return 0
    if args.comando == "leis":
        for lei in carregar_json("leis.json")["leis"]:
            print(f"{lei['id']:24} {lei['status']:14} texto oficial: {'preenchido' if lei['texto_oficial_a_conferir'].strip() else 'VAZIO'}   {lei['nome']}")
        return 0
    try:
        resposta = _ler_texto(args.resposta)
        contexto = json.loads(_ler_texto(args.contexto))
        relatorio = validar(resposta, contexto)
    except (OSError, json.JSONDecodeError, ErroDeContexto) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 2
    saida = json.dumps(relatorio.para_dict(), ensure_ascii=False, indent=2)
    if args.saida:
        Path(args.saida).write_text(saida + "\n", encoding="utf-8")
    print(_texto_do_relatorio(relatorio) if args.texto else saida)
    return 0 if relatorio.aprovada else 1
