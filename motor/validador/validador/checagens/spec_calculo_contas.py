"""Checagens do modelo de cálculo do Caio sobre as CONTAS (K1 a K12) e os cenários:

CHK-CALCULO-04  contas refeitas: o código avalia cada expressão em decimal exato e o resultado declarado tem de bater.
CHK-CALCULO-05  moeda coerente: só soma moeda com a mesma moeda; trocar de moeda só multiplicando ou dividindo por câmbio.
CHK-CALCULO-06  três cenários refeitos e em ordem pelo sentido do resultado principal.
CHK-CALCULO-08  previsão separada do realizado: conta com premissa na cadeia é PREVISTO.

De onde vem: helena-v2/deliverables/calculo.yaml (cada CHK, com seus `parametros`). Os números e as listas são lidos de lá
(exe.parametros); este arquivo só sabe COMO conferir. Como mudar uma regra: mude o `parametros` no YAML do tipo.
A leitura da entrega, o avaliador de contas e as peças comuns estão em spec_calculo_base.py.
"""
import re
from decimal import Decimal

from .. import texto as T
from ..registro import checagem
from ..resultado import Falha
from . import spec_calculo_base as B
from .spec_calculo_entradas import tipo_da_unidade

ID4, ID5, ID6, ID8 = "CHK-CALCULO-04", "CHK-CALCULO-05", "CHK-CALCULO-06", "CHK-CALCULO-08"


def _rotulo(c) -> str:
    return str(c.id) if isinstance(c.id, str) else c.caminho


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-04
# ---------------------------------------------------------------------------------------
def _contas_refeitas(exe) -> list:
    par = B.parametros(exe, ID4, ids="regex", constantes_aceitas="lista_de_numeros", erro_relativo_maximo_pct="inteiro")
    padrao = re.compile(par["ids"])
    m = B.carregar(exe)
    exatos, erros = B.contas_refeitas(exe, m)
    falhas = [Falha(ID4, "CONTA_MALFORMADA", c, "Cada conta deve ser um objeto com id, o_que, expressao e resultado.") for c in m.malformadas if "contas" in c]
    vistos, ultimo = set(), None
    for c in m.contas:
        rotulo, cam = _rotulo(c), c.caminho
        if not (isinstance(c.id, str) and padrao.match(c.id)):
            falhas.append(Falha(ID4, "ID_FORA_DO_PADRAO", cam, f"O id da conta deve seguir o padrão {par['ids']} (K1 a K12).", T.cortar(str(c.id))))
        else:
            if c.id in vistos:
                falhas.append(Falha(ID4, "ID_REPETIDO", cam, f"O id {c.id} aparece em duas contas.", c.id))
            vistos.add(c.id)
            n = int(re.search(r"\d+$", c.id).group(0))
            if ultimo is not None and n <= ultimo:
                falhas.append(Falha(ID4, "IDS_FORA_DE_ORDEM", cam, f"Os ids das contas devem ir em ordem crescente (K1, K2, ...): {c.id} veio depois de K{ultimo}.", c.id))
            ultimo = n if ultimo is None else max(ultimo, n)
        if rotulo in erros:
            motivo, msg, trecho = erros[rotulo]
            falhas.append(Falha(ID4, motivo, cam + ".expressao", msg, trecho))
        resultado = c.resultado_obj
        if c.resultado is None:
            falhas.append(Falha(ID4, "SEM_RESULTADO", cam + ".resultado", f"A conta {rotulo} precisa de um resultado com valor numérico puro.", T.cortar(str(resultado))))
        else:
            if rotulo in exatos and not B.bate(exatos[rotulo], c.resultado, par["erro_relativo_maximo_pct"]):
                falhas.append(Falha(ID4, "RESULTADO_NAO_BATE", cam + ".resultado",
                                    f"A conta {rotulo} ({T.cortar(str(c.expressao))}) refeita pelo código dá {_mostrar(exatos[rotulo], c.resultado)}, mas a entrega diz {c.resultado}.",
                                    f"{c.resultado} != {_mostrar(exatos[rotulo], c.resultado)}"))
            if resultado.get("origem") != "CALCULADO":
                falhas.append(Falha(ID4, "RESULTADO_SEM_ORIGEM_CALCULADO", cam + ".resultado", f"O resultado da conta {rotulo} deve ter origem CALCULADO.", T.cortar(str(resultado.get("origem")))))
            if resultado.get("ref") != c.id:
                falhas.append(Falha(ID4, "REF_DIFERENTE_DO_ID", cam + ".resultado", f"A ref do resultado da conta {rotulo} deve ser igual ao id dela.", T.cortar(str(resultado.get("ref")))))
    return falhas


