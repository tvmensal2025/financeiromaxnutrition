"""Checagens do modelo de cálculo do Caio sobre os TEXTOS livres:

CHK-CALCULO-09  nenhum número solto: todo número em algarismos (ou por extenso, em dinheiro e porcentagem) vem das tabelas ou do pedido.
CHK-CALCULO-10  sem certeza sobre previsão: nenhuma expressão da lista fechada (mesmo negada).
CHK-CALCULO-11  nenhum termo proibido pelo pacote da empresa do card (lista lida na hora; não é copiada).
CHK-CALCULO-12  sem conta fiscal: imposto, nota e fechamento contábil ficam com o contador.

De onde vem: helena-v2/deliverables/calculo.yaml (cada CHK, com seus `parametros`). Os números e as listas são lidos de lá
(exe.parametros) ou do pacote da empresa (CHK-CALCULO-11); este arquivo só sabe COMO conferir.
Como mudar uma regra: mude o `parametros` no YAML do tipo. Peças comuns em spec_calculo_base.py.
"""
import re
from decimal import Decimal

from .. import texto as T
from ..numeros import numeros_no_texto
from ..registro import checagem
from ..resultado import Falha
from . import spec_calculo_base as B

ID9, ID10, ID11, ID12 = "CHK-CALCULO-09", "CHK-CALCULO-10", "CHK-CALCULO-11", "CHK-CALCULO-12"

_DATA = re.compile(r"(?<!\d)\d{1,2}/\d{1,2}/\d{2,4}(?!\d)")
_HORA = re.compile(r"(?<!\d)\d{1,2}:\d{2}(?!\d)")
_NUMERO = re.compile(r"(?<![\w])(\d+(?:[.,]\d+)*)")
_MIL = re.compile(r"\s+mil\b", re.I)
# Palavras que fecham um valor por extenso ("cem DÓLARES", "dez POR CENTO"). Tabela do idioma, não regra de negócio.
_DINHEIRO_E_PORCENTAGEM = {"real", "reais", "dolar", "dolares", "euro", "euros", "centavo", "centavos"}


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-09
# ---------------------------------------------------------------------------------------
def _padroes_a_ignorar(texto_da_regra: str):
    """Do texto 'ignora' do YAML tira as letras dos ids (V1-V15, K1-K12) e os prefixos (CARD-n, SRV-..., DEC-nnn...)."""
    letras = sorted(set(re.findall(r"\b([A-Z])1-\1\d+", texto_da_regra)))
    prefixos = sorted(set(re.findall(r"\b([A-Z]{2,})-(?:n+|\.\.\.)", texto_da_regra)))
    if not letras or not prefixos:
        raise B.ParametrosInvalidos("não consegui ler de CHK-CALCULO-09 (ignora) quais ids são ignorados")
    return re.compile(r"(?<![\w])(?:[" + "".join(letras) + r"]\d+|(?:" + "|".join(prefixos) + r")-[\w-]+)(?![\w])")


def _numeros_escritos(texto: str, ignorar) -> list:
    """[(Decimal | None, texto do número)] dos números em algarismos do texto, depois de tirar ids, datas e horas.
    'mil' logo depois do número multiplica por 1.000. None = número que não deu para ler."""
    limpo = ignorar.sub(" ", texto)
    limpo = _DATA.sub(" ", limpo)
    limpo = _HORA.sub(" ", limpo)
    saida = []
    for m in _NUMERO.finditer(limpo):
        bruto = m.group(1).rstrip(".,")
        valor = B.numero_do_texto(bruto)
        if valor is not None and _MIL.match(limpo, m.end()):
            valor *= 1000
        saida.append((valor, bruto))
    return saida


def _valores_por_extenso(texto: str) -> list:
    """[(Decimal, trecho)] de 'cem dólares', 'dez por cento', 'mil e quinhentos reais' escritos por extenso."""
    palavras = re.findall(r"[a-z]+", T.dobrar(texto))
    saida = []
    for i, p in enumerate(palavras):
        fim = i if (p in _DINHEIRO_E_PORCENTAGEM or (p == "por" and palavras[i + 1:i + 2] == ["cento"])) else None
        if fim is None:
            continue
        ini = fim
        while ini > 0 and (palavras[ini - 1] in B.PALAVRAS_DE_NUMERO or palavras[ini - 1] == "e"):
            ini -= 1
        corpo = palavras[ini:fim]
        while corpo and corpo[0] == "e":
            corpo = corpo[1:]
        while corpo and corpo[-1] == "e":
            corpo = corpo[:-1]
        valor = B.numero_por_extenso(corpo) if corpo else None
        if valor is not None:
            saida.append((valor, " ".join(corpo + ([p] if p != "por" else ["por", "cento"]))))
    return saida


