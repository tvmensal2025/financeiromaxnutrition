"""O avaliador seguro de fórmulas: contas exatas, precedência e recusa de tudo o que não for conta."""
import random
from decimal import Decimal as D

import pytest

from validador.expressao import ErroDeExpressao, avaliar


def v(expr, **nomes):
    return avaliar(expr, {k: D(str(x)) for k, x in nomes.items()}).valor


@pytest.mark.parametrize("expr,esperado", [
    ("1 + 2 * 3", 7),
    ("(1 + 2) * 3", 9),
    ("10 - 2 - 3", 5),
    ("100 / 4 / 5", 5),
    ("2 ^ 3 ^ 2", 512),  # potência associa pela direita
    ("-2 ^ 2", -4),  # o menos vale depois da potência (convenção da matemática)
    ("--2", 2),
    ("+3", 3),
    ("0.1 + 0.2", D("0.3")),  # decimal exato: em float daria 0.30000000000000004
    ("0.1 * 3", D("0.3")),
    ("1.10 + 2.20", D("3.30")),
    ("max(1, 5, 3)", 5),
    ("min(4, 2, 9)", 2),
    ("abs(0 - 7)", 7),
    ("arredondar(10 / 3, 2)", D("3.33")),
    ("arredondar(2.5, 0)", 3),  # meio arredonda para cima
    ("arredondar(0.125, 2)", D("0.13")),
    ("(((((1)))))", 1),
    ("a * b + c", D("6.1")),
    ("  a   *   b  ", 6),
])
def test_contas_certas(expr, esperado):
    assert v(expr, a=2, b=3, c="0.1") == D(str(esperado))


def test_decimal_exato_mesmo_com_muitas_casas():
    assert v("123456789012345678901234567890 * 2") == D("246913578024691357802469135780")
    assert v("0.00000000000000000000000000001 * 3") == D("0.00000000000000000000000000003")


def test_divisao_nao_exata_arredonda_so_na_divisao():
    r = v("1 / 3")
    assert str(r).startswith("0.3333333333") and len(str(r)) > 60
    assert v("arredondar(1 / 3, 4)") == D("0.3333")


def test_devolve_literais_e_nomes_usados():
    av = avaliar("pessoas * 20 + horas * 0.50", {"pessoas": D(10), "horas": D(2)})
    assert av.literais == ["20", "0.50"]
    assert av.nomes == {"pessoas", "horas"}


@pytest.mark.parametrize("expr,codigo", [
    ("", "EXPRESSAO_VAZIA"),
    ("   ", "EXPRESSAO_VAZIA"),
    ("1 +", "SINTAXE"),
    ("(1 + 2", "SINTAXE"),
    ("1 + 2)", "SINTAXE"),
    ("1 2", "SINTAXE"),
    ("* 3", "SINTAXE"),
    ("2 ** 3", "SINTAXE"),
    ("7 // 2", "SINTAXE"),
    ("1,5 + 2", "SINTAXE"),
    ("1 / 0", "DIVISAO_POR_ZERO"),
    ("a / (b - 3)", "DIVISAO_POR_ZERO"),
    ("2 ^ 0.5", "EXPOENTE_INVALIDO"),
    ("2 ^ 13", "EXPOENTE_INVALIDO"),
    ("2 ^ (0 - 1)", "EXPOENTE_INVALIDO"),
    ("naoexiste + 1", "NOME_DESCONHECIDO"),
    ("A + 1", "NOME_DESCONHECIDO"),  # maiúscula é outro nome
    ("eval(1)", "FUNCAO_NAO_PERMITIDA"),
    ("open(1)", "FUNCAO_NAO_PERMITIDA"),
    ("a(1)", "FUNCAO_NAO_PERMITIDA"),  # nome de entrada não é função
    ("max", "SINTAXE"),
    ("max(1)", "ARGUMENTOS"),
    ("abs(1, 2)", "ARGUMENTOS"),
    ("arredondar(1)", "ARGUMENTOS"),
    ("arredondar(1, 9)", "ARGUMENTOS"),
    ("arredondar(1, 0.5)", "ARGUMENTOS"),
    ("999999999999999999999999999999 * 999999999999999999999999999999", "GRANDE_DEMAIS"),
    ("1234567890123456789012345678901", "NUMERO_GRANDE_DEMAIS"),
    ("1 + 2 % 3", "CARACTERE_NAO_PERMITIDO"),
    ("a.b", "CARACTERE_NAO_PERMITIDO"),
    ("a[0]", "CARACTERE_NAO_PERMITIDO"),
    ("'abc'", "CARACTERE_NAO_PERMITIDO"),
    ('"abc"', "CARACTERE_NAO_PERMITIDO"),
    ("a; b", "CARACTERE_NAO_PERMITIDO"),
    ("a = 1", "CARACTERE_NAO_PERMITIDO"),
    ("a > 1", "CARACTERE_NAO_PERMITIDO"),
    ("a if b else c", "SINTAXE"),
    ("lambda: 1", "CARACTERE_NAO_PERMITIDO"),
    ("1e3", "SINTAXE"),
    ("0x10", "SINTAXE"),
    ("1_000", "SINTAXE"),
    ("{1}", "CARACTERE_NAO_PERMITIDO"),
    ("a\nb", "SINTAXE"),
    ("$a", "CARACTERE_NAO_PERMITIDO"),
    ("а + 1", "CARACTERE_NAO_PERMITIDO"),  # 'a' cirílico não é nome
    ("1+" * 70 + "1", "MUITOS_ELEMENTOS"),
    ("(" * 30 + "1" + ")" * 30, "PROFUNDO_DEMAIS"),
    ("1" + " + 1" * 80, "EXPRESSAO_LONGA"),
])
def test_recusa_o_que_nao_e_conta(expr, codigo):
    with pytest.raises(ErroDeExpressao) as e:
        avaliar(expr, {"a": D(2), "b": D(3)})
    assert e.value.codigo == codigo, e.value.mensagem


def test_expressao_malvada_nao_executa_nada(tmp_path):
    marcador = tmp_path / "executou"
    maldades = [
        f"__import__('pathlib').Path('{marcador}').touch()",
        f"open('{marcador}', 'w')",
        f"exec(\"open('{marcador}','w')\")",
        "().__class__.__bases__[0].__subclasses__()",
        "a.__class__",
        "(lambda: 1)()",
        "[x for x in range(3)]",
        "getattr(a, 'real')",
        "__builtins__",
        "globals()",
    ]
    for m in maldades:
        with pytest.raises(ErroDeExpressao):
            avaliar(m, {"a": D(1)})
    assert not marcador.exists()


def test_fuzz_nunca_levanta_outro_erro():
    """Texto aleatório: ou dá um número, ou levanta ErroDeExpressao. Nunca outra exceção, nunca trava."""
    rng = random.Random(2026)
    alfabeto = list("0123456789+-*/^(),. abcxyz_") + ["min(", "max(", "abs(", "arredondar(", "**", "//", "\n", "é", "$", "'", "a", "b"]
    for _ in range(4000):
        expr = "".join(rng.choice(alfabeto) for _ in range(rng.randint(0, 30)))
        try:
            r = avaliar(expr, {"a": D(2), "b": D("0.5")})
            assert isinstance(r.valor, D)
        except ErroDeExpressao:
            pass