def _mostrar(exato, declarado: Decimal) -> str:
    """O exato arredondado com as casas que o declarado escreve (é o que o Caio deveria ter escrito)."""
    return str(B.como_decimal(exato, max(0, -declarado.as_tuple().exponent)))


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-05
# ---------------------------------------------------------------------------------------
class _ErroDeMoeda(Exception):
    def __init__(self, motivo, mensagem):
        super().__init__(mensagem)
        self.motivo, self.mensagem = motivo, mensagem


def _nome(t) -> str:
    if t is None:
        return "sem moeda"
    return f"{t[1]}" if t[0] == "M" else f"câmbio {t[1]} por {t[2]}"


def _somar(a, b):
    if a == b:
        return a
    if a is not None and b is not None and a[0] == "M" and b[0] == "M":
        raise _ErroDeMoeda("SOMA_DE_MOEDAS_DIFERENTES", f"soma ou subtração de {_nome(a)} com {_nome(b)}: só se soma a mesma moeda; para trocar de moeda, multiplique pelo câmbio")
    raise _ErroDeMoeda("SOMA_DE_MOEDA_COM_OUTRA_COISA", f"soma ou subtração de {_nome(a)} com {_nome(b)}: só se soma o que é da mesma moeda (ou os dois sem moeda)")


def _multiplicar(a, b):
    if a is None:
        return b
    if b is None:
        return a
    if a[0] == "M" and b[0] == "M":
        raise _ErroDeMoeda("MOEDA_VEZES_MOEDA", f"{_nome(a)} vezes {_nome(b)}: moeda vezes moeda não existe; para trocar de moeda, multiplique pelo câmbio")
    if a[0] == "C" and b[0] == "C":
        raise _ErroDeMoeda("CAMBIO_VEZES_CAMBIO", "câmbio vezes câmbio não tem sentido")
    moeda, cambio = (a, b) if a[0] == "M" else (b, a)
    if moeda[1] != cambio[2]:
        raise _ErroDeMoeda("CAMBIO_NO_SENTIDO_ERRADO", f"{_nome(moeda)} vezes {_nome(cambio)}: o câmbio converte de {cambio[2]} para {cambio[1]}, não de {moeda[1]}")
    return ("M", cambio[1])


def _dividir(a, b):
    if b is None:
        return a
    if a is None:
        raise _ErroDeMoeda("SEM_MOEDA_DIVIDIDO_POR_MOEDA", f"{_nome(a)} dividido por {_nome(b)}: dividir um número sem moeda por moeda não dá moeda")
    if a[0] == "M" and b[0] == "M":
        if a[1] == b[1]:
            return None
        raise _ErroDeMoeda("DIVISAO_DE_MOEDAS_DIFERENTES", f"{_nome(a)} dividido por {_nome(b)}: para trocar de moeda, divida pelo câmbio")
    if a[0] == "M" and b[0] == "C":
        if a[1] != b[1]:
            raise _ErroDeMoeda("CAMBIO_NO_SENTIDO_ERRADO", f"{_nome(a)} dividido por {_nome(b)}: o câmbio só divide valores em {b[1]}")
        return ("M", b[2])
    raise _ErroDeMoeda("DIVISAO_SEM_SENTIDO_DE_MOEDA", f"{_nome(a)} dividido por {_nome(b)} não tem sentido")


