"""Modelo de cálculo do Caio — quatro checagens:

CHK-CALC-01  toda entrada diz a origem (dado do fundador / fonte citada com data / premissa / entrega aprovada)
             e a origem se sustenta; nenhum número solto escondido dentro de uma fórmula.
CHK-CALC-02  o código REFAZ cada conta (decimal exato) e o resultado declarado tem de bater.
CHK-CALC-03  câmbio só vale com fonte datada ou dado do fundador.
CHK-CALC-04  o modelo está bem formado e cada fórmula só usa o que o avaliador seguro permite.

Formato do modelo (README): {"entradas": [{id, valor, unidade, origem, ref, data_da_fonte, citacao}],
                             "formulas": [{id, expressao, resultado, unidade}]}
Cada fórmula usa os valores DECLARADOS das anteriores (a conta é conferida passo a passo).
"""
import re
from datetime import date
from decimal import ROUND_HALF_UP, Context, Decimal

from .. import texto as T
from ..execucao import lista_ou_vazia
from ..expressao import ErroDeExpressao, avaliar
from ..numeros import casas_decimais, numeros_no_texto, para_decimal
from ..registro import CONFIG, checagem
from ..resultado import Falha

ID1, ID2, ID3, ID4 = "CHK-CALC-01", "CHK-CALC-02", "CHK-CALC-03", "CHK-CALC-04"
ORIGENS = ("DADO_DO_FUNDADOR", "FONTE_CITADA", "PREMISSA", "ENTREGA_APROVADA", "CALCULADO")
ORIGENS_DE_ENTRADA = ("DADO_DO_FUNDADOR", "FONTE_CITADA", "PREMISSA", "ENTREGA_APROVADA")
_CTX = Context(prec=120)  # precisão larga para arredondar sem estourar
_ID_VALIDO = re.compile(r"^[a-z][a-z0-9_]{0,40}$")

_MOEDA = r"(?:r\$|brl|reais|real|us\$|usd|dolar(?:es)?|eur|euros?)"
_RAZAO_DE_MOEDAS = re.compile(_MOEDA + r"\s*(?:/|por|per)\s*" + _MOEDA)
_PALAVRA_DE_CAMBIO = re.compile(r"cambio|cotacao|taxa_de_conversao|taxa de conversao|conversao_de_moeda")
_VALOR_EM_MOEDA = [
    re.compile(r"(?:R\$|US\$|U\$S?|USD)\s*(\d[\d.,]*)", re.I),
    re.compile(r"(\d[\d.,]*)\s*(?:reais|d[oó]lares|usd)\b", re.I),
]


_GRUPOS_DE_MOEDA = (
    {"usd", "dolar", "dolares", "dollar", "dollars", "us"},
    {"brl", "real", "reais", "r"},
    {"eur", "euro", "euros"},
)


def _e_cambio(e: dict) -> bool:
    """Parece uma taxa de conversão entre moedas? (tipo CAMBIO, palavra 'câmbio', 'R$/US$' ou duas moedas no id/unidade)"""
    if str(e.get("tipo", "")).upper() == "CAMBIO":
        return True
    f = T.dobrar(" ".join(str(e.get(k, "")) for k in ("id", "unidade", "ref")))
    if _RAZAO_DE_MOEDAS.search(f) or _PALAVRA_DE_CAMBIO.search(f):
        return True
    tokens = set(re.findall(r"[a-z]+", T.dobrar(" ".join(str(e.get(k, "")) for k in ("id", "unidade")))))
    return sum(1 for g in _GRUPOS_DE_MOEDA if tokens & g) >= 2


def _data(v):
    try:
        return date.fromisoformat(v) if isinstance(v, str) else None
    except ValueError:
        return None


