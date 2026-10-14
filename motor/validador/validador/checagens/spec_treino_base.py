"""Peças comuns das checagens do roteiro de treinamento (CHK-TREINO-01 a 10, serviço da Isabela).

O que é: funções pequenas que as outras três partes do tipo (spec_treino_termos, spec_treino_forma, spec_treino_fontes) usam:
ler os parâmetros, procurar termos, achar texto entre aspas, achar número e contato, e dizer de que fontes um trecho pode vir.
Este arquivo NÃO registra nenhuma checagem.
De onde vem: a regra de cada checagem está em helena-v2/deliverables/roteiro_treinamento.yaml (checagens_codigo, bloco `parametros`).
O adaptador entrega esse bloco ao validador e as checagens o leem com exe.parametros("CHK-TREINO-nn"). NENHUMA lista nem número do YAML
é copiada para cá; o que o YAML escreve em frase (ex.: "^P([1-9]|1[0-2])$ em sequência a partir de P1") é lido daqui por funções que
tiram o padrão da frase.
Como mudar: para mudar uma lista, um limite ou uma exceção, mude o YAML do tipo (o código segue). Aqui só mudam os NOMES das seções
(logo abaixo) se o tipo mudar de forma, e os "jeitos de procurar" (contato, número, aspas) se a especificação ganhar um jeito novo.
Regra de segurança: parâmetro que falta ou não faz sentido RECUSA a entrega (nunca aprova sem conferir).
"""
import functools
import re

from .. import texto as T
from ..numeros import numeros_no_texto
from ..resultado import Falha

TIPO = "roteiro_treinamento"

# Nomes das seções e colunas do tipo (iguais aos de deliverables/roteiro_treinamento.yaml). Se o YAML os mudar, `rodar` avisa.
SECAO_PASSOS, SECAO_ERROS, SECAO_CHECKLIST = "passo_a_passo", "erros_que_reprovam", "checklist_final"
COL_ID, COL_PASSO, COL_APOIO = "id", "o_que_fazer", "apoio"
# Nome do campo do slogan no pacote da empresa (ex.: pacote_da_empresa.slogan) e começo do id da fonte do pedido original.
CAMPO_DO_SLOGAN = "slogan"
PREFIXO_DO_PEDIDO = "FON-PEDIDO-"


class ErroDeParametro(Exception):
    """O parâmetro da especificação (ou do pacote) falta ou não faz sentido. A checagem recusa dizendo qual."""

    def __init__(self, mensagem, motivo="PARAMETRO_INVALIDO"):
        super().__init__(mensagem)
        self.motivo = motivo


# ---------------------------------------------------------------------------------------
# Rodar uma checagem do tipo
# ---------------------------------------------------------------------------------------
def rodar(exe, id_, corpo):
    """Roda `corpo(exe, parametros)` só em entrega (ENTREGAR) de um roteiro de treinamento. Fora disso: não se aplica (None).

    Falha fechada: sem os parâmetros da especificação, ou com seção do tipo sumida do modelo, a entrega é recusada.
    """
    if exe.acao != "ENTREGAR" or exe.modelo.get("tipo") != TIPO:
        return None
    onde = f"modelo.parametros_das_checagens.{id_}"
    parametros = exe.parametros(id_)
    if not parametros:
        return [Falha(id_, "SEM_PARAMETROS_DA_ESPECIFICACAO", onde,
                      "A especificação não entregou os parâmetros desta checagem; por segurança a entrega é recusada até alguém conferir o motor.")]
    secoes = {s.get("id") for s in exe.modelo.get("secoes") or [] if isinstance(s, dict)}
    faltam = [s for s in (SECAO_PASSOS, SECAO_ERROS, SECAO_CHECKLIST) if s not in secoes]
    if faltam:
        return [Falha(id_, "MODELO_SEM_A_SECAO", "modelo.secoes",
                      f"O modelo do roteiro não tem a seção {', '.join(faltam)}, que esta checagem usa. Confira o YAML do tipo.")]
    try:
        return corpo(exe, parametros)
    except ErroDeParametro as erro:
        return [Falha(id_, erro.motivo, onde, str(erro))]


