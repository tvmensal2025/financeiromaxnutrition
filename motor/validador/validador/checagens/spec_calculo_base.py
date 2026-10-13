"""Base comum das checagens CHK-CALCULO-01 a 12 (o modelo de cálculo do Caio). Aqui NÃO há checagem registrada.

O que é: as peças que as checagens do tipo "calculo" dividem: ler a entrega do Caio (entradas V1.., contas K1..,
resultado principal, cenários, premissas), refazer as contas em decimal exato, ler números escritos em português
e achar termos num texto.
De onde vem: a forma da entrega é a de helena-v2/deliverables/calculo.yaml; TODO número, lista e limite vem dos
`parametros` da checagem nesse YAML, lidos com exe.parametros("CHK-CALCULO-nn"). Nada daquilo é copiado para cá.
Como mudar: para mudar uma regra, mude o `parametros` no YAML do tipo. Para mudar COMO a entrega é lida (um campo novo,
por exemplo), mude só este arquivo. Só biblioteca padrão (o validador de produção não usa YAML).

Quando as checagens do tipo valem: só em entrega do tipo "calculo" que chega com os `parametros_das_checagens` da
especificação (é o que o motor e o adaptador entregam). Sem eles a checagem "não se aplica": é o desenho antigo do banco de
casos, que nem tem esses campos. Com eles mas sem o bloco da própria checagem (ou com ele num formato errado), ela RECUSA com o motivo PARAMETROS_INVALIDOS
(falha fechada: nunca aprova sem conferir).
"""
import re
from dataclasses import dataclass, field
from decimal import Decimal, localcontext
from fractions import Fraction

from .. import texto as T
from ..expressao import MAX_ELEMENTOS, MAX_PROFUNDIDADE, MAX_TAMANHO, ErroDeExpressao
from ..numeros import casas_decimais, para_decimal as _para_decimal
from ..resultado import Falha

TIPO = "calculo"
SEM_AJUSTE = {"—", "–", "-", "−", ""}  # como se escreve "nenhum ajuste" na coluna ajustes


def para_decimal(valor):
    """Rejeita expoentes que fariam Fraction materializar bilhões de dígitos."""
    numero = _para_decimal(valor)
    if numero is None:
        return None
    expoente = numero.as_tuple().exponent
    if abs(expoente) > 1000 or abs(numero.adjusted()) > 1000:
        return None
    return numero


# ---------------------------------------------------------------------------------------
# Quando a checagem vale e o que a especificação manda
# ---------------------------------------------------------------------------------------
def aplica(exe) -> bool:
    """A entrega é um ENTREGAR do tipo calculo, vindo com os parâmetros da especificação?"""
    return bool(exe.formato_ok and exe.acao == "ENTREGAR" and exe.modelo.get("tipo") == TIPO
                and "parametros_das_checagens" in exe.modelo)


class ParametrosInvalidos(Exception):
    """Os `parametros` da especificação não vieram (ou vieram num formato que a checagem não entende)."""


def _confere_tipo(valor, tipo: str) -> bool:
    """Tipos de parâmetro que as checagens pedem: texto, regex, inteiro, lista_de_texto[:n], lista_de_numeros,
    dicionario_de_texto, fontes_por_origem (origem -> lista de textos)."""
    nome, _, tamanho = tipo.partition(":")
    if nome == "texto":
        return isinstance(valor, str) and bool(valor.strip())
    if nome == "regex":
        try:
            return isinstance(valor, str) and re.compile(valor) is not None
        except re.error:
            return False
    if nome == "inteiro":
        return isinstance(valor, int) and not isinstance(valor, bool) and valor >= 0
    if nome == "lista_de_texto":
        return (isinstance(valor, list) and bool(valor) and all(isinstance(x, str) and x.strip() for x in valor)
                and (not tamanho or len(valor) == int(tamanho)))
    if nome == "lista_de_numeros":
        return isinstance(valor, list) and bool(valor) and all(isinstance(x, (int, Decimal)) and not isinstance(x, bool) for x in valor)
    if nome == "dicionario_de_texto":
        return isinstance(valor, dict) and bool(valor) and all(isinstance(k, str) and k and isinstance(v, str) for k, v in valor.items())
    if nome == "fontes_por_origem":
        return (isinstance(valor, dict) and bool(valor)
                and all(isinstance(k, str) and isinstance(v, list) and all(isinstance(x, str) for x in v) for k, v in valor.items()))
    raise ValueError(f"tipo de parâmetro desconhecido: {tipo}")


