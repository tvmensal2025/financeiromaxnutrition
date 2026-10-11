"""Quadro de cobertura: quantas checagens que a especificação cita o portão 1 já tem de verdade.

O que é: para cada tipo de entrega do primeiro card, cada CHK da especificação aparece como
  IMPLEMENTADA  existe no código, passa em pelo menos uma resposta boa da especificação e pega pelo menos um defeito dela;
  FUTURA        ainda não (e o motivo curto).
De onde vem: os ids e a gravidade vêm de helena-v2/deliverables/<tipo>.yaml e de servicos.yaml; "existe no código" vem de
validador.CHECAGENS; "passa" e "pega" vêm de rodar os casos de helena-v2/casos/ (a régua é a de prova.py).
Como usar:
    python -m spec_helena                     mostra o quadro (o mesmo texto que está no README entre <!-- COBERTURA --> e <!-- /COBERTURA -->)
    python -m spec_helena --detalhe           uma linha por checagem
    python -m spec_helena --atualizar-readme  reescreve o trecho do README (rode depois de implementar uma CHK)
Como mudar: a lista dos tipos do primeiro card é TIPOS_DO_PRIMEIRO_CARD; os motivos são as constantes MOTIVO_*.
"""
import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from . import prova

TIPOS_DO_PRIMEIRO_CARD = ("copy", "roteiro_treinamento", "calculo", "parecer", "relatorio_final", "dossie")

IMPLEMENTADA, FUTURA = "IMPLEMENTADA", "FUTURA"
MOTIVO_NAO_EXISTE = "checagem ainda não implementada"
MOTIVO_SEM_CASO_BOM = "no código, mas sem resposta boa da especificação que a exercite"
MOTIVO_SEM_CASO_RUIM = "no código, mas sem defeito da especificação que a prove"
MOTIVO_NAO_PEGA = "no código, mas não pega o defeito da especificação"

MARCA_ABRE, MARCA_FECHA = "<!-- COBERTURA -->", "<!-- /COBERTURA -->"
README = Path(__file__).resolve().parents[1] / "README.md"
NOME_DO_GRUPO_COMUM = "comuns (valem para todo tipo)"


@dataclass
class Linha:
    id: str
    estado: str
    motivo: str = ""


def _estado(spec, avaliacoes, id_) -> Linha:
    if not prova.registrada(id_):
        return Linha(id_, FUTURA, MOTIVO_NAO_EXISTE)
    if not any(a.caso.bom and prova.passou(a, id_) for a in avaliacoes):
        return Linha(id_, FUTURA, MOTIVO_SEM_CASO_BOM)
    ruins = [a for a in avaliacoes if not a.caso.bom and id_ in a.caso.deve_falhar_em]
    if not ruins:
        return Linha(id_, FUTURA, MOTIVO_SEM_CASO_RUIM)
    if not any(prova.pegou(spec, a, id_) for a in ruins):
        return Linha(id_, FUTURA, MOTIVO_NAO_PEGA)
    return Linha(id_, IMPLEMENTADA)


def montar_quadro(spec, avaliacoes, tipos=TIPOS_DO_PRIMEIRO_CARD) -> list:
    """[(nome do grupo, [Linha, ...])]: primeiro as comuns, depois cada tipo do primeiro card que já tem arquivo na especificação."""
    grupos = [(NOME_DO_GRUPO_COMUM, [c["id"] for c in spec.checagens_comuns])]
    for tipo in tipos:
        if spec.tipo(tipo) is not None:
            grupos.append((tipo, [c["id"] for c in spec.checagens_do_tipo(tipo)]))
    return [(nome, [_estado(spec, avaliacoes, i) for i in ids]) for nome, ids in grupos]


def totais(quadro) -> tuple:
    """(implementadas, citadas) somando todos os grupos."""
    linhas = [l for _, ls in quadro for l in ls]
    return sum(l.estado == IMPLEMENTADA for l in linhas), len(linhas)


_NUMERADO = re.compile(r"^(.*-)(\d+)$")