# ---------------------------------------------------------------------------------------
# Ler parâmetros (sempre conferindo a forma)
# ---------------------------------------------------------------------------------------
def lista_de_textos(parametros, nome) -> list:
    v = parametros.get(nome)
    if not isinstance(v, list) or not v or not all(isinstance(x, str) and x.strip() for x in v):
        raise ErroDeParametro(f"O parâmetro '{nome}' da especificação deveria ser uma lista de textos (e veio {v!r}).")
    return v


def inteiro(valor, nome) -> int:
    if isinstance(valor, bool) or not isinstance(valor, int) or valor < 0:
        raise ErroDeParametro(f"O parâmetro '{nome}' da especificação deveria ser um número inteiro (e veio {valor!r}).")
    return valor


def faixa(parametros, nome, minimo="minimo", maximo="maximo") -> tuple:
    """Lê um parâmetro do tipo {minimo: 3, maximo: 12}."""
    v = parametros.get(nome)
    if not isinstance(v, dict):
        raise ErroDeParametro(f"O parâmetro '{nome}' da especificação deveria ter '{minimo}' e '{maximo}' (e veio {v!r}).")
    mn, mx = inteiro(v.get(minimo), f"{nome}.{minimo}"), inteiro(v.get(maximo), f"{nome}.{maximo}")
    if mn > mx:
        raise ErroDeParametro(f"O parâmetro '{nome}' da especificação tem mínimo maior que o máximo.")
    return mn, mx


def regra_de_ids(parametros, nome) -> tuple:
    """Lê uma frase como "^P([1-9]|1[0-2])$ em sequência a partir de P1" e devolve (padrão, rótulo, primeiro número).

    O padrão é a primeira palavra da frase; o primeiro número vem de "a partir de P1". O rótulo ("P") é a letra que abre o padrão.
    """
    v = parametros.get(nome)
    if not isinstance(v, str) or not v.strip():
        raise ErroDeParametro(f"O parâmetro '{nome}' da especificação deveria ser um padrão de ids seguido de 'em sequência a partir de ...'.")
    texto_do_padrao = v.split(None, 1)[0]
    if len(texto_do_padrao) > 80:
        raise ErroDeParametro(f"O padrão de '{nome}' é grande demais para ser um padrão de ids.")
    try:
        padrao = re.compile(texto_do_padrao)
    except re.error:
        raise ErroDeParametro(f"Não entendi o padrão de ids '{texto_do_padrao}' em '{nome}'.") from None
    inicio = re.search(r"a partir de [A-Za-z]+(\d+)", v)
    rotulo = re.match(r"\^?([A-Za-z]+)", texto_do_padrao)
    if padrao.groups < 1 or not inicio or not rotulo:
        raise ErroDeParametro(f"'{nome}' deveria ter um padrão com o número entre parênteses e a frase 'a partir de P1' (veio {v!r}).")
    return padrao, rotulo.group(1), int(inicio.group(1))


def numero_do_id(padrao, id_):
    """O número de um id que bate com o padrão (P3 -> 3), ou None."""
    if not isinstance(id_, str):
        return None
    m = padrao.fullmatch(id_)
    if not m:
        return None
    try:
        return int(m.group(1))
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------------------
# Onde está o texto
# ---------------------------------------------------------------------------------------
def itens_de_texto(exe) -> list:
    """Todo texto da entrega, MENOS o trecho_original das citações (tipo 'original')."""
    return [i for i in exe.itens if i.tipo != "original" and i.caminho.startswith("entrega.")]


def linhas_da_secao(exe, secao) -> list:
    """As linhas (ou itens) da seção, como a IA entregou; lista vazia se a seção não é uma lista (CHK-COMUM-01 recusa isso)."""
    v = exe.acao_obj["entrega"].get(secao)
    return v if isinstance(v, list) else []


def texto_do_item(item):
    """O texto de um item de lista: o próprio texto, ou o campo 'texto' de um objeto. None se não for nenhum dos dois."""
    if isinstance(item, str):
        return item
    if isinstance(item, dict) and isinstance(item.get("texto"), str):
        return item["texto"]
    return None