class _LeitorDeTipos:
    """Percorre a expressão com a precedência de sempre (× ÷ antes de + -) e calcula o tipo de moeda de cada pedaço."""

    def __init__(self, pedacos, tipos):
        self.p = [t for _, t in pedacos]
        self.i = 0
        self.tipos = tipos

    def _ver(self):
        return self.p[self.i] if self.i < len(self.p) else None

    def expressao(self):
        v = self.termo()
        while self._ver() in ("+", "-"):
            self.i += 1
            v = _somar(v, self.termo())
        return v

    def termo(self):
        v = self.unario()
        while self._ver() in ("×", "÷"):
            op = self.p[self.i]
            self.i += 1
            d = self.unario()
            v = _multiplicar(v, d) if op == "×" else _dividir(v, d)
        return v

    def unario(self):
        if self._ver() in ("-", "+"):
            self.i += 1
            return self.unario()
        return self.atomo()

    def atomo(self):
        t = self._ver()
        self.i += 1
        if t == "(":
            v = self.expressao()
            self.i += 1  # ")"
            return v
        return self.tipos.get(t)  # id: o tipo dele; número: sem moeda


def _moeda_coerente(exe) -> list:
    par = B.parametros(exe, ID5)
    moedas = B.parametros(exe, "CHK-CALCULO-03", moedas="dicionario_de_texto")["moedas"]  # as moedas e seus símbolos moram na CHK-CALCULO-03
    m = B.carregar(exe)
    falhas, tipos = [], {}
    for e in m.entradas:
        t = tipo_da_unidade(e.unidade, moedas)
        if t == "ERRO":
            falhas.append(Falha(ID5, "UNIDADE_COM_MOEDAS_CONFUSAS", e.caminho + ".valor",
                                f"A unidade da entrada {e.id} ({e.unidade!r}) tem duas moedas que não seguem '<moeda> por <moeda>'. {B.texto_do_parametro(par, 'moeda_da_unidade')}", T.cortar(e.unidade)))
        elif isinstance(e.id, str):
            tipos.setdefault(e.id, t)
    for c in m.contas:
        declarado = tipo_da_unidade(c.unidade, moedas)
        if declarado == "ERRO":
            falhas.append(Falha(ID5, "UNIDADE_COM_MOEDAS_CONFUSAS", c.caminho + ".resultado", f"A unidade da conta {_rotulo(c)} ({c.unidade!r}) tem duas moedas que não seguem '<moeda> por <moeda>'.", T.cortar(c.unidade)))
            continue
        calculado = "?"
        pedacos = B.pedacos_da_expressao(c.expressao)
        if pedacos and all(k != "estranho" for k, _ in pedacos) and all(t in tipos for k, t in pedacos if k == "id"):
            try:
                calculado = _LeitorDeTipos(pedacos, tipos).expressao()
            except _ErroDeMoeda as ex:
                falhas.append(Falha(ID5, ex.motivo, c.caminho + ".expressao", f"Conta {_rotulo(c)}: {ex.mensagem}.", T.cortar(str(c.expressao))))
            if calculado != "?" and calculado != declarado:
                falhas.append(Falha(ID5, "MOEDA_DA_CONTA_DIFERENTE_DA_UNIDADE", c.caminho + ".resultado",
                                    f"A conta {_rotulo(c)} dá {_nome(calculado)}, mas a unidade declarada ({c.unidade!r}) é {_nome(declarado)}.", T.cortar(c.unidade)))
        if isinstance(c.id, str):
            tipos.setdefault(c.id, declarado)  # as contas seguintes partem da moeda declarada (um erro não se repete em cadeia)
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-06
# ---------------------------------------------------------------------------------------
_AJUSTE = re.compile(r"^\s*([A-Za-z_]\w*)\s*=\s*(\S+)\s*$")


