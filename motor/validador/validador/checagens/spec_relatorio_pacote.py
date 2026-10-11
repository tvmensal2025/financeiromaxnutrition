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
from .. import texto as T
from ..registro import checagem
from ..resultado import Falha
from .spec_relatorio_base import (COLUNA_DAS_REFS, REF_DO_PEDIDO, SECAO_DO_RESUMO, PacoteIncompleto, aplicavel, carregar_pacote,
                                  celulas, compilar, falha_de_pacote, linhas, numeros_da_fonte, numeros_do_texto_da_helena,
                                  parametro_booleano, parametro_textos, problema_da_ref, refs_validas_de_acao)

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
        achados = numeros_do_texto_da_helena(texto)
        if not achados:
            continue
        refs = linha.refs()
        fontes = _numeros_das_fontes(pacote, refs)
        for bruto, forma in achados:
            cam = f"{linha.caminho}.{coluna}"
            if forma is None:
                falhas.append(Falha(ID_NUMEROS, "NUMERO_FORA_DO_FORMATO", cam,
                                    f"O número '{bruto}' não está no formato brasileiro: ponto só para milhar (2.500) e vírgula para decimal (0,50).", T.cortar(texto)))
            elif forma not in fontes:
                falhas.append(Falha(ID_NUMEROS, "NUMERO_FORA_DAS_FONTES", cam,
                                    f"O número '{bruto}' não aparece em nenhuma fonte citada nas refs desta linha ({', '.join(refs) or 'nenhuma'}). "
                                    "Use só números que estão na entrega aprovada, no texto fixo da ação ou do passo, ou no pedido.", T.cortar(texto)))
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
    citadas = {r for linha in linhas(exe, SECAO_DO_RESUMO) for r in linha.refs()}
    return [Falha(ID_RISCO, "ETAPA_FORA_DO_RESUMO", f"entrega.{SECAO_DO_RESUMO}",
                  f"A etapa {etapa} tem {' e '.join(dict.fromkeys(motivos))} na parte montada pelo código, mas nenhuma linha do resumo a cita nas refs. "
                  f"Acrescente uma linha do resumo que fale dela, com {etapa} nas refs.", etapa)
            for etapa, motivos in exigem.items() if etapa not in citadas]


# ---------------------------------------------------------------------------------------
# CHK-REL-SEM-ACAO-NOVA
# ---------------------------------------------------------------------------------------
def _primeiro_verbo(texto: str, verbos: list):
    """O trecho do primeiro verbo de ação de fora que aparece no texto, ou None."""
    for rx in verbos:
        m = rx.search(texto)
        if m:
            return m.group(0)
    return None


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
        limpo = T.normalizar(texto)
        achado = _primeiro_verbo(limpo, verbos)
        if achado and not refs_validas_de_acao(pacote, linha.refs()):
            falhas.append(Falha(ID_ACAO, "ACAO_NOVA", f"{linha.caminho}.{coluna}",
                                f"A linha pede uma ação de fora ('{achado}') e não cita nas refs uma ação do fundador (AF-) de etapa aprovada nem um passo fixo (PF-). "
                                "A Helena não cria ação nova: repita só um item da lista do que só você faz.", T.cortar(texto)))
    return falhas