def celulas(exe, secao, coluna) -> list:
    """[(caminho, texto)] de uma coluna de tabela (coluna dada) ou dos itens de uma lista (coluna None)."""
    saida = []
    for i, linha in enumerate(linhas_da_secao(exe, secao)):
        if coluna and isinstance(linha, dict):
            if isinstance(linha.get(coluna), str):
                saida.append((f"entrega.{secao}[{i}].{coluna}", linha[coluna]))
        elif not coluna and texto_do_item(linha) is not None:
            saida.append((f"entrega.{secao}[{i}]", texto_do_item(linha)))
    return saida


# ---------------------------------------------------------------------------------------
# Procurar termos (palavra inteira ou expressão inteira, sem diferenciar maiúscula nem acento)
# ---------------------------------------------------------------------------------------
_PALAVRAS = re.compile(r"[^\W_]+")


def tokens(texto: str) -> list:
    return _PALAVRAS.findall(T.dobrar(texto))


@functools.lru_cache(maxsize=4096)
def _chave_do_termo(termo: str) -> str:
    """O termo na forma de comparar: palavras sem acento nem maiúscula, separadas por UM espaço, com espaço dos dois lados."""
    palavras = " ".join(tokens(termo))
    return f" {palavras} " if palavras else ""


def termos_no_texto(texto: str, termos) -> list:
    """Os termos da lista que aparecem no texto como palavra inteira ou expressão inteira (sem diferenciar maiúscula nem acento)."""
    juntos = " " + " ".join(tokens(texto)) + " "
    return [termo for termo in termos if _chave_do_termo(termo) and _chave_do_termo(termo) in juntos]


@functools.lru_cache(maxsize=1024)
def _simbolo_dobrado(simbolo: str) -> str:
    return T.dobrar(simbolo)


def simbolos_no_texto(texto: str, simbolos) -> list:
    """Os símbolos (R$, US$...) que aparecem em QUALQUER posição do texto."""
    f = T.dobrar(texto)
    return [s for s in simbolos if _simbolo_dobrado(s) in f]


def slogan_do_pacote(exe):
    """O slogan oficial do pacote da empresa do card (sem o ponto final), ou None."""
    pacote = exe.contexto.get("pacote_da_empresa")
    s = pacote.get(CAMPO_DO_SLOGAN) if isinstance(pacote, dict) else None
    if not isinstance(s, str):
        return None
    s = T.normalizar(s).strip(" .!?")
    return s or None


def sem_o_slogan(texto: str, slogan) -> str:
    """O texto sem as vezes em que o slogan oficial aparece IGUAL ao pacote (a única exceção da CHK-TREINO-01)."""
    if not slogan:
        return texto
    t = T.normalizar(texto)
    saida, ini = [], 0
    for m in re.finditer(r"(?<![^\W_])" + re.escape(slogan) + r"(?![^\W_])", t):
        saida.append(t[ini:m.start()])
        ini = m.end()
    saida.append(t[ini:])
    return " ".join(saida)


# ---------------------------------------------------------------------------------------
# Comparar com as fontes do pacote
# ---------------------------------------------------------------------------------------
def normal(texto: str) -> str:
    """Forma de comparar: espaços iguais, aspas tiradas, sem maiúscula nem acento."""
    return " ".join(T.dobrar(T.normalizar(texto)).split())


def texto_da_fonte(pagina) -> str:
    """O texto de uma fonte importada, com as quebras de linha (cada regra do pacote costuma ser uma linha)."""
    return "\n".join(pagina.parte_b(n) for n in sorted(pagina.partes))


