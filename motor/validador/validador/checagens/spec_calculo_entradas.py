"""Checagens do modelo de cálculo do Caio sobre as ENTRADAS (V1 a V15) e as premissas:

CHK-CALCULO-01  entradas tipadas: ids sem repetir, unidade e origem válidas, nenhuma decorativa (fora de toda conta).
CHK-CALCULO-02  origem provada: trecho literal numa fonte importada do pacote, que contém o valor; data da fonte; premissa sem prova.
CHK-CALCULO-03  câmbio só com dado do fundador ou fonte com data.
CHK-CALCULO-07  toda premissa tem a sua linha em "premissas a confirmar" e toda linha aponta para uma premissa.

De onde vem: helena-v2/deliverables/calculo.yaml (cada CHK, com seus `parametros`). Os números e as listas são lidos de lá
(exe.parametros); este arquivo só sabe COMO conferir. Como mudar uma regra: mude o `parametros` no YAML do tipo.
A leitura da entrega e as peças comuns estão em spec_calculo_base.py.
"""
import re
from datetime import date

from .. import texto as T
from ..numeros import numeros_no_texto
from ..registro import checagem
from ..resultado import Falha
from . import spec_calculo_base as B
from .citacao import _limite_de_palavra, _ocorrencias, trecho_limpo

ID1, ID2, ID3, ID7 = "CHK-CALCULO-01", "CHK-CALCULO-02", "CHK-CALCULO-03", "CHK-CALCULO-07"


def _rotulo(e) -> str:
    return str(e.id) if isinstance(e.id, str) else e.caminho


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-01
# ---------------------------------------------------------------------------------------
def _entradas_tipadas(exe) -> list:
    par = B.parametros(exe, ID1, ids="regex", origens_aceitas="lista_de_texto")
    padrao_do_id, origens = re.compile(par["ids"]), list(par["origens_aceitas"])
    m = B.carregar(exe)
    falhas = [Falha(ID1, "ENTRADA_MALFORMADA", c, "Cada entrada deve ser um objeto com id, o_que e valor.") for c in m.malformadas if "entradas" in c]
    usados = set()
    for c in m.contas:
        usados |= B.ids_da_expressao(c.expressao)
    vistos = set()
    for e in m.entradas:
        rotulo = _rotulo(e)
        if not (isinstance(e.id, str) and padrao_do_id.match(e.id)):
            falhas.append(Falha(ID1, "ID_FORA_DO_PADRAO", e.caminho, f"O id da entrada deve seguir o padrão {par['ids']} (V1 a V15).", T.cortar(str(e.id))))
        elif e.id in vistos:
            falhas.append(Falha(ID1, "ID_REPETIDO", e.caminho, f"O id {e.id} aparece em duas entradas.", e.id))
        else:
            vistos.add(e.id)
        if not isinstance(e.valor_obj, dict) or e.valor is None:
            falhas.append(Falha(ID1, "VALOR_INVALIDO", e.caminho + ".valor",
                                f"A entrada {rotulo} precisa de um valor que seja número puro (ex.: 0.5 ou 10).", T.cortar(str(e.valor_obj))))
        if not e.unidade.strip():
            falhas.append(Falha(ID1, "SEM_UNIDADE", e.caminho + ".valor", f"A entrada {rotulo} não diz a unidade (ex.: pessoas, horas por semana, US$ por hora)."))
        if e.origem not in origens:
            falhas.append(Falha(ID1, "ORIGEM_INVALIDA", e.caminho + ".valor",
                                f"A origem da entrada {rotulo} deve ser uma destas: {', '.join(origens)} (entrada nunca é CALCULADO). Veio {T.cortar(str(e.origem))!r}.", T.cortar(str(e.origem))))
        if isinstance(e.id, str) and e.id not in usados:
            falhas.append(Falha(ID1, "ENTRADA_SEM_USO", e.caminho,
                                f"A entrada {e.id} não aparece em nenhuma conta ({par['entrada_sem_uso'] if isinstance(par.get('entrada_sem_uso'), str) else 'número decorativo'}). Use-a numa conta ou tire-a.", e.id))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-02