def _ler_ajustes(texto, m):
    """(ajustes {id: Decimal}, [(motivo, mensagem)]) de um texto como 'V4 = 50; V2 = 3' ('—' = nenhum)."""
    if not isinstance(texto, str):
        return {}, [("AJUSTE_MAL_ESCRITO", "A coluna ajustes deve ser texto: '—' ou 'Vn = número; ...'.")]
    if texto.strip() in B.SEM_AJUSTE:
        return {}, []
    ajustes, erros = {}, []
    for parte in texto.split(";"):
        mm = _AJUSTE.match(parte)
        valor = B.numero_do_texto(mm.group(2).lstrip("+-")) if mm else None
        if valor is not None and mm.group(2).startswith("-"):
            valor = -valor
        if not mm or valor is None:
            erros.append(("AJUSTE_MAL_ESCRITO", f"Não entendi o ajuste {parte.strip()!r}: escreva 'Vn = número', separados por ponto e vírgula."))
            continue
        id_ = mm.group(1)
        entrada = m.entrada(id_)
        if entrada is None or entrada.origem != "PREMISSA":
            erros.append(("AJUSTE_FORA_DA_PREMISSA", f"O cenário muda {id_}, que não é uma entrada de origem PREMISSA: só premissa muda de um cenário para outro."))
        elif id_ in ajustes:
            erros.append(("AJUSTE_REPETIDO", f"O ajuste de {id_} aparece duas vezes na mesma linha."))
        elif entrada.valor is not None and valor == entrada.valor:
            erros.append(("AJUSTE_IGUAL_AO_VALOR", f"O ajuste {id_} = {mm.group(2)} é igual ao valor da tabela de entradas: um ajuste tem de mudar o valor."))
        else:
            ajustes[id_] = valor
    return ajustes, erros


