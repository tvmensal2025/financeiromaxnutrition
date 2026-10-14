"""A FORMA do relatório da Helena: CHK-REL-SO-SECOES, CHK-REL-TAMANHO-DAS-LINHAS e CHK-REL-ORDEM.

O que é: três conferências de código puro (sem IA) sobre o jeito da entrega do relatório final.
  CHK-REL-SO-SECOES           só as seções e as colunas que o modelo declara (o resto é da parte montada pelo código);
  CHK-REL-TAMANHO-DAS-LINHAS  cada célula de texto cheia e dentro do limite da especificação;
  CHK-REL-ORDEM               os passos vão de 1 a n e cada 'depois_de' só olha para trás.
De onde vem: helena-v2/deliverables/relatorio_final.yaml. As seções e colunas vêm de `modelo.secoes`; os limites de tamanho vêm
do `parametros` da CHK-REL-TAMANHO-DAS-LINHAS (uma chave `<coluna>_max` por coluna: frase_max, passo_max). Nada disso é copiado.
Como mudar: para mudar um limite, mude o número no YAML do tipo; para o relatório ganhar uma seção ou coluna, mude as `secoes` do YAML.
"""
from decimal import Decimal

from .. import texto as T
from ..contexto import ErroDeContexto
from ..registro import checagem
from ..resultado import Falha
from .spec_relatorio_base import (COLUNA_DA_ORDEM, COLUNA_DO_DEPOIS_DE, SECAO_DOS_PASSOS, SEM_DEPENDENCIA, aplicavel, linhas,
                                  secoes_do_modelo)

ID_SECOES = "CHK-REL-SO-SECOES"
ID_TAMANHO = "CHK-REL-TAMANHO-DAS-LINHAS"
ID_ORDEM = "CHK-REL-ORDEM"


# ---------------------------------------------------------------------------------------
# CHK-REL-SO-SECOES
# ---------------------------------------------------------------------------------------
@checagem(ID_SECOES, "Relatório só com as seções e colunas da Helena",
          "A Helena podia escrever no relatório números, riscos, fontes ou ações, que são da parte montada pelo código, e o fundador leria "
          "como se o código tivesse conferido.",
          ["C-13"])
def so_as_secoes_da_helena(exe):
    if not aplicavel(exe):
        return None
    secoes = {s["id"]: s for s in secoes_do_modelo(exe)}
    falhas = []
    for sid, valor in exe.acao_obj["entrega"].items():
        cam = f"entrega.{sid}"
        if sid not in secoes:
            falhas.append(Falha(ID_SECOES, "SECAO_DE_FORA", cam,
                                f"A seção '{sid}' não é da Helena: entregas, números, riscos, fontes e ações são montados pelo código. "
                                f"Escreva só estas seções: {', '.join(secoes)}.", T.cortar(sid)))
            continue
        secao = secoes[sid]
        if secao.get("tipo_de_campo") != "tabela":
            continue
        if not isinstance(valor, list):
            falhas.append(Falha(ID_SECOES, "FORMATO_DA_SECAO", cam, f"A seção '{sid}' deve ser uma lista de linhas.", T.cortar(str(valor))))
            continue
        colunas = [c["id"] for c in secao.get("colunas", [])]
        for i, linha in enumerate(valor):
            if not isinstance(linha, dict):
                falhas.append(Falha(ID_SECOES, "FORMATO_DA_LINHA", f"{cam}[{i}]", f"Cada linha da seção '{sid}' deve ter as colunas {', '.join(colunas)}.", T.cortar(str(linha))))
                continue
            for coluna in linha:
                if coluna not in colunas:
                    falhas.append(Falha(ID_SECOES, "COLUNA_DE_FORA", f"{cam}[{i}].{coluna}",
                                        f"A coluna '{coluna}' não existe na seção '{sid}'. Use só: {', '.join(colunas)}.", T.cortar(str(coluna))))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-REL-TAMANHO-DAS-LINHAS
# ---------------------------------------------------------------------------------------
def _limites(exe) -> dict:
    """coluna -> máximo de caracteres, lido das chaves `<coluna>_max` do parametros da especificação."""
    par = exe.parametros(ID_TAMANHO)
    limites = {chave[: -len("_max")]: v for chave, v in par.items() if chave.endswith("_max")}
    if not limites or any(isinstance(v, bool) or not isinstance(v, int) or v < 1 for v in limites.values()):
        raise ErroDeContexto(f"{ID_TAMANHO}: o `parametros` da especificação deve ter um número inteiro positivo por coluna (frase_max, passo_max...).")
    return limites


@checagem(ID_TAMANHO, "Linhas do relatório cheias e curtas",
          "Frase ou passo gigante (ou célula vazia) escondia o que importa e cansava quem lê o card no celular.",
          ["CONF-21"])
