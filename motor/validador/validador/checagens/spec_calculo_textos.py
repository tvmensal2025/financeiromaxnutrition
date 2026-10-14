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
_ESCALA = {"mil": 1000, "milhao": 1_000_000, "milhoes": 1_000_000, "k": 1000, "mi": 1_000_000}
_TIPOS = {"dolar": "USD", "dolares": "USD", "real": "BRL", "reais": "BRL", "euro": "EUR", "euros": "EUR",
          "hora": "HORA", "horas": "HORA", "pessoa": "PESSOA", "pessoas": "PESSOA"}


def _tipo_da_unidade(unidade):
    t = T.dobrar(unidade) if isinstance(unidade, str) else ""
    for simbolo, codigo in (("us$", "USD"), ("r$", "BRL"), ("€", "EUR")):
        if simbolo in t:
            return codigo
    for palavra, codigo in _TIPOS.items():
        if re.search(r"(?<!\w)" + palavra + r"(?!\w)", t):
            return codigo
    return "%" if "%" in t else None


def _textos_dos_numeros(entrega):
    """Unidade e comentários nos objetos de número, sem o valor puro nem as citações importadas."""
    for secao, chave in (("entradas", "valor"), ("contas", "resultado"), ("cenarios", "resultado")):
        for i, linha in enumerate(entrega.get(secao, []) if isinstance(entrega.get(secao), list) else []):
            obj = linha.get(chave) if isinstance(linha, dict) else None
            if not isinstance(obj, dict):
                continue
            for campo, texto in obj.items():
                if campo not in {"valor", "origem", "ref", "citacao", "data_da_fonte"} and isinstance(texto, str):
                    yield f"entrega.{secao}[{i}].{chave}.{campo}", texto
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
        antes = limpo[max(0, m.start() - 5):m.start()]
        moeda = re.search(r"(?:US\$|R\$|€)\s*$", antes, re.I)
        depois = re.match(r"\s*(milhões?|milhao|mil|mi|k)?\b(?:\s+de)?\s*(dólares?|reais?|euros?|horas?|pessoas?|%)?", limpo[m.end():], re.I)
        escala = T.dobrar(depois.group(1) or "") if depois else ""
        tipo_nome = T.dobrar(depois.group(2) or "") if depois else ""
        tipo = {"US$": "USD", "R$": "BRL", "€": "EUR"}.get(moeda.group().strip().upper()) if moeda else _TIPOS.get(tipo_nome)
        if valor is not None and escala in _ESCALA:
            valor *= _ESCALA[escala]
        if moeda and re.fullmatch(r"\d{1,3},\d{3}", bruto):
            valor = None  # dinheiro com vírgula ambígua/inglesa
        saida.append((valor, bruto, tipo))
    return saida


def _valores_por_extenso(texto: str) -> list:
    """[(Decimal, trecho)] de 'cem dólares', 'dez por cento', 'mil e quinhentos reais' escritos por extenso."""
    palavras = re.findall(r"[a-z]+", T.dobrar(texto))
    saida = []
    for i, p in enumerate(palavras):
        fim = i if (p in _DINHEIRO_E_PORCENTAGEM | set(_TIPOS) or (p == "por" and palavras[i + 1:i + 2] == ["cento"])) else None
        if fim is None:
            continue
        ini = fim
        if ini > 0 and palavras[ini - 1] == "de":
            ini -= 1
        while ini > 0 and (palavras[ini - 1] in B.PALAVRAS_DE_NUMERO or palavras[ini - 1] == "e"):
            ini -= 1
        corpo = [x for x in palavras[ini:fim] if x != "de"]
        while corpo and corpo[0] == "e":
            corpo = corpo[1:]
        while corpo and corpo[-1] == "e":
            corpo = corpo[:-1]
        valor = B.numero_por_extenso(corpo) if corpo else None
        if valor is not None:
            tipo = _TIPOS.get(p, "%" if p == "por" else None)
            saida.append((valor, " ".join(corpo + ([p] if p != "por" else ["por", "cento"])), tipo))
    prefixo = re.findall(r"(?:US\$|R\$|€)\s+([a-zçãõáéíóúâêô]+)", T.dobrar(texto), re.I)
    for palavra in prefixo:
        valor = B.numero_por_extenso([palavra])
        if valor is not None:
            moeda = re.search(r"(US\$|R\$|€)\s+" + re.escape(palavra), T.dobrar(texto), re.I)
            saida.append((valor, moeda.group(), {"us$": "USD", "r$": "BRL", "€": "EUR"}[moeda.group(1)]))
    return saida