def parametros(exe, id_, **exigidos) -> dict:
    """Os `parametros` da checagem no YAML. `exigidos`: chave -> tipo (ver _confere_tipo). Faltando o bloco, uma chave ou com
    formato errado: ParametrosInvalidos (a checagem recusa, nunca aprova sem conferir)."""
    par = exe.parametros(id_)
    if not isinstance(par, dict) or not par:
        raise ParametrosInvalidos(f"a especificação não entregou os parâmetros de {id_}")
    ruins = [c for c, tipo in exigidos.items() if c not in par or not _confere_tipo(par[c], tipo)]
    if ruins:
        raise ParametrosInvalidos(f"os parâmetros de {id_} estão faltando ou em formato errado: {', '.join(ruins)}")
    return par


def texto_do_parametro(par: dict, chave: str) -> str:
    """Um parâmetro que só serve de explicação nas mensagens: o texto dele, ou vazio se não for texto."""
    return par[chave] if isinstance(par.get(chave), str) else ""


def roda(exe, id_, funcao):
    """Roda a checagem `funcao(exe)` se ela vale para esta entrega (None se não vale). Parâmetro ruim vira recusa com o motivo dito."""
    if not aplica(exe):
        return None
    try:
        return funcao(exe)
    except ParametrosInvalidos as erro:
        return [Falha(id_, "PARAMETROS_INVALIDOS", "contexto.modelo.parametros_das_checagens", f"{erro}. Quem monta o contexto deve entregar os parâmetros do YAML do tipo.")]


PARAMETROS_DAS_FONTES = {"fontes_por_origem": "fontes_por_origem"}


def prefixos_de_fonte(exe) -> dict:
    """{origem: [prefixos de id de fonte importada]} lido de `fontes_por_origem` da CHK-CALCULO-02.

    O YAML escreve "FON-PEDIDO-<card> (pedido original)": o prefixo é o que vem antes do "<". Origem sem prefixo escrito
    (FONTE_CITADA: "fonte importada aprovada que veio no pacote") fica com lista vazia.
    """
    saida = {}
    for origem, itens in parametros(exe, "CHK-CALCULO-02", **PARAMETROS_DAS_FONTES)["fontes_por_origem"].items():
        saida[origem] = [m.group(1) for m in (re.match(r"\s*(FON-[A-Z]+-)<", i) for i in itens) if m]
    return saida


def prefixo_do_pedido(exe) -> str | None:
    """O prefixo da fonte do pedido original (a linha da DADO_DO_FUNDADOR que diz "pedido original")."""
    itens = parametros(exe, "CHK-CALCULO-02", **PARAMETROS_DAS_FONTES)["fontes_por_origem"].get("DADO_DO_FUNDADOR") or []
    for i in itens:
        m = re.match(r"\s*(FON-[A-Z]+-)<.*pedido original", i)
        if m:
            return m.group(1)
    return None


# ---------------------------------------------------------------------------------------
# Números escritos em português
# ---------------------------------------------------------------------------------------
_AGRUPADO = re.compile(r"^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$")  # 1.234,56  1234,5  12  (milhar com ponto, decimal com vírgula)
_PONTO_DECIMAL = re.compile(r"^\d+\.\d+$")  # 0.5 (só quando não é milhar)


def numero_do_texto(token: str) -> Decimal | None:
    """Lê um número escrito como no texto do Caio: milhar com ponto e decimal com vírgula ("1.234,56", "0,50", "70").
    Aceita também "0.5" (ponto decimal) quando não dá para ser milhar. Devolve None se não for um número claro."""
    t = (token or "").strip()
    if _AGRUPADO.match(t):
        return Decimal(t.replace(".", "").replace(",", "."))
    if _PONTO_DECIMAL.match(t):
        return Decimal(t)
    return None