def fontes_aceitas(exe, entradas) -> list:
    """As fontes (Pagina) que a especificação aceita. `entradas` é a lista `fontes_aceitas` do YAML:
    'FON-PEDIDO-<card>' vale toda fonte cujo id começa com 'FON-PEDIDO-'; texto livre ('fonte importada aprovada...') vale qualquer fonte."""
    prefixos, todas = [], False
    for e in entradas:
        e = e.strip()
        m = re.fullmatch(r"(FON-[A-Za-z0-9-]*?)<[^>]*>", e)
        if m:
            prefixos.append(m.group(1))
        elif e.startswith("FON-"):
            raise ErroDeParametro(f"Não entendi a fonte aceita '{e}' (esperado algo como FON-PEDIDO-<card>).")
        else:
            todas = True
    return [p for id_, p in exe.fontes.items() if todas or any(id_.startswith(pre) for pre in prefixos)]


def tem_com_limite(texto: str, trecho: str) -> bool:
    """O trecho aparece no texto começando e terminando em palavra inteira?"""
    if not trecho:
        return False
    ini = 0
    while True:
        k = texto.find(trecho, ini)
        if k < 0:
            return False
        antes = k == 0 or not (trecho[0].isalnum() and texto[k - 1].isalnum())
        fim = k + len(trecho)
        depois = fim >= len(texto) or not (trecho[-1].isalnum() and texto[fim].isalnum())
        if antes and depois:
            return True
        ini = k + 1


# ---------------------------------------------------------------------------------------
# Uma frase só
# ---------------------------------------------------------------------------------------
_FECHOS = "\"'”’»)]} \t"


def uma_so_frase(texto: str) -> bool:
    """Exatamente um ponto final, de exclamação ou de interrogação, e ele fecha o texto (aspas e parênteses no fim não contam)."""
    t = texto.strip().rstrip(_FECHOS)
    return bool(t) and t[-1] in ".!?" and sum(t.count(c) for c in ".!?") == 1


# ---------------------------------------------------------------------------------------
# Números (formato: milhar com ponto, decimal com vírgula, 'mil' depois do número multiplica por 1.000)
# ---------------------------------------------------------------------------------------
_NUMERO = re.compile(r"\d+(?:[.,]\d+)*")
_ID_DE_DOCUMENTO = re.compile(r"\b[A-Za-z]+(?:-[A-Za-z]+)*-\d+(?:-\d+)*\b")  # DEC-024, FON-REGRAS-GRAVACAO-01: id, não é valor


def valores_no_texto(texto: str) -> list:
    """[(valores possíveis, como foi escrito)] para cada número em algarismos. '1.234' pode ser mil duzentos e trinta e quatro
    ou um vírgula duzentos e trinta e quatro: guardamos as duas leituras. '3 mil' vale 3000.
    Número que não dá para ler (comprido demais) volta com a lista de valores VAZIA: nenhuma fonte o tem, então quem confere o recusa."""
    achados = []
    for m in _NUMERO.finditer(texto):
        possiveis = set(numeros_no_texto(m.group(0)))
        escrito = m.group(0)
        if tokens(texto[m.end():m.end() + 12])[:1] == ["mil"]:
            possiveis = {v * 1000 for v in possiveis}
            escrito += " mil"
        achados.append((possiveis, escrito))
    return achados


def valores_das_fontes(fontes) -> set:
    """Todos os valores numéricos escritos nas fontes (ids como DEC-024 não contam como valor)."""
    saida = set()
    for p in fontes:
        for possiveis, _ in valores_no_texto(_ID_DE_DOCUMENTO.sub(" ", texto_da_fonte(p))):
            saida |= possiveis
    return saida


# ---------------------------------------------------------------------------------------
# Ids citados em texto (P1, E3...)
# ---------------------------------------------------------------------------------------
_TOKEN_DE_ID = re.compile(r"(?<![A-Za-z0-9])[A-Za-z]+\d+(?![A-Za-z0-9])")


def ids_no_texto(texto: str, padroes) -> list:
    """Os ids (P1, E3...) que o texto cita: palavras que batem inteiras com algum dos padrões de id."""
    return [t for t in _TOKEN_DE_ID.findall(texto) if any(p.fullmatch(t) for p in padroes)]


def sem_ids(texto: str, padroes) -> str:
    """O texto com os ids (P1, E3...) trocados por espaço."""
    return _TOKEN_DE_ID.sub(lambda m: " " if any(p.fullmatch(m.group(0)) for p in padroes) else m.group(0), texto)