def _numero_solto(exe) -> list:
    par = B.parametros(exe, ID9, texto_livre="lista_de_texto", constantes_do_modelo="lista_de_numeros", ignora="lista_de_texto")
    ignorar = _padroes_a_ignorar(" ".join(map(str, par["ignora"])))
    m = B.carregar(exe)
    aceitos = {Decimal(c) for c in par["constantes_do_modelo"]}
    tipados = set()
    for e in m.entradas:
        if e.valor is not None:
            aceitos.add(e.valor)
            tipados.add((e.valor, _tipo_da_unidade(e.unidade)))
    for c in m.contas:
        if c.resultado is not None:
            aceitos.add(c.resultado)
            tipados.add((c.resultado, _tipo_da_unidade(c.unidade)))
    for _, linha in m.cenarios:
        r = linha.get("resultado")
        v = B.para_decimal(r.get("valor")) if isinstance(r, dict) else None
        if v is not None:
            aceitos.add(v)
            tipados.add((v, _tipo_da_unidade(r.get("unidade", ""))))
        for parte in str(linha.get("ajustes", "")).split(";"):
            if "=" in parte:
                n = B.numero_do_texto(parte.split("=", 1)[1].strip().lstrip("+-"))
                if n is not None:
                    aceitos.add(n)
                    entrada = m.entrada(parte.split("=", 1)[0].strip())
                    if entrada is not None:
                        tipados.add((n, _tipo_da_unidade(entrada.unidade)))
    prefixo = B.prefixo_do_pedido(exe)
    for fid, fonte in exe.fontes.items():
        if prefixo and fid.startswith(prefixo):
            aceitos |= set(numeros_no_texto(fonte.parte_b(1)))
            numericos = _numeros_escritos(fonte.parte_b(1), ignorar)
            aceitos |= {v for v, _, _ in numericos if v is not None}
            tipados |= {(v, tipo) for v, _, tipo in numericos if v is not None and tipo is not None}
    falhas = []
    campos = [item for campo in par["texto_livre"] for item in B.textos_do_campo(m.entrega, campo)]
    for cam, texto in campos + list(_textos_dos_numeros(m.entrega)):
        for valor, bruto, tipo in _numeros_escritos(texto, ignorar):
            if valor is None:
                falhas.append(Falha(ID9, "NUMERO_ILEGIVEL", cam, f"Não consegui ler o número '{bruto}': escreva milhar com ponto e decimal com vírgula (ex.: 1.234,56).", T.cortar(texto)))
            elif valor not in aceitos:
                falhas.append(Falha(ID9, "NUMERO_SOLTO", cam,
                                    f"O número {bruto} não é valor de entrada, de ajuste, resultado declarado, constante do modelo nem está no pedido. Use só número das tabelas ou do pedido.", T.cortar(texto)))
            elif tipo is not None and (valor, tipo) not in tipados:
                falhas.append(Falha(ID9, "NUMERO_COM_UNIDADE_SEM_FONTE", cam,
                                    f"O número {bruto} não aparece como {tipo} nas tabelas ou no pedido.", T.cortar(texto)))
        for valor, trecho, tipo in _valores_por_extenso(texto):
            if valor not in aceitos or tipo is not None and (valor, tipo) not in tipados:
                falhas.append(Falha(ID9, "NUMERO_SOLTO_POR_EXTENSO", cam,
                                    f"O valor '{trecho}' ({valor}) não é valor de entrada, de ajuste, resultado declarado, constante do modelo nem está no pedido.", T.cortar(texto)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-CALCULO-10 e 11 (procurar termos em todo o texto da entrega, menos os trechos citados)
# ---------------------------------------------------------------------------------------
def _termos_no_texto(exe, id_, motivo, termos, mensagem) -> list:
    falhas = []
    def textos(valor, caminho):
        if isinstance(valor, dict):
            for chave, filho in valor.items():
                if chave != "trecho_original":
                    yield from textos(filho, f"{caminho}.{chave}")
        elif isinstance(valor, list):
            for indice, filho in enumerate(valor):
                yield from textos(filho, f"{caminho}[{indice}]")
        elif isinstance(valor, str):
            yield caminho, valor

    for caminho, texto in textos(exe.acao_obj["entrega"], "entrega"):
        dobrado = T.dobrar(texto)
        for termo in termos:
            if B.achar_termo(dobrado, termo):
                falhas.append(Falha(id_, motivo, caminho, mensagem.format(termo=termo), T.cortar(texto)))
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
    campos = [item for campo in par["onde"] for item in B.textos_do_campo(m.entrega, campo)]
    for cam, texto in campos + list(_textos_dos_numeros(m.entrega)):
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