def _cenarios_refeitos(exe) -> list:
    par = B.parametros(exe, ID6, cenarios="lista_de_texto:3", sentidos="lista_de_texto:2")
    nomes, sentidos = list(par["cenarios"]), list(par["sentidos"])
    conservador, base, otimista = nomes[0], nomes[1], nomes[2]  # a ordem da lista na especificação: CONSERVADOR, BASE, OTIMISTA
    m = B.carregar(exe)
    regra_das_contas = B.parametros(exe, "CHK-CALCULO-04", constantes_aceitas="lista_de_numeros", erro_relativo_maximo_pct="inteiro")
    constantes = regra_das_contas["constantes_aceitas"]
    falhas = []

    # ---- resultado principal
    sentido_de = {}
    for cam, linha in m.principal:
        conta, sentido = B.so_texto(linha.get("conta")), B.so_texto(linha.get("sentido"))
        if not isinstance(conta, str) or m.conta(conta) is None:
            falhas.append(Falha(ID6, "PRINCIPAL_CONTA_DESCONHECIDA", cam, f"O resultado principal aponta para {T.cortar(str(conta))!r}, que não é uma conta da tabela de contas.", T.cortar(str(conta))))
            continue
        if conta in sentido_de:
            falhas.append(Falha(ID6, "PRINCIPAL_CONTA_REPETIDA", cam, f"A conta {conta} aparece duas vezes no resultado principal.", conta))
            continue
        if sentido not in sentidos:
            falhas.append(Falha(ID6, "SENTIDO_INVALIDO", cam, f"O sentido deve ser um destes: {', '.join(sentidos)}.", T.cortar(str(sentido))))
        sentido_de[conta] = sentido

    # ---- as linhas de cenário, por conta e por cenário
    por_conta, ajustes_do_cenario = {}, {}
    for cam, linha in m.cenarios:
        cenario, conta = B.so_texto(linha.get("cenario")), B.so_texto(linha.get("conta"))
        if cenario not in nomes:
            falhas.append(Falha(ID6, "CENARIO_INVALIDO", cam, f"O cenário deve ser um destes: {', '.join(nomes)}.", T.cortar(str(cenario))))
            continue
        if conta not in sentido_de:
            falhas.append(Falha(ID6, "CONTA_FORA_DO_PRINCIPAL", cam, f"A conta {T.cortar(str(conta))!r} não está no resultado principal: cenário só para as contas do resultado principal.", T.cortar(str(conta))))
            continue
        if cenario in por_conta.setdefault(conta, {}):
            falhas.append(Falha(ID6, "CENARIO_REPETIDO", cam, f"A conta {conta} tem duas linhas do cenário {cenario}: tem de ser exatamente uma de cada.", cenario))
            continue
        por_conta[conta][cenario] = (cam, linha)
    for conta in sentido_de:
        for n in nomes:
            if n not in por_conta.get(conta, {}):
                falhas.append(Falha(ID6, "CENARIO_FALTANDO", "entrega.cenarios", f"Falta a linha {n} da conta {conta}: cada conta do resultado principal tem um cenário de cada.", f"{conta}/{n}"))

    # ---- ajustes, resultado refeito e referência de cada linha
    exatos_base, _ = B.contas_refeitas(exe, m)
    valores_base = B.valores_das_entradas(m)
    refeitos = {}  # (conta, cenario) -> Decimal exato
    for conta, linhas in por_conta.items():
        for cenario, (cam, linha) in linhas.items():
            if cenario == base:  # o BASE é a conta como está: qualquer ajuste, certo ou errado, é defeito
                escrito = linha.get("ajustes")
                ajustes, erros = {}, ([] if isinstance(escrito, str) and escrito.strip() in B.SEM_AJUSTE
                                      else [("AJUSTE_NO_BASE", "O cenário BASE não muda nada: escreva '—' nos ajustes.")])
            else:
                ajustes, erros = _ler_ajustes(linha.get("ajustes"), m)
            for motivo, msg in erros:
                falhas.append(Falha(ID6, motivo, cam + ".ajustes", msg, T.cortar(str(linha.get("ajustes")))))
            if not erros:
                previa = ajustes_do_cenario.setdefault(cenario, (cam, ajustes))
                if previa[1] != ajustes:
                    falhas.append(Falha(ID6, "AJUSTES_DIFERENTES_ENTRE_CONTAS", cam + ".ajustes",
                                        f"Os ajustes do cenário {cenario} da conta {conta} diferem dos de outra conta ({previa[0]}): num cenário todas as contas mudam as mesmas premissas.", T.cortar(str(linha.get("ajustes")))))
                valores = {**valores_base, **ajustes}
                exatos, erros_da_conta = B.refazer(m, constantes, valores) if ajustes else (exatos_base, {})
                if conta in exatos:
                    refeitos[(conta, cenario)] = exatos[conta]
                else:
                    detalhe = erros_da_conta.get(conta, ("DEPENDE_DE_CONTA_COM_ERRO", "A conta não pôde ser refeita.", ""))
                    falhas.append(Falha(ID6, "CONTA_DO_CENARIO_INVALIDA", cam + ".resultado",
                                        f"O código não conseguiu refazer {conta} no cenário {cenario}: {detalhe[1] or detalhe[0]}", conta))
            r = linha.get("resultado")
            declarado = B.para_decimal(r.get("valor")) if isinstance(r, dict) else None
            if declarado is None:
                falhas.append(Falha(ID6, "CENARIO_SEM_RESULTADO", cam + ".resultado", f"A linha {conta}/{cenario} precisa de um resultado com valor numérico puro.", T.cortar(str(r))))
                continue
            if r.get("origem") != "CALCULADO" or r.get("ref") != f"{conta}/{cenario}":
                falhas.append(Falha(ID6, "REF_DO_CENARIO", cam + ".resultado", f"O resultado deve ter origem CALCULADO e ref '{conta}/{cenario}'.", T.cortar(str(r.get("ref")))))
            if (conta, cenario) in refeitos and not B.bate(refeitos[(conta, cenario)], declarado, regra_das_contas["erro_relativo_maximo_pct"]):
                falhas.append(Falha(ID6, "RESULTADO_DO_CENARIO_NAO_BATE", cam + ".resultado",
                                    f"O código refez {conta} no cenário {cenario} e deu {_mostrar(refeitos[(conta, cenario)], declarado)}, mas a entrega diz {declarado}.",
                                    f"{declarado} != {_mostrar(refeitos[(conta, cenario)], declarado)}"))
            if cenario == base:
                conta_obj = m.conta(conta)
                if conta_obj is not None and conta_obj.resultado is not None and declarado != conta_obj.resultado:
                    falhas.append(Falha(ID6, "BASE_DIFERENTE_DA_CONTA", cam + ".resultado",
                                        f"O cenário BASE de {conta} diz {declarado}, mas a conta diz {conta_obj.resultado}: o BASE é o resultado da conta.", f"{declarado} != {conta_obj.resultado}"))

    # ---- pelo menos um ajuste em CONSERVADOR ou OTIMISTA
    if por_conta and not ajustes_do_cenario.get(conservador, (None, {}))[1] and not ajustes_do_cenario.get(otimista, (None, {}))[1] \
            and all(n in ajustes_do_cenario for n in (conservador, otimista)):
        falhas.append(Falha(ID6, "NENHUM_AJUSTE", "entrega.cenarios", f"{conservador} e {otimista} não mudam nenhuma premissa: um dos dois muda ao menos uma."))

    # ---- ordem pelo sentido
    for conta, sentido in sentido_de.items():
        c, b, o = (refeitos.get((conta, n)) for n in (conservador, base, otimista))
        if None in (c, b, o) or sentido not in sentidos:
            continue
        maior_e_melhor = sentido == sentidos[0]
        ordem_ok = (c <= b <= o) if maior_e_melhor else (c >= b >= o)
        if not ordem_ok:
            falhas.append(Falha(ID6, "ORDEM_DOS_CENARIOS", "entrega.cenarios",
                                f"Em {conta} ({sentido}) o código refez {conservador}={B.como_decimal(c)}, {base}={B.como_decimal(b)}, {otimista}={B.como_decimal(o)}: " + B.texto_do_parametro(par, "ordem"),
                                f"{conta}: {B.como_decimal(c, 2)}, {B.como_decimal(b, 2)}, {B.como_decimal(o, 2)}"))
        elif c == o:
            falhas.append(Falha(ID6, "CONSERVADOR_IGUAL_AO_OTIMISTA", "entrega.cenarios", f"Em {conta} os cenários {conservador} e {otimista} dão o mesmo resultado: a faixa não mostra nenhuma incerteza.", conta))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-08
