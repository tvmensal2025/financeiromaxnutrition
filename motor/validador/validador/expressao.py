"""Avaliador SEGURO de fórmulas, em aritmética decimal exata.

Por que existe: o código precisa refazer cada conta do Caio. Usar eval() deixaria uma fórmula escrita
por IA executar qualquer coisa. Aqui a fórmula é lida por um leitor próprio que só conhece:

    números (123, 0.50)  nomes de entradas/fórmulas já definidas  + - * / ^ ( )
    funções: min(a, b, ...)  max(a, b, ...)  abs(x)  arredondar(x, casas)

Não existe: ponto (acesso a atributo), colchetes, aspas, **, //, %, chamadas de outras funções,
nem nome que não tenha sido definido antes. Qualquer outra coisa é recusada com o motivo.

Exatidão: + - * ^ são exatos (se não coubessem, a fórmula é recusada). Só a divisão pode arredondar
(80 dígitos). Os números soltos escritos dentro da fórmula são devolvidos em `literais`, para quem
chama conferir se não há "número escondido" (ex.: um câmbio digitado dentro da conta).
"""
import re
from decimal import (ROUND_HALF_UP, Context, Decimal, DivisionByZero, InvalidOperation,
                     Overflow, Rounded)
from typing import NamedTuple

MAX_TAMANHO = 200
MAX_ELEMENTOS = 120
MAX_PROFUNDIDADE = 25
MAX_EXPOENTE = 12
MAX_DIGITOS_DO_NUMERO = 30
LIMITE = Decimal(10) ** 30

FUNCOES = {"min", "max", "abs", "arredondar"}

_TOKEN = re.compile(r"\s*(?:(?P<num>\d+(?:\.\d+)?)|(?P<nome>[A-Za-z_][A-Za-z0-9_]*)|(?P<op>[-+*/^(),]))")


class ErroDeExpressao(ValueError):
    """Fórmula inválida ou insegura. `codigo` é estável (serve para os testes); `args[0]` é a mensagem."""

    def __init__(self, codigo: str, mensagem: str):
        super().__init__(mensagem)
        self.codigo = codigo
        self.mensagem = mensagem


class Avaliacao(NamedTuple):
    valor: Decimal
    literais: list  # números escritos direto na fórmula, como texto
    nomes: set  # nomes de entradas/fórmulas usados


def _ler(expressao: str) -> list:
    if not isinstance(expressao, str) or not expressao.strip():
        raise ErroDeExpressao("EXPRESSAO_VAZIA", "A fórmula está vazia.")
    if len(expressao) > MAX_TAMANHO:
        raise ErroDeExpressao("EXPRESSAO_LONGA", f"A fórmula passa de {MAX_TAMANHO} caracteres.")
    tokens, pos = [], 0
    while pos < len(expressao):
        if expressao[pos:].strip() == "":
            break
        m = _TOKEN.match(expressao, pos)
        if not m:
            resto = expressao[pos:].lstrip()
            raise ErroDeExpressao(
                "CARACTERE_NAO_PERMITIDO",
                f"A fórmula tem um caractere não permitido: {resto[:1]!r}. Só vale número, nome, + - * / ^ ( ) e vírgula entre argumentos.",
            )
        if m.lastgroup == "num":
            if len(m.group("num").replace(".", "")) > MAX_DIGITOS_DO_NUMERO:
                raise ErroDeExpressao("NUMERO_GRANDE_DEMAIS", "Há um número com dígitos demais na fórmula.")
        tokens.append((m.lastgroup, m.group(m.lastgroup)))
        pos = m.end()
        if len(tokens) > MAX_ELEMENTOS:
            raise ErroDeExpressao("MUITOS_ELEMENTOS", f"A fórmula tem mais de {MAX_ELEMENTOS} elementos.")
    return tokens