def _origem_se_sustenta(exe, e: dict, cam: str, valor: Decimal, saida: dict, premissas: list, aceitas=ORIGENS):
    """Confere a origem de uma entrada ou número. Escreve as falhas em `saida`."""
    origem = e.get("origem")
    ref = e.get("ref")

    def f1(motivo, msg, trecho=""):
        saida[ID1].append(Falha(ID1, motivo, cam, msg, trecho))

    if origem not in aceitas:
        f1("ORIGEM_AUSENTE_OU_INVALIDA", f"Toda entrada diz a origem: {', '.join(aceitas)}. Veio {origem!r}.", str(origem))
        return
    if origem == "DADO_DO_FUNDADOR":
        dec = exe.decisao(ref)
        if dec is None:
            f1("DADO_DO_FUNDADOR_SEM_REGISTRO", f"A origem diz dado do fundador, mas '{ref}' não é uma decisão vigente do contexto.", str(ref))
        elif "valor" in dec and para_decimal(dec["valor"]) is not None and para_decimal(dec["valor"]) != valor:
            f1("DADO_DO_FUNDADOR_DIFERENTE", f"A decisão {ref} registra {dec['valor']}, mas a entrada usa {valor}.", str(valor))
    elif origem == "FONTE_CITADA":
        d = _data(e.get("data_da_fonte"))
        if not e.get("data_da_fonte"):
            f1("FONTE_SEM_DATA", "Fonte citada sem 'data_da_fonte' (AAAA-MM-DD).")
        elif d is None:
            f1("DATA_INVALIDA", "A 'data_da_fonte' deve estar no formato AAAA-MM-DD.", str(e.get("data_da_fonte")))
        elif d > exe.hoje:
            f1("DATA_NO_FUTURO", f"A data da fonte ({d}) é depois de hoje ({exe.hoje}).", str(d))
        elif (exe.hoje - d).days > CONFIG["calculo"]["dias_maximos_da_fonte"]:
            f1("FONTE_VELHA_DEMAIS", f"A fonte tem mais de {CONFIG['calculo']['dias_maximos_da_fonte']} dias.", str(d))
        c = e.get("citacao")
        if not isinstance(c, dict):
            f1("FONTE_SEM_CITACAO", "Fonte citada sem 'citacao' do trecho que traz o número.")
        else:
            if valor not in numeros_no_texto(str(c.get("trecho_original", ""))):
                f1("VALOR_NAO_ESTA_NA_CITACAO", f"O número {valor} não aparece no trecho citado: a citação não prova o valor.", T.cortar(str(c.get("trecho_original", ""))))
    elif origem == "ENTREGA_APROVADA":
        if not ref:
            f1("ORIGEM_SEM_REFERENCIA", "Entrega aprovada sem 'ref' (qual entrega).")
        aprovadas = exe.contexto.get("entregas_aprovadas")
        if aprovadas is not None and not (isinstance(ref, str) and ref in aprovadas):
            f1("ENTREGA_APROVADA_DESCONHECIDA", f"'{ref}' não está entre as entregas aprovadas do contexto.", str(ref))
    elif origem == "PREMISSA":
        premissas.append({"id": e.get("id") or cam, "valor": str(valor), "unidade": e.get("unidade", ""), "ref": ref or ""})
    if not isinstance(e.get("unidade"), str) or not e["unidade"].strip():
        f1("SEM_UNIDADE", "Toda entrada e todo número têm unidade (ex.: US$/hora, pessoas, R$).")


def _regra_do_cambio(e: dict, cam: str, saida: dict):
    if not _e_cambio(e):
        return
    origem = e.get("origem")
    if origem == "DADO_DO_FUNDADOR":
        return
    if origem == "FONTE_CITADA" and e.get("data_da_fonte") and isinstance(e.get("citacao"), dict):
        return
    saida[ID3].append(Falha(ID3, "CAMBIO_SEM_FONTE_DATADA", cam,
                            "Câmbio só vale com fonte datada (fonte citada + data + citação) ou dado do fundador. Premissa ou chute não vale.", str(e.get("id") or e.get("unidade") or "")))