def abreviar(ids) -> str:
    """CHK-COPY-01, CHK-COPY-02, CHK-COPY-03 viram "CHK-COPY-01 a 03"; ids com nome ficam por extenso."""
    saida, i = [], 0
    while i < len(ids):
        m = _NUMERADO.match(ids[i])
        j = i
        while m and j + 1 < len(ids):
            n = _NUMERADO.match(ids[j + 1])
            if not (n and n.group(1) == m.group(1) and int(n.group(2)) == int(_NUMERADO.match(ids[j]).group(2)) + 1):
                break
            j += 1
        if j - i >= 2:
            saida.append(f"{ids[i]} a {_NUMERADO.match(ids[j]).group(2)}")
            i = j + 1
        else:
            saida.append(ids[i])
            i += 1
    return ", ".join(saida)


def _por_estado(linhas) -> list:
    """[(rótulo, [ids])] na ordem em que o estado aparece: IMPLEMENTADA, depois cada FUTURA com o seu motivo."""
    ordem, grupos = [], {}
    for l in linhas:
        rotulo = l.estado if l.estado == IMPLEMENTADA else f"{FUTURA} ({l.motivo})"
        if rotulo not in grupos:
            ordem.append(rotulo)
            grupos[rotulo] = []
        grupos[rotulo].append(l.id)
    return [(r, grupos[r]) for r in sorted(ordem, key=lambda r: (r != IMPLEMENTADA, r))]


def markdown(quadro, detalhe=False) -> str:
    x, y = totais(quadro)
    saida = [
        f"O portão 1 cobre {x} de {y} checagens citadas pelas entregas dos agentes do primeiro card; "
        f"as demais estão marcadas FUTURA; a rubrica (RUB-...) é do revisor, não do código.",
        "",
    ]
    if detalhe:
        saida += ["| Checagem | Estado | Motivo |", "|---|---|---|"]
        for nome, linhas in quadro:
            saida.append(f"| **{nome}** | | |")
            saida += [f"| {l.id} | {l.estado} | {l.motivo} |" for l in linhas]
        return "\n".join(saida)
    saida += ["| Tipo | Cobertas | Estado |", "|---|---|---|"]
    for nome, linhas in quadro:
        ok = sum(l.estado == IMPLEMENTADA for l in linhas)
        estado = "; ".join(f"{r}: {abreviar(ids)}" for r, ids in _por_estado(linhas))
        saida.append(f"| {nome} | {ok} de {len(linhas)} | {estado} |")
    return "\n".join(saida)


def quadro_atual() -> list:
    return montar_quadro(prova.spec_padrao(), prova.avaliacoes_da_spec())


def trecho_do_readme(texto: str):
    """O que está entre os marcadores do README (sem as bordas), ou None se os marcadores não existem."""
    a, b = texto.find(MARCA_ABRE), texto.find(MARCA_FECHA)
    if a < 0 or b < a:
        return None
    return texto[a + len(MARCA_ABRE):b].strip()


def atualizar_readme(caminho=README) -> bool:
    """Reescreve o trecho do README com o quadro de agora. Devolve True se mudou alguma coisa."""
    texto = Path(caminho).read_text(encoding="utf-8")
    a, b = texto.find(MARCA_ABRE), texto.find(MARCA_FECHA)
    if a < 0 or b < a:
        raise SystemExit(f"Não achei {MARCA_ABRE} e {MARCA_FECHA} em {caminho}.")
    novo = texto[:a + len(MARCA_ABRE)] + "\n" + markdown(quadro_atual()) + "\n" + texto[b:]
    if novo == texto:
        return False
    Path(caminho).write_text(novo, encoding="utf-8")
    return True


def principal(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m spec_helena", description="Quadro de cobertura das checagens da especificação.")
    ap.add_argument("--detalhe", action="store_true", help="uma linha por checagem")
    ap.add_argument("--atualizar-readme", action="store_true", help="reescreve o trecho do README entre os marcadores")
    args = ap.parse_args(argv)
    if args.atualizar_readme:
        print("README atualizado." if atualizar_readme() else "README já estava em dia.")
        return 0
    print(markdown(quadro_atual(), detalhe=args.detalhe))
    return 0


if __name__ == "__main__":
    sys.exit(principal())