# Palavras de número do português (uma tabela do IDIOMA, não regra de negócio). Servem para "cem dólares", "dez por cento".
_PEQUENOS = {
    "zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8,
    "nove": 9, "dez": 10, "onze": 11, "doze": 12, "treze": 13, "catorze": 14, "quatorze": 14, "quinze": 15, "dezesseis": 16,
    "dezessete": 17, "dezoito": 18, "dezenove": 19, "vinte": 20, "trinta": 30, "quarenta": 40, "cinquenta": 50,
    "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90, "cem": 100, "cento": 100, "duzentos": 200, "duzentas": 200,
    "trezentos": 300, "trezentas": 300, "quatrocentos": 400, "quatrocentas": 400, "quinhentos": 500, "quinhentas": 500,
    "seiscentos": 600, "seiscentas": 600, "setecentos": 700, "setecentas": 700, "oitocentos": 800, "oitocentas": 800,
    "novecentos": 900, "novecentas": 900,
}
_GRANDES = {"mil": 1000, "milhao": 1_000_000, "milhoes": 1_000_000}
PALAVRAS_DE_NUMERO = set(_PEQUENOS) | set(_GRANDES)


def numero_por_extenso(palavras: list) -> Decimal | None:
    """["dois", "mil", "e", "quinhentos"] -> 2500. Devolve None se a sequência não for um número."""
    total = atual = 0
    visto = False
    for p in palavras:
        if p == "e":
            continue
        if p in _PEQUENOS:
            atual += _PEQUENOS[p]
            visto = True
        elif p in _GRANDES:
            total += (atual or 1) * _GRANDES[p]
            atual = 0
            visto = True
        else:
            return None
    return Decimal(total + atual) if visto else None


# ---------------------------------------------------------------------------------------
# Achar termos num texto (sem diferenciar maiúscula nem acento)
# ---------------------------------------------------------------------------------------
def em(chave, colecao) -> bool:
    """`chave in colecao` que não quebra quando a chave veio como lista ou objeto (entrega estranha)."""
    return isinstance(chave, str) and chave in colecao


def achar_termo(texto_dobrado: str, termo: str) -> bool:
    """O termo (dobrado também) aparece como palavra inteira ou expressão inteira no texto já dobrado?"""
    t = T.dobrar(termo).strip()
    if not t:
        return False
    padrao = r"(?<![a-z0-9])" + r"\s+".join(re.escape(p) for p in t.split()) + r"(?![a-z0-9])"
    return re.search(padrao, texto_dobrado) is not None


def achar_sigla(texto: str, sigla: str) -> bool:
    """A sigla aparece em MAIÚSCULAS e como palavra inteira ('DAS' conta; 'das' não)?"""
    letras = "".join(T.dobrar(c).upper() if c.isupper() else c for c in T.normalizar(texto))
    return re.search(r"(?<![\w])" + re.escape(sigla) + r"(?![\w])", letras) is not None


# ---------------------------------------------------------------------------------------
# Ler a entrega do Caio
# ---------------------------------------------------------------------------------------
@dataclass
class Entrada:
    caminho: str
    id: object
    o_que: object
    valor_obj: object       # o objeto {valor, unidade, origem, ref, citacao, data_da_fonte} (ou o que veio no lugar)
    valor: Decimal | None   # o número lido de valor_obj["valor"]
    unidade: str
    origem: object
    ref: object
    citacao: object
    data: object


@dataclass
class Conta:
    caminho: str
    id: object
    o_que: object
    expressao: object
    resultado_obj: object
    resultado: Decimal | None
    unidade: str
    natureza: object


@dataclass
class Modelo:
    entrega: dict
    entradas: list = field(default_factory=list)
    contas: list = field(default_factory=list)
    principal: list = field(default_factory=list)       # [(caminho, dict)]
    cenarios: list = field(default_factory=list)        # [(caminho, dict)]
    premissas: list = field(default_factory=list)       # [(caminho, dict)]
    malformadas: list = field(default_factory=list)     # caminhos de linhas que nem são objetos

    def entrada(self, id_):
        return next((e for e in self.entradas if e.id == id_), None)

    def conta(self, id_):
        return next((c for c in self.contas if c.id == id_), None)

    def ids_de_entrada(self) -> set:
        return {e.id for e in self.entradas if isinstance(e.id, str)}


def _texto(v) -> str:
    return v if isinstance(v, str) else ""


def so_texto(v):
    """O valor se for texto; senão None. Usado em campos que viram chave de busca (origem, natureza, conta...): lista ou objeto no
    lugar de texto é entrega estranha e não pode quebrar a checagem."""
    return v if isinstance(v, str) else None


