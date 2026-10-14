"""Apoio das checagens do dossiê (CHK-DOSSIE-*): as funções pequenas que as oito checagens dividem.

O que é: ler o que veio (tabelas da entrega, parâmetros, pedido), normalizar texto e procurar termos de uma lista fechada.
Aqui NÃO mora nenhuma regra: só ferramentas.
De onde vem: o desenho das seções e dos ids está em helena-v2/deliverables/dossie.yaml (cabeçalho, "Formato dos ids dentro
da entrega"); os números e as listas vêm dos `parametros` de cada checagem do YAML, entregues por exe.parametros(...).
Como mudar: número, lista ou prefixo => no YAML do tipo (e nada muda no código). Checagem nova => em
spec_dossie_estrutura.py (tabelas e ids) ou em spec_dossie_texto.py (páginas lidas e listas de expressões).
Se um parâmetro faltar ou vier no formato errado, o validador PARA com ErroDeContexto (nunca desliga a checagem em silêncio).
"""
import re

from .. import texto as T
from ..contexto import ErroDeContexto
from ..resultado import Falha

# A letra de cada tipo de id dentro da entrega (YAML do tipo, cabeçalho): fatos F1, F2...; fontes S1...; leituras I1...; lacunas L1...
LETRA_DO_ID = {"fatos": "F", "fontes": "S", "interpretacoes": "I", "lacunas": "L"}
# "Lista de ids numa célula vem separada por vírgula" (YAML do tipo, cabeçalho).
SEPARADOR_DE_IDS = ","
# O pedido original do card é guardado como fonte importada FON-PEDIDO-<card> (servicos.yaml e os tipos de entrega).
PREFIXO_DA_FONTE_DO_PEDIDO = "FON-PEDIDO"

_ASPAS_CURVAS = str.maketrans({"“": '"', "”": '"', "„": '"', "‟": '"', "«": '"', "»": '"', "‘": "'", "’": "'", "‚": "'", "‛": "'"})
_PONTAS = " .,;:!"


# ---------------------------------------------------------------------------------------
# Quando a checagem se aplica, e os parâmetros dela
# ---------------------------------------------------------------------------------------
def e_dossie(exe) -> bool:
    """A checagem vale nesta execução? Só para a ENTREGA do tipo dossiê da especificação v3.1.

    "É o dossiê da especificação" quer dizer: o modelo é do tipo 'dossie' e tem a seção 'entidade' OU traz os parâmetros das
    CHK-DOSSIE-* (o adaptador sempre entrega os dois). O modelo antigo de dossiê (resumo_executivo, fatos_com_fonte...) não tem nenhum
    dos dois e fica de fora. Basta um dos dois sinais: assim um modelo do dossiê sem a seção 'entidade' NÃO passa em silêncio,
    é recusado (a CHK-DOSSIE-FORMA vê todas as seções como a mais).
    """
    if exe.acao != "ENTREGAR" or exe.modelo.get("tipo") != "dossie":
        return False
    tem_entidade = any(isinstance(s, dict) and s.get("id") == "entidade" for s in exe.modelo.get("secoes") or [])
    tem_parametros = any(str(k).startswith("CHK-DOSSIE-") for k in exe.modelo.get("parametros_das_checagens") or {})
    return tem_entidade or tem_parametros


def entrega_do(exe) -> dict:
    e = exe.acao_obj.get("entrega") if isinstance(exe.acao_obj, dict) else None
    return e if isinstance(e, dict) else {}


def _tipo_ok(valor, tipo) -> bool:
    if tipo == "bool":
        return isinstance(valor, bool)
    if tipo == "int":
        return isinstance(valor, int) and not isinstance(valor, bool) and valor >= 0
    if tipo == "str":
        return isinstance(valor, str) and valor.strip() != ""
    if tipo == "termos":  # lista fechada: não pode ser vazia (lista vazia desligaria a checagem sem ninguém ver)
        return isinstance(valor, list) and len(valor) > 0 and all(isinstance(x, str) and x.strip() for x in valor)
    if tipo == "limites":  # {coluna: máximo de caracteres}
        return isinstance(valor, dict) and all(isinstance(k, str) and _tipo_ok(v, "int") for k, v in valor.items())
    raise ValueError(tipo)


def parametros(exe, id_da_checagem: str, esperado: dict) -> dict:
    """Os `parametros` da checagem no YAML do tipo, já conferidos. `esperado` = {nome: "bool" | "int" | "str" | "termos" | "limites"}."""
    p = exe.parametros(id_da_checagem)
    ruins = [nome for nome, tipo in esperado.items() if not _tipo_ok(p.get(nome), tipo)]
    if ruins:
        raise ErroDeContexto(
            f"{id_da_checagem}: faltam parâmetros no YAML do tipo (deliverables/dossie.yaml) ou eles estão no formato errado: {', '.join(ruins)}.")
    return p


# ---------------------------------------------------------------------------------------
# Texto
# ---------------------------------------------------------------------------------------
def cortar(texto) -> str:
    return T.cortar(texto if isinstance(texto, str) else str(texto))