# ---------------------------------------------------------------------------------------
def _previsao_separada(exe) -> list:
    """Natureza de cada conta: PREVISTO ou REALIZADO, e REALIZADO só sem premissa na cadeia.
    "Resultado de cenário é sempre previsão" vale por construção: a linha de cenário não tem coluna de natureza, então não há o que conferir."""
    par = B.parametros(exe, ID8, naturezas="lista_de_texto:2")
    previsto, realizado = par["naturezas"][0], par["naturezas"][1]  # na especificação: [PREVISTO, REALIZADO]
    m = B.carregar(exe)
    depende = B.dependencias(m)
    premissas = {e.id for e in m.entradas if e.origem == "PREMISSA" and isinstance(e.id, str)}
    falhas = []
    for c in m.contas:
        if c.natureza not in par["naturezas"]:
            falhas.append(Falha(ID8, "NATUREZA_INVALIDA", c.caminho, f"A natureza da conta {_rotulo(c)} deve ser {' ou '.join(par['naturezas'])}.", T.cortar(str(c.natureza))))
        elif c.natureza == realizado and isinstance(c.id, str) and depende.get(c.id, set()) & premissas:
            usadas = sorted(depende[c.id] & premissas)
            falhas.append(Falha(ID8, "REALIZADO_COM_PREMISSA", c.caminho + ".natureza",
                                f"A conta {c.id} é {realizado}, mas depende de premissa ({', '.join(usadas)}): o que depende de suposição é {previsto}.", f"{c.id}: {', '.join(usadas)}"))
    return falhas


# ---------------------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------------------
@checagem(ID4, "Calculo: o código refaz cada conta e ela bate",
          "Uma conta com resultado errado, constante escondida ou id fora de ordem chegava ao fundador como número do Caio.",
          ["K-8", "C-9"])
def contas_refeitas(exe):
    return B.roda(exe, ID4, _contas_refeitas)


@checagem(ID5, "Calculo: moeda coerente nas contas",
          "Somar dólar com real, ou trocar de moeda sem câmbio, dava um número sem sentido que parecia uma conta certa.",
          ["K-8", "C-9"])
def moeda_coerente(exe):
    return B.roda(exe, ID5, _moeda_coerente)


@checagem(ID6, "Calculo: três cenários refeitos e em ordem",
          "Cenários com resultado que não sai das premissas, que mudam dado do fundador ou fora de ordem escondiam a incerteza.",
          ["K-8", "M-16"])
def cenarios_refeitos(exe):
    return B.roda(exe, ID6, _cenarios_refeitos)


@checagem(ID8, "Calculo: previsão separada do realizado",
          "Um número que depende de suposição podia ser mostrado como dinheiro que já aconteceu.",
          ["C-13", "M-16"])
def previsao_separada(exe):
    return B.roda(exe, ID8, _previsao_separada)