def carregar(exe) -> Modelo:
    """A entrega do Caio lida por seções (uma vez por execução). Campo fora do lugar vira vazio: quem recusa o formato é a CHK-COMUM-01."""
    return exe.memo("spec_calculo_modelo", lambda: _carregar(exe.acao_obj["entrega"]))


def _linhas(entrega: dict, secao: str, malformadas: list) -> list:
    v = entrega.get(secao)
    if not isinstance(v, list):
        return []
    saida = []
    for i, x in enumerate(v):
        if isinstance(x, dict):
            saida.append((f"entrega.{secao}[{i}]", x))
        else:
            malformadas.append(f"entrega.{secao}[{i}]")
    return saida


def _carregar(entrega: dict) -> Modelo:
    m = Modelo(entrega)
    for cam, d in _linhas(entrega, "entradas", m.malformadas):
        v = d.get("valor")
        o = v if isinstance(v, dict) else {}
        m.entradas.append(Entrada(cam, d.get("id"), d.get("o_que"), v, para_decimal(o.get("valor")), _texto(o.get("unidade")),
                                  so_texto(o.get("origem")), o.get("ref"), o.get("citacao"), o.get("data_da_fonte")))
    for cam, d in _linhas(entrega, "contas", m.malformadas):
        r = d.get("resultado")
        o = r if isinstance(r, dict) else {}
        m.contas.append(Conta(cam, d.get("id"), d.get("o_que"), d.get("expressao"), r, para_decimal(o.get("valor")),
                              _texto(o.get("unidade")), so_texto(d.get("natureza"))))
    m.principal = _linhas(entrega, "resultado_principal", m.malformadas)
    m.cenarios = _linhas(entrega, "cenarios", m.malformadas)
    m.premissas = _linhas(entrega, "premissas_a_confirmar", m.malformadas)
    return m


def textos_do_campo(entrega: dict, campo: str) -> list:
    """[(caminho, texto)] de um campo escrito como a especificação escreve: 'leitura', 'riscos' ou 'tabela.coluna'."""
    secao, _, coluna = campo.partition(".")
    v = entrega.get(secao)
    saida = []
    if coluna:
        for i, linha in enumerate(v if isinstance(v, list) else []):
            if isinstance(linha, dict) and isinstance(linha.get(coluna), str):
                saida.append((f"entrega.{secao}[{i}].{coluna}", linha[coluna]))
    elif isinstance(v, str):
        saida.append((f"entrega.{secao}", v))
    elif isinstance(v, list):
        saida += [(f"entrega.{secao}[{i}]", x) for i, x in enumerate(v) if isinstance(x, str)]
    return saida


# ---------------------------------------------------------------------------------------
# Refazer as contas (frações exatas, sem eval)
# ---------------------------------------------------------------------------------------
# Por que não usar validador/expressao.py: ele recusa (NAO_EXATO) a conta que multiplica um quociente (216,666... x 70),
# e é exatamente o que a especificação manda fazer ("o exato calculado pelo código, nunca o arredondado escrito").
# Aqui a conta é feita com frações (Fraction): exata em qualquer sequência de + - x ÷. Reaproveita de expressao.py a classe
# de erro e os limites de tamanho. A expressão já chega quebrada em pedaços permitidos: ids, inteiros e + - × ÷ ( ).
_PEDACO = re.compile(r"\s*(?:([A-Za-z_][A-Za-z0-9_]*)|(\d+)|([+\-×÷()])|(\S))")
_MAX_BITS = 20_000  # uma conta que cresce além disso é recusada (ninguém precisa de um número assim)


def pedacos_da_expressao(expressao) -> list:
    """Quebra a expressão em [(tipo, texto)] com tipo 'id', 'num', 'op' ou 'estranho' (caractere que não é de conta)."""
    saida, pos, s = [], 0, expressao if isinstance(expressao, str) else ""
    while pos < len(s):
        if not s[pos:].strip():
            break
        m = _PEDACO.match(s, pos)
        for tipo, grupo in zip(("id", "num", "op", "estranho"), m.groups()):
            if grupo is not None:
                saida.append((tipo, grupo))
        pos = m.end()
    return saida


def ids_da_expressao(expressao) -> set:
    return {t for k, t in pedacos_da_expressao(expressao) if k == "id"}