def _analisar(exe) -> dict:
    saida = {ID1: [], ID2: [], ID3: [], ID4: []}
    premissas, resultados = [], {}
    permitidas = {Decimal(c) for c in CONFIG["calculo"]["constantes_permitidas_em_formulas"]}

    for caminho, modelo in exe.modelos_de_calculo:
        nomes, usados_ids, invalidos = {}, set(), set()
        for i, e in enumerate(lista_ou_vazia(modelo.get("entradas"))):
            cam = f"{caminho}.entradas[{i}]"
            if not isinstance(e, dict):
                saida[ID4].append(Falha(ID4, "MODELO_MALFORMADO", cam, "Cada entrada deve ser um objeto com id, valor, unidade e origem."))
                continue
            eid = e.get("id")
            if not isinstance(eid, str) or not _ID_VALIDO.match(eid):
                saida[ID4].append(Falha(ID4, "ID_INVALIDO", cam, "O id da entrada deve ter letras minúsculas, números e _ (ex.: usd_por_hora).", str(eid)))
                continue
            if eid in usados_ids:
                saida[ID4].append(Falha(ID4, "ID_REPETIDO", cam, f"O id '{eid}' aparece duas vezes no modelo.", eid))
                continue
            usados_ids.add(eid)
            valor = para_decimal(e.get("valor"))
            if valor is None:
                saida[ID1].append(Falha(ID1, "VALOR_INVALIDO", cam, f"O valor da entrada '{eid}' não é um número simples (ex.: 0.50 ou 10).", str(e.get("valor"))))
                invalidos.add(eid)
                continue
            nomes[eid] = valor
            _origem_se_sustenta(exe, e, cam, valor, saida, premissas, ORIGENS_DE_ENTRADA)
            _regra_do_cambio(e, cam, saida)

        for j, f in enumerate(lista_ou_vazia(modelo.get("formulas"))):
            cam = f"{caminho}.formulas[{j}]"
            if not isinstance(f, dict):
                saida[ID4].append(Falha(ID4, "MODELO_MALFORMADO", cam, "Cada fórmula deve ser um objeto com id, expressao e resultado."))
                continue
            fid = f.get("id")
            if not isinstance(fid, str) or not _ID_VALIDO.match(fid):
                saida[ID4].append(Falha(ID4, "ID_INVALIDO", cam, "O id da fórmula deve ter letras minúsculas, números e _.", str(fid)))
                continue
            if fid in usados_ids:
                saida[ID4].append(Falha(ID4, "ID_REPETIDO", cam, f"O id '{fid}' aparece duas vezes no modelo.", fid))
                continue
            usados_ids.add(fid)
            expr = f.get("expressao")
            if isinstance(expr, str) and any(re.search(r"(?<![A-Za-z0-9_])" + re.escape(n) + r"(?![A-Za-z0-9_])", expr) for n in invalidos):
                invalidos.add(fid)  # depende de entrada inválida: o erro dela já foi dito
                continue
            try:
                av = avaliar(expr, dict(nomes))
            except ErroDeExpressao as ex:
                saida[ID4].append(Falha(ID4, ex.codigo, f"{cam}.expressao", f"Fórmula '{fid}': {ex.mensagem}", T.cortar(str(expr))))
                invalidos.add(fid)
                continue
            for lit in av.literais:
                if Decimal(lit) not in permitidas:
                    saida[ID1].append(Falha(ID1, "NUMERO_SOLTO_NA_FORMULA", f"{cam}.expressao",
                                            f"A fórmula '{fid}' tem o número {lit} escrito dentro dela, sem origem. Declare-o como entrada com origem (dado do fundador, fonte datada ou premissa).", T.cortar(expr)))
                    break
            declarado = para_decimal(f.get("resultado"))
            if declarado is None:
                saida[ID2].append(Falha(ID2, "SEM_RESULTADO", cam, f"A fórmula '{fid}' não traz o 'resultado' como número simples.", str(f.get("resultado"))))
                invalidos.add(fid)
                continue
            casas = casas_decimais(f.get("resultado"))
            esperado = av.valor.quantize(Decimal(1).scaleb(-casas), rounding=ROUND_HALF_UP, context=_CTX)
            if esperado != declarado:
                saida[ID2].append(Falha(ID2, "RESULTADO_NAO_BATE", cam,
                                        f"A conta '{fid}' ({expr}) refeita dá {esperado}, mas a entrega diz {declarado}.", f"{declarado} != {esperado}"))
            nomes[fid] = declarado
            resultados[fid] = declarado

    # números soltos na entrega (seções do tipo numero, células de tabela...)
    for n in exe.numeros:
        d = n.dados
        valor = para_decimal(d.get("valor"))
        cam = n.caminho
        if valor is None:
            saida[ID1].append(Falha(ID1, "VALOR_INVALIDO", cam, "O valor não é um número simples.", str(d.get("valor"))))
            continue
        _origem_se_sustenta(exe, d, cam, valor, saida, premissas)
        _regra_do_cambio(d, cam, saida)
        if d.get("origem") == "CALCULADO":
            ref = d.get("ref")
            if ref not in resultados:
                saida[ID1].append(Falha(ID1, "CALCULADO_SEM_FORMULA", cam, f"O número diz ser calculado pela fórmula '{ref}', mas ela não existe no modelo de cálculo da entrega.", str(ref)))
            else:
                esperado = resultados[ref].quantize(Decimal(1).scaleb(-casas_decimais(d.get("valor"))), rounding=ROUND_HALF_UP, context=_CTX)
                if esperado != valor:
                    saida[ID2].append(Falha(ID2, "NUMERO_NAO_BATE_COM_A_FORMULA", cam, f"O número {valor} deveria ser o resultado de '{ref}' ({resultados[ref]}).", f"{valor} != {resultados[ref]}"))

    # valores em dinheiro escritos no texto têm de vir do modelo
    if exe.opcao("numeros_do_texto_vem_do_modelo", False):
        conhecidos = set(resultados.values())
        for _, m in exe.modelos_de_calculo:
            for e in lista_ou_vazia(m.get("entradas")):
                v = para_decimal(e.get("valor")) if isinstance(e, dict) else None
                if v is not None:
                    conhecidos.add(v)
        for n in exe.numeros:
            v = para_decimal(n.dados.get("valor"))
            if v is not None:
                conhecidos.add(v)
        for i in exe.itens:
            if i.tipo != "livre":
                continue
            for rx in _VALOR_EM_MOEDA:
                for m in rx.finditer(i.texto):
                    achados = numeros_no_texto(m.group(1))
                    if achados and not any(a in conhecidos for a in achados):
                        saida[ID2].append(Falha(ID2, "NUMERO_FORA_DO_MODELO", i.caminho,
                                                f"O valor '{m.group(0).strip()}' está no texto mas não é nenhuma entrada nem resultado do modelo de cálculo.", T.cortar(i.texto)))
    exe.memoria["premissas"] = premissas
    return saida