# ---------------------------------------------------------------------------------------
def _data_valida(texto):
    try:
        return date.fromisoformat(texto) if isinstance(texto, str) else None
    except ValueError:
        return None


def _fonte_permitida(exe, e, fid, prefixos) -> str | None:
    """Mensagem de erro se a fonte `fid` não é das que a especificação aceita para a origem da entrada; None se vale."""
    rotulo = _rotulo(e)
    if e.origem in prefixos and prefixos[e.origem]:
        if not any(fid.startswith(p) for p in prefixos[e.origem]):
            return f"A entrada {rotulo} é {e.origem}: a fonte deve ser {' ou '.join(p + '<...>' for p in prefixos[e.origem])}, não '{fid}'."
    else:  # FONTE_CITADA: fonte importada aprovada do pacote, que não seja uma das fontes de outra origem
        outros = [p for ps in prefixos.values() for p in ps]
        if any(fid.startswith(p) for p in outros):
            return f"A entrada {rotulo} é {e.origem}: '{fid}' é fonte de outra origem (pedido, pacote ou entrega aprovada), não fonte citada."
    return None


def _trecho_na_fonte(exe, trecho, fonte, par) -> tuple:
    """(motivo, mensagem) se o trecho não vale como prova; None se existe na fonte e é longo o bastante (ou frase inteira)."""
    core = trecho_limpo(trecho)
    if not core:
        return "TRECHO_VAZIO", "O trecho citado só tem pontuação."
    chave, b = fonte.parte_chave(1), fonte.parte_b(1)
    achados = [(s, e) for s, e in _ocorrencias(chave, core) if _limite_de_palavra(chave, s, e, core)]
    if not achados:
        return "TRECHO_NAO_ESTA_NA_FONTE", "O trecho não existe, igual, na fonte importada. Copie-o exatamente como está (só espaços e aspas podem diferir)."
    if T.contar_palavras(core) >= par["minimo_palavras"]:
        return None
    if par.get("aceita_frase_inteira") and any(T.inicio_de_frase(b, s) and T.fim_de_frase(b, e) for s, e in achados):
        return None
    return ("TRECHO_CURTO", f"O trecho tem {T.contar_palavras(core)} palavras e não é uma frase inteira da fonte. "
            f"Cite {par['minimo_palavras']} palavras ou mais, ou a frase do começo ao fim.")