def _numero_solto(exe) -> list:
    par = B.parametros(exe, ID9, texto_livre="lista_de_texto", constantes_do_modelo="lista_de_numeros", ignora="lista_de_texto")
    ignorar = _padroes_a_ignorar(" ".join(map(str, par["ignora"])))
    m = B.carregar(exe)
    aceitos = {Decimal(c) for c in par["constantes_do_modelo"]}
    for e in m.entradas:
        if e.valor is not None:
            aceitos.add(e.valor)
    for c in m.contas:
        if c.resultado is not None:
            aceitos.add(c.resultado)
    for _, linha in m.cenarios:
        r = linha.get("resultado")
        v = B.para_decimal(r.get("valor")) if isinstance(r, dict) else None
        if v is not None:
            aceitos.add(v)
        for parte in str(linha.get("ajustes", "")).split(";"):
            if "=" in parte:
                n = B.numero_do_texto(parte.split("=", 1)[1].strip().lstrip("+-"))
                if n is not None:
                    aceitos.add(n)
    prefixo = B.prefixo_do_pedido(exe)
    for fid, fonte in exe.fontes.items():
        if prefixo and fid.startswith(prefixo):
            aceitos |= set(numeros_no_texto(fonte.parte_b(1)))
            aceitos |= {v for v, _ in _numeros_escritos(fonte.parte_b(1), ignorar) if v is not None}
    falhas = []
    for campo in par["texto_livre"]:
        for cam, texto in B.textos_do_campo(m.entrega, campo):
            for valor, bruto in _numeros_escritos(texto, ignorar):
                if valor is None:
                    falhas.append(Falha(ID9, "NUMERO_ILEGIVEL", cam, f"Não consegui ler o número '{bruto}': escreva milhar com ponto e decimal com vírgula (ex.: 1.234,56).", T.cortar(texto)))
                elif valor not in aceitos:
                    falhas.append(Falha(ID9, "NUMERO_SOLTO", cam,
                                        f"O número {bruto} não é valor de entrada, de ajuste, resultado declarado, constante do modelo nem está no pedido. Use só número das tabelas ou do pedido.", T.cortar(texto)))
            for valor, trecho in _valores_por_extenso(texto):
                if valor not in aceitos:
                    falhas.append(Falha(ID9, "NUMERO_SOLTO_POR_EXTENSO", cam,
                                        f"O valor '{trecho}' ({valor}) não é valor de entrada, de ajuste, resultado declarado, constante do modelo nem está no pedido.", T.cortar(texto)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-10 e 11 (procurar termos em todo o texto da entrega, menos os trechos citados)
# ---------------------------------------------------------------------------------------
def _termos_no_texto(exe, id_, motivo, termos, mensagem) -> list:
    falhas = []
    for item in exe.itens_livres():
        dobrado = T.dobrar(item.texto)
        for termo in termos:
            if B.achar_termo(dobrado, termo):
                falhas.append(Falha(id_, motivo, item.caminho, mensagem.format(termo=termo), T.cortar(item.texto)))
    return falhas


def _sem_certeza(exe) -> list:
    par = B.parametros(exe, ID10, termos="lista_de_texto")
    return _termos_no_texto(exe, ID10, "CERTEZA_SOBRE_PREVISAO", par["termos"],
                            "O texto usa '{termo}', que fala de certeza sobre uma previsão (mesmo negado). Para incerteza, escreva 'estimativa' ou 'previsão'.")


def _termos_do_pacote(exe) -> list:
    pacote = exe.contexto.get("pacote_da_empresa")
    termos = pacote.get("termos_proibidos_em_todo_texto") if isinstance(pacote, dict) else None
    if termos is None:
        return []  # o pacote não tem lista: passa (a faixa do card mostra 'pacote sem lista de termos')
    if not isinstance(termos, list) or not all(isinstance(t, str) for t in termos):
        raise B.ParametrosInvalidos("termos_proibidos_em_todo_texto do pacote da empresa deve ser uma lista de textos")
    return _termos_no_texto(exe, ID11, "TERMO_PROIBIDO_PELO_PACOTE", termos, "O texto usa '{termo}', termo proibido pelo pacote da empresa deste card.")


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-12
# ---------------------------------------------------------------------------------------
def _sem_conta_fiscal(exe) -> list:
    par = B.parametros(exe, ID12, onde="lista_de_texto", palavras="lista_de_texto", siglas_maiusculas_palavra_inteira="lista_de_texto")
    m = B.carregar(exe)
    falhas = []
    for campo in par["onde"]:
        for cam, texto in B.textos_do_campo(m.entrega, campo):
            dobrado = T.dobrar(texto)
            achados = [p for p in par["palavras"] if B.achar_termo(dobrado, p)]
            achados += [s for s in par["siglas_maiusculas_palavra_inteira"] if B.achar_sigla(texto, s)]
            for a in achados:
                falhas.append(Falha(ID12, "ASSUNTO_FISCAL", cam,
                                    f"O texto trata de '{a}': imposto, nota fiscal e fechamento contábil são do contador (fora deste serviço). Se for preciso, diga em 'limites' ou 'riscos' que ficam com o contador.", T.cortar(texto)))
    return falhas


# ---------------------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------------------
@checagem(ID9, "Calculo: nenhum número solto no texto",
          "Um número escrito no texto sem estar nas tabelas nem no pedido era um valor sem origem, e a conta não o cobria.",
          ["C-9", "K-8"])
def numero_solto(exe):
    return B.roda(exe, ID9, _numero_solto)


@checagem(ID10, "Calculo: sem certeza sobre previsão",
          "Dizer 'garantido' ou 'com certeza' de uma previsão fazia o fundador tratar estimativa como dinheiro certo.",
          ["C-13"])
def sem_certeza(exe):
    return B.roda(exe, ID10, _sem_certeza)


@checagem(ID11, "Calculo: nenhum termo proibido pelo pacote da empresa",
          "Um termo que o pacote da empresa proíbe (grafia, promessa, voz) podia escapar no texto do cálculo.",
          ["DEC-023", "C-13"])
def termo_do_pacote(exe):
    return B.roda(exe, ID11, _termos_do_pacote)


@checagem(ID12, "Calculo: sem conta fiscal",
          "O Caio podia fazer conta de imposto ou de nota fiscal, que é trabalho do contador e não deste serviço.",
          ["A-12"])
def sem_conta_fiscal(exe):
    return B.roda(exe, ID12, _sem_conta_fiscal)