def como_decimal(f: Fraction, casas: int = 4) -> Decimal:
    """A fração como Decimal com `casas` casas (só para mostrar nas mensagens; a conta continua em fração)."""
    with localcontext() as ctx:
        ctx.prec = 80
        return (Decimal(f.numerator) / Decimal(f.denominator)).quantize(Decimal(1).scaleb(-casas))


def casa_da_tolerancia(texto_do_numero) -> Fraction:
    """Meia unidade da última casa decimal escrita (216,67 -> 0,005; 409,5 -> 0,05; 10 -> 0,5)."""
    return Fraction(1, 2) / (Fraction(10) ** casas_decimais(texto_do_numero))


def bate(exato, declarado: Decimal, maximo_relativo_pct=5) -> bool:
    """Arredondamento limitado pela última casa escrita e pelo erro relativo da especificação."""
    diferenca = abs(exato - Fraction(declarado))
    return diferenca <= casa_da_tolerancia(declarado) and (exato == 0 and diferenca == 0 or exato != 0 and diferenca <= abs(exato) * maximo_relativo_pct / 100)


class _Contador:
    """Lê os pedaços de uma conta com a precedência de sempre (× ÷ antes de + -) e calcula em frações."""

    def __init__(self, pedacos, nomes):
        self.p, self.nomes, self.i, self.nivel = pedacos, nomes, 0, 0

    def _ver(self):
        return self.p[self.i][1] if self.i < len(self.p) else None

    def _confere(self, v: Fraction) -> Fraction:
        if v.numerator.bit_length() > _MAX_BITS or v.denominator.bit_length() > _MAX_BITS:
            raise ErroDeExpressao("GRANDE_DEMAIS", "A conta dá um número grande demais.")
        return v

    def _descer(self):
        self.nivel += 1
        if self.nivel > MAX_PROFUNDIDADE:
            raise ErroDeExpressao("PROFUNDO_DEMAIS", "A conta tem parênteses demais, um dentro do outro.")

    def expressao(self) -> Fraction:
        self._descer()
        v = self.termo()
        while self._ver() in ("+", "-"):
            op = self._ver()
            self.i += 1
            d = self.termo()
            v = self._confere(v + d if op == "+" else v - d)
        self.nivel -= 1
        return v

    def termo(self) -> Fraction:
        v = self.unario()
        while self._ver() in ("×", "÷"):
            op = self._ver()
            self.i += 1
            d = self.unario()
            if op == "×":
                v = self._confere(v * d)
            else:
                if d == 0:
                    raise ErroDeExpressao("DIVISAO_POR_ZERO", "A conta divide por zero.")
                v = self._confere(v / d)
        return v

    def unario(self) -> Fraction:
        if self._ver() in ("-", "+"):
            sinal = self._ver()
            self.i += 1
            self._descer()
            v = self.unario()
            self.nivel -= 1
            return -v if sinal == "-" else v
        return self.atomo()

    def atomo(self) -> Fraction:
        if self.i >= len(self.p):
            raise ErroDeExpressao("SINTAXE", "A conta está incompleta (faltou um número ou id no fim).")
        tipo, t = self.p[self.i]
        self.i += 1
        if tipo == "num":
            return Fraction(int(t))
        if tipo == "id":
            return self.nomes[t]
        if t == "(":
            v = self.expressao()
            if self._ver() != ")":
                raise ErroDeExpressao("SINTAXE", "Falta fechar um parêntese na conta.")
            self.i += 1
            return v
        raise ErroDeExpressao("SINTAXE", "A conta tem um operador em lugar errado ou está incompleta.")


def avaliar_exato(pedacos, nomes: dict) -> Fraction:
    """Calcula a conta em frações. `nomes`: id -> Fraction. Levanta ErroDeExpressao (sintaxe, divisão por zero, grande demais)."""
    if len(pedacos) > MAX_ELEMENTOS:
        raise ErroDeExpressao("MUITOS_ELEMENTOS", f"A conta tem mais de {MAX_ELEMENTOS} elementos.")
    leitor = _Contador(pedacos, nomes)
    v = leitor.expressao()
    if leitor.i != len(pedacos):
        raise ErroDeExpressao("SINTAXE", "Sobrou parte da conta que não faz sentido (falta um operador?).")
    return v


