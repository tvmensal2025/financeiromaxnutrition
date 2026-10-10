"""Números em aritmética decimal exata (nunca float)."""
import re
from decimal import Decimal, InvalidOperation

_SIMPLES = re.compile(r"^[+-]?\d+(\.\d+)?$")
_VIRGULA = re.compile(r"^[+-]?\d+,\d+$")
MAX_DIGITOS = 30


def para_decimal(valor) -> Decimal | None:
    """Converte número ou texto em Decimal exato. Devolve None se não for um número simples.

    Aceita: 12, "12", "0.50", "0,50", Decimal, float (pelo texto mais curto, ex.: 0.1 vira 0.1).
    Não aceita: "1.234,56" (separador de milhar), "1e3", "abc", True/False, NaN, infinito.
    """
    if isinstance(valor, bool) or valor is None:
        return None
    if isinstance(valor, Decimal):
        d = valor
    elif isinstance(valor, int):
        d = Decimal(valor)
    elif isinstance(valor, float):
        d = Decimal(repr(valor))
    elif isinstance(valor, str):
        t = valor.strip()
        if _VIRGULA.match(t):
            t = t.replace(",", ".")
        if not _SIMPLES.match(t):
            return None
        d = Decimal(t)
    else:
        return None
    try:
        if not d.is_finite():
            return None
    except InvalidOperation:
        return None
    if len(d.as_tuple().digits) > MAX_DIGITOS:
        return None
    return d


def casas_decimais(valor) -> int:
    """Quantas casas depois da vírgula o número foi escrito com (0.50 -> 2). Só para números já válidos."""
    d = para_decimal(valor)
    if d is None:
        return 0
    return max(0, -d.as_tuple().exponent)


_NUMERO_NO_TEXTO = re.compile(r"\d+(?:[.,]\d+)*")


def numeros_no_texto(texto: str) -> list[Decimal]:
    """Todos os números escritos num texto, entendendo '0,50', '0.50' e '1.234,56'."""
    achados = []
    for m in _NUMERO_NO_TEXTO.finditer(texto or ""):
        bruto = m.group(0)
        candidatos = {bruto}
        if "," in bruto and "." in bruto:
            candidatos = {bruto.replace(".", "").replace(",", ".")}
        elif "," in bruto:
            partes = bruto.split(",")
            candidatos = {bruto.replace(",", ".")} if len(partes) == 2 else {"".join(partes)}
            if len(partes) == 2 and len(partes[1]) == 3:
                candidatos.add("".join(partes))  # 1,234 pode ser milhar (inglês)
        elif "." in bruto:
            partes = bruto.split(".")
            if len(partes) > 2 or (len(partes) == 2 and len(partes[1]) == 3):
                candidatos.add("".join(partes))  # 1.234 pode ser milhar (português)
            if len(partes) > 2:
                candidatos.discard(bruto)
        for c in candidatos:
            d = para_decimal(c)
            if d is not None:
                achados.append(d)
    return achados