class _Leitor:
    def __init__(self, tokens, nomes):
        self.t = tokens
        self.i = 0
        self.nomes = nomes
        self.literais = []
        self.usados = set()
        self.nivel = 0
        self.ctx = Context(prec=80, rounding=ROUND_HALF_UP, Emax=9999, Emin=-9999,
                           traps=[InvalidOperation, DivisionByZero, Overflow])

    # ---- utilidades
    def _ver(self):
        return self.t[self.i] if self.i < len(self.t) else (None, None)

    def _pegar(self):
        tok = self._ver()
        self.i += 1
        return tok

    def _op(self, simbolo):
        return self._ver() == ("op", simbolo)

    def _descer(self):
        self.nivel += 1
        if self.nivel > MAX_PROFUNDIDADE:
            raise ErroDeExpressao("PROFUNDO_DEMAIS", "A fórmula tem parênteses demais, um dentro do outro.")

    def _subir(self):
        self.nivel -= 1

    def _conferir(self, r: Decimal) -> Decimal:
        if abs(r) > LIMITE:
            raise ErroDeExpressao("GRANDE_DEMAIS", "A conta dá um número grande demais.")
        return r

    def _exato(self, operacao, a, b):
        self.ctx.clear_flags()
        r = operacao(a, b)
        if self.ctx.flags[Rounded]:
            raise ErroDeExpressao("NAO_EXATO", "A conta não cabe em aritmética exata (números grandes demais).")
        return self._conferir(r)

    # ---- gramática
    def expressao(self) -> Decimal:
        self._descer()
        v = self.termo()
        while self._op("+") or self._op("-"):
            _, o = self._pegar()
            d = self.termo()
            v = self._exato(self.ctx.add if o == "+" else self.ctx.subtract, v, d)
        self._subir()
        return v

    def termo(self) -> Decimal:
        v = self.unario()
        while self._op("*") or self._op("/"):
            _, o = self._pegar()
            d = self.unario()
            if o == "*":
                v = self._exato(self.ctx.multiply, v, d)
            else:
                if d == 0:
                    raise ErroDeExpressao("DIVISAO_POR_ZERO", "A fórmula divide por zero.")
                v = self._conferir(self.ctx.divide(v, d))
        return v

    def unario(self) -> Decimal:
        if self._op("-"):
            self._pegar()
            self._descer()
            v = self.ctx.minus(self.unario())
            self._subir()
            return v
        if self._op("+"):
            self._pegar()
            self._descer()
            v = self.unario()
            self._subir()
            return v
        return self.potencia()

    def potencia(self) -> Decimal:
        base = self.atomo()
        if self._op("^"):
            self._pegar()
            self._descer()
            expo = self.unario()
            self._subir()
            if expo != expo.to_integral_value() or not (0 <= expo <= MAX_EXPOENTE):
                raise ErroDeExpressao("EXPOENTE_INVALIDO", f"O expoente deve ser um número inteiro de 0 a {MAX_EXPOENTE}.")
            r = Decimal(1)
            for _ in range(int(expo)):
                r = self._exato(self.ctx.multiply, r, base)
            return r
        return base

    def atomo(self) -> Decimal:
        tipo, valor = self._pegar()
        if tipo == "num":
            self.literais.append(valor)
            return Decimal(valor)
        if tipo == "op" and valor == "(":
            v = self.expressao()
            if self._pegar() != ("op", ")"):
                raise ErroDeExpressao("SINTAXE", "Falta fechar um parêntese na fórmula.")
            return v
        if tipo == "nome":
            if self._op("("):
                return self.funcao(valor)
            if valor in FUNCOES:
                raise ErroDeExpressao("SINTAXE", f"'{valor}' é uma função e precisa de parênteses.")
            if valor not in self.nomes:
                raise ErroDeExpressao("NOME_DESCONHECIDO", f"A fórmula usa '{valor}', que não é uma entrada nem uma fórmula já definida.")
            self.usados.add(valor)
            return self.nomes[valor]
        raise ErroDeExpressao("SINTAXE", "A fórmula está incompleta ou tem operadores em lugar errado.")

    def funcao(self, nome: str) -> Decimal:
        if nome not in FUNCOES:
            raise ErroDeExpressao("FUNCAO_NAO_PERMITIDA", f"A função '{nome}' não é permitida. As permitidas são: {', '.join(sorted(FUNCOES))}.")
        self._pegar()  # "("
        args = []
        if not self._op(")"):
            while True:
                args.append(self.expressao())
                if self._op(","):
                    self._pegar()
                    continue
                break
        if self._pegar() != ("op", ")"):
            raise ErroDeExpressao("SINTAXE", f"Falta fechar o parêntese da função {nome}.")
        if nome in ("min", "max"):
            if len(args) < 2:
                raise ErroDeExpressao("ARGUMENTOS", f"{nome}() precisa de pelo menos 2 valores.")
            return min(args) if nome == "min" else max(args)
        if nome == "abs":
            if len(args) != 1:
                raise ErroDeExpressao("ARGUMENTOS", "abs() recebe 1 valor.")
            return self.ctx.abs(args[0])
        # arredondar(x, casas)
        if len(args) != 2:
            raise ErroDeExpressao("ARGUMENTOS", "arredondar() recebe 2 valores: o número e as casas (0 a 8).")
        casas = args[1]
        if casas != casas.to_integral_value() or not (0 <= casas <= 8):
            raise ErroDeExpressao("ARGUMENTOS", "As casas de arredondar() devem ser um inteiro de 0 a 8.")
        return self._conferir(args[0].quantize(Decimal(1).scaleb(-int(casas)), rounding=ROUND_HALF_UP, context=self.ctx))


def avaliar(expressao: str, nomes: dict) -> Avaliacao:
    """Calcula a fórmula com os `nomes` (nome -> Decimal). Levanta ErroDeExpressao se algo não for permitido."""
    tokens = _ler(expressao)
    leitor = _Leitor(tokens, nomes)
    valor = leitor.expressao()
    if leitor.i != len(tokens):
        raise ErroDeExpressao("SINTAXE", "Sobrou parte da fórmula que não faz sentido (falta um operador?).")
    return Avaliacao(valor, leitor.literais, leitor.usados)