def _origem_provada(exe) -> list:
    par = B.parametros(exe, ID2, fontes_por_origem="fontes_por_origem", minimo_palavras="inteiro")
    prefixos = B.prefixos_de_fonte(exe)
    falhas = []
    for e in B.carregar(exe).entradas:
        rotulo, cam = _rotulo(e), e.caminho + ".valor"

        def falha(motivo, msg, trecho="", onde=cam):
            falhas.append(Falha(ID2, motivo, onde, msg, trecho))

        if e.origem == "PREMISSA":
            if e.ref not in (None, ""):
                falha("PREMISSA_COM_REF", f"A premissa {rotulo} não tem ref: premissa é suposição do Caio, sem fonte.", T.cortar(str(e.ref)))
            if e.citacao not in (None, ""):
                falha("PREMISSA_COM_CITACAO", f"A premissa {rotulo} não tem citação: premissa é suposição do Caio, sem trecho.", "")
            continue
        if e.origem not in prefixos:
            continue  # origem inválida (inclusive CALCULADO): a CHK-CALCULO-01 já diz
        c = e.citacao
        if not isinstance(c, dict):
            falha("PROVA_SEM_CITACAO", f"A entrada {rotulo} ({e.origem}) precisa da citação do trecho que traz o número.")
            continue
        if "leitura_id" in c:
            falha("CITACAO_COM_LEITURA_ID", f"A citação da entrada {rotulo} aponta leitura_id, mas o Caio não lê páginas: aponte fonte_importada_id do pacote.", "", cam + ".citacao")
            continue
        fid = c.get("fonte_importada_id")
        if not isinstance(fid, str) or not fid:
            falha("CITACAO_SEM_FONTE", f"A citação da entrada {rotulo} precisa de fonte_importada_id.", "", cam + ".citacao")
            continue
        if e.ref != fid:
            falha("REF_DIFERENTE_DA_FONTE", f"A ref da entrada {rotulo} ({T.cortar(str(e.ref))!r}) deve ser igual à fonte da citação ({fid!r}).", T.cortar(str(e.ref)))
        msg = _fonte_permitida(exe, e, fid, prefixos)
        if msg:
            falha("FONTE_DE_OUTRA_ORIGEM", msg, fid, cam + ".citacao")
            continue
        fonte = exe.fontes.get(fid)
        if fonte is None:
            falha("FONTE_NAO_IMPORTADA", f"A fonte '{fid}' não veio no pacote desta tarefa.", fid, cam + ".citacao")
            continue
        trecho = c.get("trecho_original")
        if not isinstance(trecho, str) or not trecho.strip():
            falha("TRECHO_VAZIO", f"A citação da entrada {rotulo} não traz trecho_original.", "", cam + ".citacao")
            continue
        erro = _trecho_na_fonte(exe, trecho, fonte, par)
        if erro:
            falha(erro[0], f"Entrada {rotulo}: {erro[1]}", T.cortar(trecho), cam + ".citacao.trecho_original")
        elif e.valor is not None and e.valor not in _numeros_do_trecho(trecho):
            falha("VALOR_NAO_ESTA_NO_TRECHO", f"O valor {e.valor} da entrada {rotulo} não aparece entre os números do trecho citado: o trecho não prova o valor.", T.cortar(trecho), cam + ".citacao.trecho_original")
        if e.origem == "FONTE_CITADA":
            _conferir_data(exe, e, falha)
    return falhas


def _numeros_do_trecho(trecho) -> list:
    """Os números do trecho, lendo milhar com ponto e decimal com vírgula (e também '0.50' e '1,234')."""
    achados = list(numeros_no_texto(trecho))
    for m in re.finditer(r"\d+(?:[.,]\d+)*", trecho):
        n = B.numero_do_texto(m.group(0))
        if n is not None:
            achados.append(n)
            if re.match(r"\s+mil\b", trecho[m.end():].lower()):
                achados.append(n * 1000)
    return achados


def _conferir_data(exe, e, falha):
    rotulo = _rotulo(e)
    if not e.data:
        falha("FONTE_SEM_DATA", f"A entrada {rotulo} é FONTE_CITADA e precisa de data_da_fonte (AAAA-MM-DD).")
        return
    d = _data_valida(e.data)
    if d is None:
        falha("DATA_INVALIDA", f"A data_da_fonte da entrada {rotulo} deve estar no formato AAAA-MM-DD.", T.cortar(str(e.data)))
    elif d > exe.hoje:
        falha("DATA_NO_FUTURO", f"A data_da_fonte da entrada {rotulo} ({d}) é depois da criação do card ({exe.hoje}).", str(d))


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-03
# ---------------------------------------------------------------------------------------
def tipo_da_unidade(unidade: str, moedas: dict):
    """O que a unidade diz sobre moeda: None (sem moeda), ("M", código) (uma moeda) ou ("C", B, A) (câmbio 'B por A').
    Devolve "ERRO" se a unidade tem moedas que não dá para entender (ex.: duas moedas fora do padrão 'B por A')."""
    simbolos = sorted(moedas, key=len, reverse=True)
    achados = re.findall(r"(?<![A-Za-z])(" + "|".join(re.escape(s) for s in simbolos) + ")", unidade or "")
    if not achados:
        return None
    if len(achados) == 1:
        return ("M", moedas[achados[0]])
    if len(achados) == 2 and achados[0] != achados[1]:
        padrao = r"^\s*" + re.escape(achados[0]) + r"\s*(?:por|/)\s*" + re.escape(achados[1]) + r"(?![A-Za-z])"
        if re.search(padrao, unidade or ""):
            return ("C", moedas[achados[0]], moedas[achados[1]])
    return "ERRO"