def linhas_cheias_e_curtas(exe):
    if not aplicavel(exe):
        return None
    limites = _limites(exe)
    de_texto = {s["id"]: [c["id"] for c in s.get("colunas", []) if c.get("tipo_de_campo", "texto") == "texto"]
                for s in secoes_do_modelo(exe) if s.get("tipo_de_campo") == "tabela"}
    falhas = []
    for linha in linhas(exe):
        for coluna in de_texto.get(linha.secao, []):
            cel = linha.celula(coluna)
            cam = f"{linha.caminho}.{coluna}"
            if cel is None or not cel.strip():
                falhas.append(Falha(ID_TAMANHO, "CELULA_VAZIA", cam, f"A coluna '{coluna}' está vazia. Todas as colunas de texto precisam estar preenchidas."))
            elif coluna in limites and len(cel) > limites[coluna]:
                falhas.append(Falha(ID_TAMANHO, "LINHA_LONGA", cam,
                                    f"A coluna '{coluna}' tem {len(cel)} caracteres e o limite é {limites[coluna]}. Encurte.", T.cortar(cel)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-REL-ORDEM
# ---------------------------------------------------------------------------------------
def _como_inteiro(v):
    """O inteiro que a célula 'ordem' representa (1, '1', 1.0), ou None se não é número inteiro."""
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, int):
        return v
    try:
        d = Decimal(v.strip() if isinstance(v, str) else v)
    except Exception:  # noqa: BLE001 - qualquer coisa que não vire número é só "não é inteiro"
        return None
    if not d.is_finite() or d.adjusted() > 9:  # número gigante (1E+999) não é ordem de passo
        return None
    return int(d) if d == d.to_integral_value() else None


def _ordens_citadas(texto: str):
    """As ordens que um 'depois_de' cita (lista de inteiros), [] para 'nada', ou None se não está no formato '2' ou '1, 3'."""
    t = texto.strip()
    if t.lower() == SEM_DEPENDENCIA:
        return []
    partes = [p.strip() for p in t.split(",")]
    if not all(p.isascii() and p.isdigit() and len(p) <= 9 for p in partes):
        return None
    return [int(p) for p in partes]


@checagem(ID_ORDEM, "Passos numerados de 1 a n e dependências só para trás",
          "Passos com numeração que pula ou repete, ou que dependem de um passo que vem depois, deixavam a ordem do que o fundador faz sem sentido.",
          ["A-17", "K-13"])
def passos_em_ordem(exe):
    if not aplicavel(exe):
        return None
    passos = linhas(exe, SECAO_DOS_PASSOS)
    falhas, ordens = [], []
    for k, linha in enumerate(passos):  # 1ª volta: a numeração
        cam = f"{linha.caminho}.{COLUNA_DA_ORDEM}"
        n = _como_inteiro(linha.dados.get(COLUNA_DA_ORDEM))
        ordens.append(n)
        if n is None:
            falhas.append(Falha(ID_ORDEM, "ORDEM_INVALIDA", cam, f"A ordem do passo {k + 1} deve ser um número inteiro ({k + 1}).", T.cortar(str(linha.dados.get(COLUNA_DA_ORDEM)))))
        elif n != k + 1:
            falhas.append(Falha(ID_ORDEM, "ORDEM_PULA_OU_REPETE", cam,
                                f"A ordem vai de 1 a {len(passos)} sem pular nem repetir: aqui deveria ser {k + 1} e veio {n}.", str(n)))
    existentes = {n for n in ordens if n is not None}
    for linha, n in zip(passos, ordens):  # 2ª volta: as dependências
        cam = f"{linha.caminho}.{COLUNA_DO_DEPOIS_DE}"
        cel = linha.celula(COLUNA_DO_DEPOIS_DE)
        citadas = _ordens_citadas(cel) if cel is not None else None
        if citadas is None:
            falhas.append(Falha(ID_ORDEM, "DEPENDENCIA_MAL_ESCRITA", cam,
                                f"'{COLUNA_DO_DEPOIS_DE}' deve ser '{SEM_DEPENDENCIA}' ou as ordens dos passos anteriores, separadas por vírgula (ex.: 2, 3).",
                                T.cortar(str(linha.dados.get(COLUNA_DO_DEPOIS_DE)))))
            continue
        for c in citadas:
            if n is not None and c >= n:
                falhas.append(Falha(ID_ORDEM, "DEPENDENCIA_PARA_FRENTE", cam,
                                    f"O passo {n} diz que vem depois do passo {c}, mas só pode depender de passos anteriores (ordem menor que {n}).", str(c)))
            elif c not in existentes:
                falhas.append(Falha(ID_ORDEM, "DEPENDENCIA_INEXISTENTE", cam, f"O passo {n} diz que vem depois do passo {c}, que não existe na lista.", str(c)))
    return falhas
