"""O relatório contra as entregas aprovadas que o pacote traz: CHK-REL-REFS, CHK-REL-NUMEROS, CHK-REL-RISCO-ALTO-NO-RESUMO
e CHK-REL-SEM-ACAO-NOVA.

O que é: quatro conferências de código puro (sem IA) que ligam cada linha escrita pela Helena ao que o código montou.
  CHK-REL-REFS                   toda linha tem refs, e cada ref é uma etapa aprovada, um AF-, um PF- ou PEDIDO;
  CHK-REL-NUMEROS                todo número escrito aparece numa fonte citada nas refs da mesma linha;
  CHK-REL-RISCO-ALTO-NO-RESUMO   toda etapa com risco ALTO, pergunta aberta ou item sem conferir está nas refs do resumo;
  CHK-REL-SEM-ACAO-NOVA          verbo de ação de fora só com AF- de etapa aprovada ou PF- nas refs da linha.
De onde vem: helena-v2/deliverables/relatorio_final.yaml (as colunas e os verbos vêm do `parametros` de cada checagem) e o pacote
da tarefa, lido por spec_relatorio_base.carregar_pacote (formato do caso SRV-RELATORIO-FINAL/pedido.yaml; o motor ainda não tem
schema para ele).
Como mudar: verbos e colunas = `parametros` no YAML do tipo. Se o pacote mudar de formato, mude só o leitor em spec_relatorio_base.py.
Limites que valem saber: o código confere que a ref EXISTE e que o NÚMERO está na fonte; que a frase diga o mesmo que a entrega é
do revisor (RUB-REL-01). A lista de verbos é fechada e não pega paráfrase (RUB-REL-04).
"""
import re
from decimal import Decimal

from .. import texto as T
from ..numeros import para_decimal
from ..registro import checagem
from ..resultado import Falha
from .spec_relatorio_base import (COLUNA_DAS_REFS, REF_DO_PEDIDO, SECAO_DO_RESUMO, PacoteIncompleto, aplicavel, carregar_pacote,
                                  celulas, compilar, falha_de_pacote, linhas, numeros_da_fonte,
                                  parametro_booleano, parametro_textos, problema_da_ref, refs_validas_de_acao, textos_da_fonte,
                                  ler_brasileiro, _leituras_da_fonte)
from . import spec_calculo_base as C

ID_REFS = "CHK-REL-REFS"
ID_NUMEROS = "CHK-REL-NUMEROS"
ID_RISCO = "CHK-REL-RISCO-ALTO-NO-RESUMO"
ID_ACAO = "CHK-REL-SEM-ACAO-NOVA"
RISCO_QUE_OBRIGA = "ALTO"  # nível de risco (parte montada pelo código) que obriga a etapa a aparecer no resumo


# ---------------------------------------------------------------------------------------
# CHK-REL-REFS
# ---------------------------------------------------------------------------------------
@checagem(ID_REFS, "Toda linha liga ao que foi aprovado (refs que existem)",
          "Frase sem ref, ou com ref de etapa que não existe, não foi aprovada ou é o próprio relatório, parecia apoiada numa entrega aprovada.",
          ["C-13", "A-1"])