def normal(valor) -> str:
    """A normalização do YAML: espaços seguidos viram um e aspas curvas viram retas. O que não for texto vira ''."""
    if not isinstance(valor, str):
        return ""
    return " ".join(valor.translate(_ASPAS_CURVAS).split())


def dobra(valor, ignora_caixa_e_acento: bool = True) -> str:
    """Forma de comparar: sem diferença de maiúsculas nem de acentos (e sem caractere invisível ou letra de outro alfabeto)."""
    if not isinstance(valor, str):
        return ""
    t = T.normalizar(valor)
    return T.dobrar(t) if ignora_caixa_e_acento else t


def aparar(texto: str) -> str:
    """Tira espaço e pontuação das pontas ('A definir.' vira 'a definir')."""
    return texto.strip(_PONTAS)


def busca_de_termos(termos, palavra_inteira: bool, ignora_caixa_e_acento: bool):
    """Devolve uma função texto -> [termos da lista que aparecem nele], cada um como está escrito na lista (sem repetir)."""
    mapa = {}
    for t in termos:
        f = dobra(t, ignora_caixa_e_acento)
        if f:
            mapa.setdefault(f, t.strip())
    if not mapa:  # todos os termos sumiriam na normalização (só caractere invisível, por exemplo): a lista não serve para nada
        raise ErroDeContexto("Uma lista de expressões do YAML do dossiê não tem nenhum termo que sirva para procurar.")
    alternativas = "|".join(re.escape(f) for f in sorted(mapa, key=len, reverse=True))
    rx = re.compile((r"(?<!\w)(?:%s)(?!\w)" if palavra_inteira else r"(?:%s)") % alternativas)

    def achar(texto) -> list:
        achados = []
        for m in rx.finditer(dobra(texto, ignora_caixa_e_acento)):
            termo = mapa[m.group(0)]
            if termo not in achados:
                achados.append(termo)
        return achados

    return achar


def textos_da_entrega(exe):
    """(caminho, texto) de TODO texto da entrega, menos o `trecho_original` das citações (e mais a autoavaliação, se vier)."""
    def andar(valor, caminho):
        if isinstance(valor, str):
            yield caminho, valor
        elif isinstance(valor, list):
            for i, v in enumerate(valor):
                yield from andar(v, f"{caminho}[{i}]")
        elif isinstance(valor, dict):
            e_citacao = "trecho_original" in valor
            for chave, v in valor.items():
                if not (e_citacao and chave == "trecho_original"):
                    yield from andar(v, f"{caminho}.{chave}")

    yield from andar(entrega_do(exe), "entrega")
    auto = exe.acao_obj.get("autoavaliacao") if isinstance(exe.acao_obj, dict) else None
    if isinstance(auto, str):
        yield "autoavaliacao", auto


# ---------------------------------------------------------------------------------------
# Tabelas e ids
# ---------------------------------------------------------------------------------------
def linhas(entrega: dict, secao: str) -> list:
    """[(posição, linha)] da tabela da seção. Seção ausente ou fora do formato dá lista vazia (quem recusa é a CHK-DOSSIE-FORMA)."""
    v = entrega.get(secao)
    if not isinstance(v, list):
        return []
    return [(i, l) for i, l in enumerate(v) if isinstance(l, dict)]


def celula(linha: dict, coluna: str) -> str:
    return normal(linha.get(coluna))


def separar_ids(valor) -> list:
    """'S1, S2' vira ['S1', 'S2']. Vazio, ou o que não for texto, vira lista vazia."""
    if not isinstance(valor, str):
        return []
    return [p for p in (normal(x) for x in valor.split(SEPARADOR_DE_IDS)) if p]


def ids_em_ordem(id_da_checagem: str, entrega: dict, secao: str) -> list:
    """Falhas dos ids da seção: têm de ser F1, F2... (a letra do tipo), em ordem, sem pular nem repetir."""
    letra, falhas = LETRA_DO_ID[secao], []
    for i, linha in linhas(entrega, secao):
        esperado, veio = f"{letra}{i + 1}", celula(linha, "id")
        if veio != esperado:
            falhas.append(Falha(id_da_checagem, "IDS_FORA_DE_ORDEM", f"entrega.{secao}[{i}].id",
                                f"Os ids da seção '{secao}' vão de {letra}1 em diante, em ordem, sem pular nem repetir: nesta linha o id deve ser {esperado}.",
                                cortar(veio)))
    return falhas


# ---------------------------------------------------------------------------------------
# O pedido
# ---------------------------------------------------------------------------------------
def _dentro(dado, *chaves):
    for c in chaves:
        dado = dado.get(c) if isinstance(dado, dict) else None
    return dado


def textos_do_pedido(exe) -> list:
    """O pedido original do card, onde o motor o entrega: as fontes importadas FON-PEDIDO-* e a ordem de serviço do pedido."""
    achados = [pag.partes.get(1, "") for fid, pag in exe.fontes.items() if str(fid).startswith(PREFIXO_DA_FONTE_DO_PEDIDO)]
    pedido = exe.contexto.get("pedido")
    for caminho in (("card", "ordem_de_servico", "pedido_original"), ("ordem_de_servico", "pedido_original")):
        achados.append(_dentro(pedido, *caminho))
    return [t for t in achados if isinstance(t, str) and t.strip()]