def _cambio_com_origem(exe) -> list:
    par = B.parametros(exe, ID3, moedas="dicionario_de_texto", origens_aceitas="lista_de_texto")
    falhas = []
    for e in B.carregar(exe).entradas:
        t = tipo_da_unidade(e.unidade, par["moedas"])
        if not (isinstance(t, tuple) and t[0] == "C"):
            continue
        rotulo, cam = _rotulo(e), e.caminho + ".valor"
        if e.origem not in par["origens_aceitas"]:
            falhas.append(Falha(ID3, "CAMBIO_SEM_ORIGEM_VALIDA", cam,
                                f"A entrada {rotulo} é uma cotação ({e.unidade}): só vale com origem {' ou '.join(par['origens_aceitas'])} (data na fonte). Veio {T.cortar(str(e.origem))!r}.", T.cortar(str(e.origem))))
        elif e.origem == "FONTE_CITADA" and not e.data:
            falhas.append(Falha(ID3, "CAMBIO_SEM_DATA", cam, f"A cotação {rotulo} é FONTE_CITADA e precisa de data_da_fonte: câmbio sem data não vale."))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-07
# ---------------------------------------------------------------------------------------
def _premissas_a_vista(exe) -> list:
    m = B.carregar(exe)
    premissas = {e.id for e in m.entradas if e.origem == "PREMISSA" and isinstance(e.id, str)}
    falhas, vistas = [], {}
    for cam, linha in m.premissas:
        alvo = B.so_texto(linha.get("entrada"))
        if not isinstance(alvo, str) or alvo not in premissas:
            falhas.append(Falha(ID7, "LINHA_SEM_PREMISSA", cam, f"A linha aponta para {T.cortar(str(alvo))!r}, que não é uma entrada de origem PREMISSA. Cada linha desta seção é de uma premissa.", T.cortar(str(alvo))))
        elif alvo in vistas:
            falhas.append(Falha(ID7, "PREMISSA_COM_DUAS_LINHAS", cam, f"A premissa {alvo} já tem uma linha ({vistas[alvo]}); cada premissa tem exatamente uma.", alvo))
        else:
            vistas[alvo] = cam
    for e in m.entradas:
        if B.em(e.id, premissas) and e.id not in vistas:
            falhas.append(Falha(ID7, "PREMISSA_SEM_LINHA", e.caminho, f"A entrada {e.id} é PREMISSA e não tem linha em premissas_a_confirmar: o fundador precisa vê-la para confirmar.", e.id))
    return falhas


# ---------------------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------------------
@checagem(ID1, "Calculo: entradas tipadas, com origem e todas usadas",
          "Uma entrada sem origem válida, repetida ou que nenhuma conta usa deixava um número decorativo ou inventado parecer parte do cálculo.",
          ["C-9", "M-16"])
def entradas_tipadas(exe):
    return B.roda(exe, ID1, _entradas_tipadas)


@checagem(ID2, "Calculo: origem provada por trecho da fonte do pacote",
          "O Caio podia dizer 'dado seu' ou 'fonte citada' sem que o trecho existisse na fonte ou trouxesse o número.",
          ["C-9", "M-16", "C-8", "M-15"])
def origem_provada(exe):
    return B.roda(exe, ID2, _origem_provada)


@checagem(ID3, "Calculo: câmbio só com dado do fundador ou fonte datada",
          "Uma cotação chutada ou sem data mudava toda a conta em reais sem ninguém notar.",
          ["C-9", "M-16"])
def cambio_com_origem(exe):
    return B.roda(exe, ID3, _cambio_com_origem)


@checagem(ID7, "Calculo: toda premissa à vista, uma linha para cada",
          "Uma premissa fora da lista de confirmação passava como se fosse fato, e o fundador não a via para confirmar.",
          ["M-16", "C-9"])
def premissas_a_vista(exe):
    return B.roda(exe, ID7, _premissas_a_vista)