def refazer(modelo: Modelo, constantes, valores: dict) -> tuple:
    """Refaz TODAS as contas, na ordem, com os valores EXATOS das entradas (`valores`: id -> Decimal) e das contas anteriores.

    Devolve (exatos, erros): exatos[id da conta] = Fraction; erros[id da conta] = (motivo, mensagem, trecho). Conta que depende
    de outra com erro não entra em nenhum dos dois (o erro já foi dito na conta de origem).
    """
    aceitas = {Fraction(Decimal(c)) for c in constantes}
    nomes = {k: Fraction(v) for k, v in valores.items() if v is not None}
    entradas_invalidas = {e.id for e in modelo.entradas if isinstance(e.id, str) and valores.get(e.id) is None}
    exatos, erros, pulados = {}, {}, set()
    for c in modelo.contas:
        if not isinstance(c.id, str):
            continue
        cid, expr = c.id, c.expressao
        if not isinstance(expr, str) or not expr.strip():
            erros[cid] = ("EXPRESSAO_VAZIA", f"A conta {cid} não traz a expressão.", "")
            pulados.add(cid)
            continue
        if len(expr) > MAX_TAMANHO:
            erros[cid] = ("EXPRESSAO_LONGA", f"A conta {cid} passa de {MAX_TAMANHO} caracteres.", T.cortar(expr))
            pulados.add(cid)
            continue
        pedacos, erro = pedacos_da_expressao(expr), None
        for tipo, t in pedacos:
            if tipo == "estranho":
                erro = ("TOKEN_NAO_ACEITO", f"A conta {cid} usa '{t}', que não é permitido. Só vale id de entrada ou de conta anterior, as constantes da especificação e + - × ÷ ( ).")
            elif tipo == "id" and t in pulados:
                erro = ("DEPENDE_DE_CONTA_COM_ERRO", None)
            elif tipo == "id" and t in entradas_invalidas:
                erro = ("DEPENDE_DE_ENTRADA_SEM_VALOR", f"A conta {cid} usa a entrada {t}, que não tem um valor que dê para ler.")
            elif tipo == "id" and t not in nomes:
                erro = ("ID_DESCONHECIDO", f"A conta {cid} usa '{t}', que não é uma entrada nem uma conta anterior (id menor).")
            elif tipo == "num" and Fraction(int(t)) not in aceitas:
                erro = ("CONSTANTE_NAO_ACEITA", f"A conta {cid} tem o número {t} escrito dentro dela. Só valem as constantes {', '.join(str(int(k)) for k in sorted(aceitas))}; qualquer outro número entra como entrada com origem.")
            if erro:
                break
        if not erro:
            try:
                exatos[cid] = nomes[cid] = avaliar_exato(pedacos, nomes)
                continue
            except ErroDeExpressao as ex:
                erro = (ex.codigo, f"Conta {cid}: {ex.mensagem}")
        pulados.add(cid)
        if erro[1] is not None:  # sem mensagem = a causa já foi dita na conta de origem
            erros[cid] = (erro[0], erro[1], T.cortar(expr))
    return exatos, erros


def valores_das_entradas(modelo: Modelo) -> dict:
    """id da entrada -> Decimal (a primeira com aquele id vale; id repetido é dito pela CHK-CALCULO-01)."""
    saida = {}
    for e in modelo.entradas:
        if isinstance(e.id, str) and e.id not in saida:
            saida[e.id] = e.valor
    return saida


def contas_refeitas(exe, modelo: Modelo) -> tuple:
    """As contas refeitas com as entradas como estão (cenário BASE), uma vez por execução."""
    par = parametros(exe, "CHK-CALCULO-04", constantes_aceitas="lista_de_numeros")
    return exe.memo("spec_calculo_contas_refeitas", lambda: refazer(modelo, par["constantes_aceitas"], valores_das_entradas(modelo)))


def dependencias(modelo: Modelo) -> dict:
    """id da conta -> ids das ENTRADAS de que ela depende, direta ou indiretamente (pelas contas anteriores também)."""
    entradas = modelo.ids_de_entrada()
    saida = {}
    for c in modelo.contas:
        if not isinstance(c.id, str):
            continue
        usados = ids_da_expressao(c.expressao)
        saida[c.id] = {u for u in usados if u in entradas} | {d for u in usados if u in saida for d in saida[u]}
    return saida