def refs_que_existem(exe):
    if not aplicavel(exe):
        return None
    try:
        pacote = carregar_pacote(exe)
    except PacoteIncompleto as erro:
        return [falha_de_pacote(ID_REFS, erro)]
    falhas = []
    for linha in linhas(exe):
        cam = f"{linha.caminho}.{COLUNA_DAS_REFS}"
        refs = linha.refs()
        if not refs:
            falhas.append(Falha(ID_REFS, "SEM_REFS", cam, "A linha não tem refs. Diga de qual etapa aprovada (ou do pedido) ela vem."))
            continue
        for ref in dict.fromkeys(refs):
            achado = problema_da_ref(pacote, ref)
            if achado:
                falhas.append(Falha(ID_REFS, achado[0], cam, achado[1], T.cortar(ref)))
        for ref in dict.fromkeys(refs):  # AF- que o plano deu a mais de uma etapa: a ref da etapa vai junto na mesma linha
            etapas = pacote.acoes_do_fundador.get(ref, set())
            if len(etapas) > 1 and not (etapas & set(refs)):
                falhas.append(Falha(ID_REFS, "ACAO_EM_VARIAS_ETAPAS", cam,
                                    f"A ação {ref} existe em mais de uma etapa ({', '.join(sorted(etapas))}). Ponha na mesma linha a ref da etapa a que você se refere.", T.cortar(ref)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-REL-NUMEROS
# ---------------------------------------------------------------------------------------
def _numeros_das_fontes(pacote, refs: list) -> set:
    """Os números das fontes que as refs apontam: entrega aprovada (trechos), texto fixo do AF/PF ou a ordem de serviço."""
    saida = set()
    for ref in dict.fromkeys(refs):
        if ref == REF_DO_PEDIDO:
            saida |= numeros_da_fonte(pacote.textos_do_pedido)
        elif ref in pacote.etapas_aprovadas:
            saida |= numeros_da_fonte(pacote.etapas_aprovadas[ref].get("trechos"))
        elif ref in pacote.textos_fixos and (ref in pacote.acoes_do_fundador or ref in pacote.passos_fixos):
            saida |= numeros_da_fonte(pacote.textos_fixos[ref])
    return saida


_NUMERO_COM_CONTEXTO = re.compile(r"\d+(?:[.,]\d+)*", re.UNICODE)
_MOEDA_ANTES = re.compile(r"(?:US\$|R\$|€)\s*$", re.IGNORECASE)
_ESCALA = {"mil": 1000, "milhao": 1_000_000, "milhoes": 1_000_000, "k": 1000, "mi": 1_000_000}
_UNIDADES = {"dolar": "US$", "dolares": "US$", "real": "R$", "reais": "R$", "euro": "€", "euros": "€",
             "hora": "hora", "horas": "hora", "pessoa": "pessoa", "pessoas": "pessoa", "minuto": "minuto", "minutos": "minuto"}


def _numero_tipado(texto, fonte=False):
    """(trecho, valor normalizado, moeda ou grandeza) de algarismos e valores por extenso."""
    saida = []
    for achado in _NUMERO_COM_CONTEXTO.finditer(texto):
        bruto = achado.group()
        formas = _leituras_da_fonte(bruto) if fonte else {ler_brasileiro(bruto)}
        antes = _MOEDA_ANTES.search(texto[max(0, achado.start() - 5):achado.start()])
        depois = re.match(r"\s*(milhões|milhão|milhoes|milhao|mil|mi|k)?\b\s*(?:de\s+)?(dólares?|reais?|euros?|horas?|pessoas?|minutos?|%)?", texto[achado.end():], re.IGNORECASE)
        escala = T.dobrar(depois.group(1) or "") if depois else ""
        unidade = T.dobrar(depois.group(2) or "") if depois else ""
        tipo = antes.group().strip().upper() if antes else _UNIDADES.get(unidade, "%" if unidade == "%" else None)
        if fonte and tipo is None and re.search(r"pessoas? no grupo:\s*$", T.dobrar(texto[max(0, achado.start() - 30):achado.start()])):
            tipo = "pessoa"
        if not fonte and re.fullmatch(r"\d{1,3},\d{3}", bruto) and tipo in {"US$", "R$", "€"}:
            formas = {None}  # separador inglês/ambíguo em dinheiro declarado
        for forma in formas:
            if forma is not None and escala in _ESCALA:
                forma = format((Decimal(forma) * _ESCALA[escala]).normalize(), "f")
            saida.append((bruto, forma, tipo))
    if not fonte:
        palavras = re.findall(r"[a-z]+", T.dobrar(texto))
        for i, palavra in enumerate(palavras):
            if palavra not in _UNIDADES or _UNIDADES[palavra] not in {"US$", "R$", "€"}:
                continue
            fim = i - 1 if i and palavras[i - 1] == "de" else i
            inicio = fim
            while inicio and palavras[inicio - 1] in C.PALAVRAS_DE_NUMERO | {"e"}:
                inicio -= 1
            valor = C.numero_por_extenso(palavras[inicio:fim]) if inicio < fim else None
            if valor is not None:
                saida.append((" ".join(palavras[inicio:i + 1]), str(valor), _UNIDADES[palavra]))
    return saida


def _textos_das_fontes(pacote, refs):
    for ref in dict.fromkeys(refs):
        if ref == REF_DO_PEDIDO:
            yield from pacote.textos_do_pedido
        elif ref in pacote.etapas_aprovadas:
            yield from textos_da_fonte(pacote.etapas_aprovadas[ref].get("trechos"))
        elif ref in pacote.textos_fixos:
            yield from pacote.textos_fixos[ref]


def _numeros_estruturados(valor):
    if isinstance(valor, dict):
        numero = para_decimal(valor.get("valor"))
        unidade = T.dobrar(valor.get("unidade", "")) if isinstance(valor.get("unidade"), str) else ""
        tipo = next((simbolo for simbolo in ("US$", "R$", "€") if T.dobrar(simbolo) in unidade), None)
        tipo = tipo or next((tipo for palavra, tipo in _UNIDADES.items() if palavra in unidade), None)
        if numero is not None and tipo:
            yield (format(numero.normalize(), "f"), tipo)
        for item in valor.values():
            yield from _numeros_estruturados(item)
    elif isinstance(valor, list):
        for item in valor:
            yield from _numeros_estruturados(item)


@checagem(ID_NUMEROS, "Todo número está na fonte citada na mesma linha",
          "Número inventado, arredondado ou trocado no resumo parecia vir da conta aprovada; o fundador decidiria em cima dele.",
          ["K-8", "C-13"])
def numeros_nas_fontes(exe):
    if not aplicavel(exe):
        return None
    colunas = parametro_textos(exe, ID_NUMEROS, "colunas")
    try:
        pacote = carregar_pacote(exe)
    except PacoteIncompleto as erro:
        return [falha_de_pacote(ID_NUMEROS, erro)]
    falhas = []
    for linha, coluna, texto in celulas(exe, colunas):
        achados = _numero_tipado(texto)
        if not achados:
            continue
        refs = linha.refs()
        fontes = _numeros_das_fontes(pacote, refs)
        tipados = {(forma, tipo) for fonte in _textos_das_fontes(pacote, refs)
                   for _, forma, tipo in _numero_tipado(fonte, fonte=True) if tipo is not None}
        for ref in refs:
            if ref in pacote.etapas_aprovadas:
                tipados.update(_numeros_estruturados(pacote.etapas_aprovadas[ref].get("trechos")))
        for bruto, forma, tipo in achados:
            cam = f"{linha.caminho}.{coluna}"
            if forma is None:
                falhas.append(Falha(ID_NUMEROS, "NUMERO_FORA_DO_FORMATO", cam,
                                    f"O número '{bruto}' não está no formato brasileiro: ponto só para milhar (2.500) e vírgula para decimal (0,50).", T.cortar(texto)))
            elif forma not in fontes:
                falhas.append(Falha(ID_NUMEROS, "NUMERO_FORA_DAS_FONTES", cam,
                                    f"O número '{bruto}' não aparece em nenhuma fonte citada nas refs desta linha ({', '.join(refs) or 'nenhuma'}). "
                                    "Use só números que estão na entrega aprovada, no texto fixo da ação ou do passo, ou no pedido.", T.cortar(texto)))
            elif tipo is not None and (forma, tipo) not in tipados:
                falhas.append(Falha(ID_NUMEROS, "MOEDA_OU_GRANDEZA_FORA_DAS_FONTES", cam,
                                    f"O valor '{bruto}' aparece, mas não como {tipo} nas fontes citadas nesta linha.", T.cortar(texto)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-REL-RISCO-ALTO-NO-RESUMO
# ---------------------------------------------------------------------------------------
@checagem(ID_RISCO, "Risco alto, pergunta aberta e item sem conferir aparecem no resumo",
          "O resumo podia deixar de fora a etapa com o maior risco ou com uma pergunta para o fundador, que ficava só no fundo do card.",
          ["C-13"])
def risco_alto_no_resumo(exe):
    if not aplicavel(exe):
        return None
    try:
        pacote = carregar_pacote(exe)
    except PacoteIncompleto as erro:
        return [falha_de_pacote(ID_RISCO, erro)]
    exigem = {}  # etapa -> por que o resumo precisa citá-la
    for item in pacote.riscos:
        if item.get("risco") == RISCO_QUE_OBRIGA:
            exigem.setdefault(item["etapa"], []).append(f"risco {RISCO_QUE_OBRIGA}")
    for item in pacote.perguntas_abertas:
        exigem.setdefault(item["etapa"], []).append("pergunta aberta")
    for item in pacote.sem_conferir:
        exigem.setdefault(item["etapa"], []).append("item sem conferir")
    resumo = linhas(exe, SECAO_DO_RESUMO)
    falhas = [Falha(ID_RISCO, "RESUMO_SEM_CONTEUDO", linha.caminho + ".frase",
                    "A frase do resumo precisa explicar a etapa citada em pelo menos cinco palavras.", T.cortar(linha.celula("frase") or ""))
              for linha in resumo if len(T.tokens_alfa(linha.celula("frase") or "")) < 5]
    citadas = {r for linha in resumo if len(T.tokens_alfa(linha.celula("frase") or "")) >= 5 for r in linha.refs()}
    falhas += [Falha(ID_RISCO, "ETAPA_FORA_DO_RESUMO", f"entrega.{SECAO_DO_RESUMO}",
                  f"A etapa {etapa} tem {' e '.join(dict.fromkeys(motivos))} na parte montada pelo código, mas nenhuma linha do resumo a cita nas refs. "
                  f"Acrescente uma linha do resumo que fale dela, com {etapa} nas refs.", etapa)
            for etapa, motivos in exigem.items() if etapa not in citadas]
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-REL-SEM-ACAO-NOVA
# ---------------------------------------------------------------------------------------
@checagem(ID_ACAO, "Ação de fora só se for item da lista do que só o fundador faz",
          "A Helena podia pôr no relatório um passo novo de ação de fora (publicar, contatar, pagar) que ninguém aprovou nem o plano previa.",
          ["B-17", "CONF-20"])
def sem_acao_nova(exe):
    if not aplicavel(exe):
        return None
    ignorar = parametro_booleano(exe, ID_ACAO, "sem_diferenca_de_maiusculas", False)
    verbos = compilar(exe, ID_ACAO, "verbos_regex", ignorar_caixa=ignorar)
    colunas = parametro_textos(exe, ID_ACAO, "colunas")
    try:
        pacote = carregar_pacote(exe)
    except PacoteIncompleto as erro:
        return [falha_de_pacote(ID_ACAO, erro)]
    falhas = []
    for linha, coluna, texto in celulas(exe, colunas):
        limpo = T.dobrar(T.normalizar(texto))
        refs_de_acao = refs_validas_de_acao(pacote, linha.refs())
        textos_autorizados = [T.dobrar(T.normalizar(t)) for ref in refs_de_acao for t in pacote.textos_fixos.get(ref, [])]
        achado = next((m.group(0) for rx in verbos if (m := rx.search(limpo))
                       and not any(rx.search(t) for t in textos_autorizados)), None)
        if achado:
            falhas.append(Falha(ID_ACAO, "ACAO_NOVA", f"{linha.caminho}.{coluna}",
                                f"A linha pede uma ação de fora ('{achado}') que não aparece no texto fixo das ações AF-/PF- citadas. "
                                "Repita apenas a ação prevista na lista do que só você faz.", T.cortar(texto)))
    return falhas