def _resultado(exe, id_):
    if not exe.formato_ok or exe.acao != "ENTREGAR":
        return None
    if not (exe.modelos_de_calculo or exe.numeros or exe.opcao("exige_modelo_de_calculo", False)):
        return None
    return exe.memo("analise_de_calculo", lambda: _analisar(exe))[id_]


@checagem(ID1, "Toda entrada do cálculo tem origem que se sustenta",
          "O Caio podia chutar horas, preço ou câmbio e a conta certa sobre um número inventado parecia conferida.",
          ["C-9", "M-16", "K-8"])
def entradas_com_origem(exe):
    return _resultado(exe, ID1)


@checagem(ID2, "O código refaz as contas e elas batem",
          "Uma conta errada (ou um valor no texto que não vem do modelo) chegava ao fundador como número do Caio.",
          ["K-8", "M-16"])
def contas_batem(exe):
    return _resultado(exe, ID2)


@checagem(ID3, "Câmbio só com fonte datada ou dado do fundador",
          "Um câmbio chutado mudava toda a conta em reais sem ninguém notar.",
          ["C-9", "M-16"])
def cambio_com_fonte_datada(exe):
    return _resultado(exe, ID3)


@checagem(ID4, "Modelo bem formado e fórmulas seguras",
          "Fórmula escrita por IA podia executar código (eval) ou usar nome que não existe.",
          ["K-8"])
def formulas_seguras(exe):
    return _resultado(exe, ID4)
