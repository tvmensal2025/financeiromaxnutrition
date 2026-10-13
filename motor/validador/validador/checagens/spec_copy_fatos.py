"""Checagens do tipo COPY que olham os FATOS do texto: CHK-COPY-06 (contato), 07 (número solto) e 08 (afirmação com apoio).

O que é: o código que confere se o texto pronto da Isabela só afirma o que o pedido ou o pacote da empresa dizem. É determinístico
(sem IA) e falha fechado: na dúvida, recusa. Usa as peças comuns de spec_copy.py.

De onde vem: helena-v2/deliverables/copy.yaml, 'checagens_codigo', bloco 'parametros' de cada checagem (exe.parametros). As fontes
são as importadas pelo código ANTES de qualquer IA (exe.fontes): o pedido original (FON-PEDIDO-<card>) e o pacote da empresa
(FON-PACOTE-<empresa>), com os mesmos ids que a especificação escreve. Nada da lista da especificação é copiado para cá:
  - CHK-COPY-06: cada item de 'padroes' é lido pelo começo da frase (site, e-mail, @usuário, telefone, CPF, CEP); os finais de
    site (.com, .br...) e o modelo de CPF/CEP (000.000.000-00) são tirados do próprio texto do padrão; padrão novo que o código
    ainda não sabe conferir para tudo com ErroDeContexto, em vez de passar calado;
  - CHK-COPY-07: o jeito de escrever número e a palavra 'mil' vêm de 'formato'; o que se ignora vem de 'ignora';
  - CHK-COPY-08: o modelo do id (A1 a A8) e o mínimo de palavras vêm dos parâmetros.
O que o código sabe sozinho (fatos da língua e do tipo, não regras): os NOMES das seções (versao_final, alternativa_curta, afirmacoes)
e dos campos (id, frase, apoio); que o DDD tem 2 dígitos; que 'milhão' e 'bilhão' também multiplicam (a especificação só diz 'mil'); e
que números de código (BIZ-003, DEC-024) do pacote não são quantidades.

Como mudar: no copy.yaml. Para o código passar a reconhecer outro final de site, acrescente-o na frase do padrão de site; para
outro tipo de contato, ele precisa de um detector novo aqui (a checagem avisa).

Limites conhecidos: contato escrito por extenso ou em código ('arroba', 'ponto com'), final de site que não está na frase da
especificação (ex.: .me, .ly) e número escrito por extenso ('dez') não são vistos pelo código; é da rubrica. Telefone sem DDD só vale se
o pedido o trouxer igual (sem DDD). O apoio da CHK-COPY-08 vale se vier de QUALQUER fonte importada do card (o pedido, o pacote ou fonte aprovada).
"""
import re
from decimal import Decimal, InvalidOperation

from .. import texto as T
from ..contexto import ErroDeContexto
from ..resultado import Falha
from .citacao import _limite_de_palavra  # só LÊ a função de citacao.py; nada lá é alterado
from .spec_copy import SECAO_ALTERNATIVA, SECAO_VERSAO_FINAL, campos, da_spec, frase_do_termo, lista_de_textos

SECAO_AFIRMACOES = "afirmacoes"
DIGITOS_DO_DDD = 2  # o DDD brasileiro tem sempre 2 dígitos ('com ou sem DDD' da especificação)
_PONTUACAO_NAS_PONTAS = ".,;:!?)(\"'"
_PONTUACAO_DAS_PONTAS = " .,;:!?…"


# ---------------------------------------------------------------------------------------
# As fontes aceitas
# ---------------------------------------------------------------------------------------
def fontes_aceitas(exe, entradas, id_) -> dict:
    """{id da fonte: Pagina} das fontes importadas que a especificação aceita: 'FON-PEDIDO-<card>' vale por qualquer id que
    comece com 'FON-PEDIDO-' (o motor só importa as do card); entradas que não começam com 'FON-' são só explicação."""
    prefixos = [e.split("<")[0] for e in entradas if isinstance(e, str) and e.startswith("FON-")]
    if not prefixos:
        raise ErroDeContexto(f"{id_}: o parâmetro 'fontes_aceitas' da especificação deve citar fontes como 'FON-PEDIDO-<card>'.")
    return {fid: pagina for fid, pagina in exe.fontes.items() if any(fid.startswith(p) for p in prefixos)}


def _texto_da_fonte(pagina) -> str:
    return pagina.parte_b(1) or ""


# ---------------------------------------------------------------------------------------
# CHK-COPY-06: nenhum contato inventado
# ---------------------------------------------------------------------------------------
_COM_PREFIXO = re.compile(r"(?:https?://|www\.)[^\s<>\"']+")
_DOMINIO = re.compile(r"[a-z0-9-]+(?:\.[a-z0-9-]+)+")
_LETRAS_DO_EMAIL = frozenset("abcdefghijklmnopqrstuvwxyz0123456789._%+-")
_ARROBA = re.compile(r"(?<![\w.@-])@([a-z0-9_.]{2,})")
_BLOCO_DE_DIGITOS = re.compile(r"\+?\(?\d(?:[ .()-]{0,2}\d)+")  # dígitos separados por até 2 sinais (espaço . ( ) -)
_PARECE_DATA = re.compile(r"\d{4}-\d{2}-\d{2}|\d{1,2}[.-]\d{1,2}[.-]\d{4}")  # 2026-10-14, 14.10.2026, 14-10-2026: oito dígitos que não são telefone


def _limpar(contato: str) -> str:
    return contato.strip(_PONTUACAO_NAS_PONTAS).rstrip("/")


def _detector_de_site(padrao: str, id_):
    finais = re.findall(r"\.([a-z]{2,})", T.dobrar(padrao))
    if not finais:
        raise ErroDeContexto(f"{id_}: o padrão de endereço de site deve dizer os finais aceitos (ex.: '.com, .br').")
    nome = re.compile(r"(?<![\w@.-])(?:[a-z0-9-]+\.)+(?:" + "|".join(re.escape(f) for f in finais) + r")(?![a-z0-9-])(?:/[^\s<>\"']*)?")

    def achar(f: str) -> list:
        achados = [m.group(0) for m in _COM_PREFIXO.finditer(f)]
        achados += [m.group(0) for m in nome.finditer(_COM_PREFIXO.sub(" ", f))]  # sem contar duas vezes o que já tem http/www
        return [("site:" + _limpar(a), _limpar(a)) for a in achados if _limpar(a)]
    return achar


def _detector_de_email(f: str) -> list:
    achados = []
    for m in re.finditer("@", f):
        ini = m.start()
        while ini > 0 and f[ini - 1] in _LETRAS_DO_EMAIL and m.start() - ini < 64:
            ini -= 1
        dominio = _DOMINIO.match(f, m.end())
        if ini < m.start() and dominio:
            achados.append(f[ini:m.start()] + "@" + dominio.group(0))
    return [("email:" + a, a) for a in achados]


def _detector_de_arroba(f: str) -> list:
    return [("usuario:@" + m.group(1).rstrip("."), "@" + m.group(1).rstrip(".")) for m in _ARROBA.finditer(f)]


def _detector_de_telefone(padrao: str, id_):
    achou = re.search(r"(\d+)\s+ou\s+(\d+)\s+digitos", T.dobrar(padrao))
    if not achou:
        raise ErroDeContexto(f"{id_}: o padrão de telefone deve dizer quantos dígitos tem (ex.: '8 ou 9 dígitos').")
    locais = {int(achou.group(1)), int(achou.group(2))}
    permitidos = locais | {n + DIGITOS_DO_DDD for n in locais}

    def achar(f: str) -> list:
        achados = []
        for bloco in _BLOCO_DE_DIGITOS.finditer(f):
            texto = bloco.group(0)
            digitos = re.sub(r"\D", "", texto)
            com_pais = digitos.startswith("55") and len(digitos) - 2 in permitidos and (texto.startswith("+55") or len(digitos) not in permitidos)
            if com_pais:
                digitos = digitos[2:]  # tira o código do país (55)
            if len(digitos) in permitidos and not _PARECE_DATA.fullmatch(texto.strip(' .-()')):
                achados.append(("numero:" + digitos, texto.strip(" .-()")))
        return achados
    return achar


def _detector_de_mascara(modelo: str):
    """CPF (000.000.000-00), CEP (00000-000): cada 0 do modelo é um dígito e o resto é igual."""
    rx = re.compile(r"(?<!\d)" + "".join(r"\d" if c.isdigit() else re.escape(c) for c in modelo) + r"(?!\d)")
    return lambda f: [("numero:" + re.sub(r"\D", "", m.group(0)), m.group(0)) for m in rx.finditer(f)]


def _detectores(padroes, id_) -> list:
    """[(nome do contato, função)]. CPF e CEP rodam antes do telefone, para o mesmo número contar uma vez só."""
    com_modelo, telefones, outros = [], [], []
    for padrao in padroes:
        p = T.dobrar(padrao)
        nome = padrao.split(" (")[0].split(",")[0].strip()
        modelo = re.search(r"\(([0-9][0-9.\-/ ]*[0-9])\)", padrao)
        if p.startswith("endereco de site"):
            outros.append((nome, _detector_de_site(padrao, id_)))
        elif p.startswith("e-mail"):
            outros.append((nome, _detector_de_email))
        elif p.startswith("@usuario"):
            outros.append((nome, _detector_de_arroba))
        elif p.startswith("telefone"):
            telefones.append((nome, _detector_de_telefone(padrao, id_)))
        elif modelo:
            com_modelo.append((nome, _detector_de_mascara(modelo.group(1))))
        else:
            raise ErroDeContexto(f"{id_}: a especificação lista um tipo de contato que o código ainda não sabe conferir: '{padrao}'. "
                                 "Peça um detector novo em spec_copy_fatos.py.")
    return com_modelo + telefones + outros


def _contatos(texto: str, detectores) -> list:
    """[(chave, como está escrito, nome do contato)] sem repetir a mesma chave."""
    f = T.dobrar(texto)
    vistos, saida = set(), []
    for nome, achar in detectores:
        for chave, mostrar in achar(f):
            if chave not in vistos:
                vistos.add(chave)
                saida.append((chave, mostrar, nome))
    return saida


@da_spec("CHK-COPY-06", "Nenhum contato inventado",
         "O convite podia trazer link, e-mail, @perfil, telefone, CPF ou CEP que ninguém informou, e a pessoa mandaria dados a um contato falso.",
         ["DEC-023", "C-7"])
def sem_contato_inventado(exe, parametros):
    id_ = "CHK-COPY-06"
    detectores = _detectores(lista_de_textos(parametros, "padroes", id_), id_)
    fontes = fontes_aceitas(exe, lista_de_textos(parametros, "fontes_aceitas", id_), id_)
    aceitos = {chave for pagina in fontes.values() for chave, _, _ in _contatos(_texto_da_fonte(pagina), detectores)}
    falhas = []
    for caminho, texto in campos(exe, lista_de_textos(parametros, "onde", id_)):
        for chave, mostrar, nome in _contatos(texto, detectores):
            if chave not in aceitos:
                falhas.append(Falha(id_, "CONTATO_INVENTADO", caminho,
                                    f"O texto traz {nome} que não aparece igual no pedido nem no pacote ('{mostrar}'). Tire-o e diga em "
                                    "o_que_precisa_aprovacao qual canal falta.", T.cortar(frase_do_termo(texto, mostrar))))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-COPY-07: nenhum número solto
# ---------------------------------------------------------------------------------------
_NUMERO = re.compile(r"\d+(?:[.,]\d+)*")
_DATA = re.compile(r"(?<!\d)\d{1,2}/\d{1,2}/\d{4}(?!\d)")
_HORA = re.compile(r"(?<!\d)\d{1,2}:\d{2}(?!\d)")
_CODIGO_DE_REGISTRO = re.compile(r"\b[A-Za-z]+(?:-[A-Za-z]+)*-\d+\b")  # C-11 também é código, não quantidade
MAX_CARACTERES_DO_NUMERO = 40
# Escalas da língua que a especificação NÃO define (ela só diz 'mil'): sem elas, '10 milhões' valeria o mesmo que '10'.
ESCALAS_DA_LINGUA = {
    "k": Decimal(10) ** 3, "milhares": Decimal(10) ** 3,
    "milhao": Decimal(10) ** 6, "milhoes": Decimal(10) ** 6,
    "bilhao": Decimal(10) ** 9, "bilhoes": Decimal(10) ** 9,
    "trilhao": Decimal(10) ** 12, "trilhoes": Decimal(10) ** 12,
}


def valor_do_numero(literal: str):
    """O valor de um número escrito como a especificação manda: ponto separa milhar (1.234) e vírgula separa decimal (1,5).
    Forma que não segue isso (1.2.3, 1,2,3) devolve None. 3.5 (ponto com 1 casa) é lido como decimal."""
    try:
        if len(literal) > MAX_CARACTERES_DO_NUMERO:
            return None
        if "," in literal:
            inteiro, _, decimal = literal.rpartition(",")
            if "," in inteiro:
                return None
            if len(decimal) == 3 and "." not in inteiro and inteiro and not inteiro.startswith("0"):
                return None  # 10,000 é ambíguo entre vírgula decimal e milhar; não autentica nenhum valor
            if "." in inteiro:
                grupos = inteiro.split(".")
                if not (len(grupos[0]) <= 3 and all(len(g) == 3 for g in grupos[1:])):
                    return None
                inteiro = "".join(grupos)
            return Decimal(f"{inteiro}.{decimal}")
        if "." in literal:
            grupos = literal.split(".")
            if len(grupos[0]) <= 3 and not grupos[0].startswith("0") and all(len(g) == 3 for g in grupos[1:]):
                return Decimal("".join(grupos))
            return Decimal(literal) if len(grupos) == 2 else None
        return Decimal(literal)
    except InvalidOperation:
        return None


def _multiplicador(formato, id_) -> dict:
    """{palavra: fator} da frase da especificação ("'mil' depois do número multiplica por 1.000") mais as escalas da língua."""
    achou = re.search(r"'([^']+)'\s+depois do n[uú]mero multiplica por\s+([\d.,]+)", formato if isinstance(formato, str) else "")
    fator = valor_do_numero(achou.group(2)) if achou else None
    if not achou or fator is None:
        raise ErroDeContexto(f"{id_}: o parâmetro 'formato' deve dizer a palavra que multiplica (ex.: \"'mil' depois do número multiplica por 1.000\").")
    return {**ESCALAS_DA_LINGUA, T.dobrar(achou.group(1)): fator}


def _numeros_de(f: str, escalas: dict) -> list:
    """[(como está escrito, valor ou None)] dos números de um texto já em minúsculas, com 'mil' (e milhão...) multiplicando."""
    palavras = "|".join(re.escape(p) for p in sorted(escalas, key=len, reverse=True))
    saida = []
    for m in re.finditer(r"(\d+(?:[.,]\d+)*)(?:[\s-]*(" + palavras + r")\b)?", f):
        valor = valor_do_numero(m.group(1))
        if valor is not None and m.group(2):
            valor *= escalas[m.group(2)]
        saida.append((m.group(0).strip(), valor))
    return saida


def _frase_com_numero(texto: str, escrito: str) -> str:
    """A frase do texto em que o número aparece (para o relatório mostrar o trecho certo); se não achar, o texto todo."""
    numero = re.escape(escrito.split()[0])
    for frase in re.split(r"(?<=[.!?…])\s+", texto):
        if re.search(r"(?<![\d.,])" + numero + r"(?!\d)", frase):
            return frase
    return texto


def _numeros_da_fonte(pagina, escalas: dict, com_datas: bool):
    """(valores, datas e horas escritas) de uma fonte. Códigos como BIZ-003 e DEC-024 não contam como número."""
    n = _CODIGO_DE_REGISTRO.sub(" ", T.normalizar(_texto_da_fonte(pagina)))
    datas = {m.group(0) for rx in (_DATA, _HORA) for m in rx.finditer(n)} if com_datas else set()
    return {v for _, v in _numeros_de(T.dobrar(n), escalas) if v is not None}, datas


_UNIDADE = re.compile(r"\b(\d{1,12}(?:[.,]\d{1,12}){0,3})\s*(pessoas?|dias?|horas?|semanas?|minutos?|meses|%|h\b)")
_POR_EXTENSO = re.compile(r"\b(?:quinhentas|quinhentos|centenas|dez mil|duas semanas)\b")


def quantidade_sem_contexto(texto: str, fontes_texto: str) -> list:
    """Quantidades cuja unidade/escala não aparece junto da quantidade nas fontes."""
    t, fontes = T.dobrar(texto), T.dobrar(fontes_texto)
    soltas = []
    unidades_da_fonte = {
        (valor_do_numero(m.group(1)), m.group(2))
        for m in _UNIDADE.finditer(fontes)
    }
    for m in _UNIDADE.finditer(t):
        unidade = m.group(0)
        valor = valor_do_numero(m.group(1))
        if valor is None or (valor, m.group(2)) not in unidades_da_fonte:
            soltas.append(unidade)
    for m in _POR_EXTENSO.finditer(t):
        palavra = m.group(0)
        if palavra not in fontes:
            soltas.append(palavra)
    for m in re.finditer(r"\bvale\s+(\d+(?:[.,]\d+)*)\b", t):
        if not re.search(r"\bvale\s+" + re.escape(m.group(1)) + r"\b", fontes):
            soltas.append("vale " + m.group(1))
    if re.search(r"\b\d{1,2}/\d{1,2}\b", t) and not re.search(r"\b\d{1,2}/\d{1,2}\b", fontes):
        soltas.append("data parcial")
    return soltas


@da_spec("CHK-COPY-07", "Nenhum número solto",
         "O convite podia trazer número inventado (horas, pessoas, preço, prazo) que não vem do pedido nem do pacote, até a conta do Caio.",
         ["C-9", "C-11"])
def sem_numero_solto(exe, parametros):
    id_ = "CHK-COPY-07"
    escalas = _multiplicador(parametros.get("formato"), id_)
    ignora = [T.dobrar(x) for x in lista_de_textos(parametros, "ignora", id_, vazia_ok=True)]
    ignora_ids, ignora_datas = any(x.startswith("ids") for x in ignora), any(x.startswith("datas") for x in ignora)
    padrao_de_id = exe.parametros("CHK-COPY-08").get("ids")  # o modelo do id (A1 a A8) fica numa só checagem
    ids = re.compile(padrao_de_id) if ignora_ids and isinstance(padrao_de_id, str) else None
    fontes = fontes_aceitas(exe, lista_de_textos(parametros, "fontes_aceitas", id_), id_)
    aceitos, datas_aceitas = set(), set()
    for pagina in fontes.values():
        valores, datas = _numeros_da_fonte(pagina, escalas, ignora_datas)
        aceitos |= valores
        datas_aceitas |= datas
    texto_das_fontes = " ".join(_texto_da_fonte(p) for p in fontes.values())
    falhas = []
    for caminho, texto in campos(exe, lista_de_textos(parametros, "onde", id_)):
        n = T.normalizar(texto)
        if ids:
            n = re.sub(r"\w+", lambda m: " " if ids.fullmatch(m.group(0)) else m.group(0), n)
        datas_soltas = []

        def tratar(m):
            if m.group(0) not in datas_aceitas:
                datas_soltas.append(m.group(0))
            return " "
        if ignora_datas:
            n = _HORA.sub(tratar, _DATA.sub(tratar, n))
        soltos = []
        for escrito, valor in _numeros_de(T.dobrar(n), escalas):
            if valor is None or valor not in aceitos:
                soltos.append(escrito)
        soltos += quantidade_sem_contexto(n, texto_das_fontes)
        if soltos:
            lista = ", ".join(dict.fromkeys(soltos))
            falhas.append(Falha(id_, "NUMERO_SOLTO", caminho,
                                f"O texto tem número que não está no pedido nem no pacote ({lista}). Número só entra se vier de lá, com o mesmo valor; "
                                "a conta do Caio nunca entra no convite.", T.cortar(_frase_com_numero(texto, soltos[0]))))
        if datas_soltas:
            lista = ", ".join(dict.fromkeys(datas_soltas))
            falhas.append(Falha(id_, "DATA_OU_HORA_SOLTA", caminho,
                                f"O texto tem data ou hora que não está no pedido nem no pacote ({lista}). Data e hora só entram se vierem de lá; "
                                "senão peça a data em o_que_precisa_aprovacao.", T.cortar(frase_do_termo(texto, datas_soltas[0]))))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-COPY-08: afirmações com apoio
# ---------------------------------------------------------------------------------------
def _frase_esta_no_texto(frase: str, textos) -> bool:
    """A frase aparece igual (espaços repetidos e aspas tipográficas à parte; maiúscula e acento valem) numa das seções, em palavras inteiras."""
    f = T.normalizar(frase).strip()
    if not f:
        return False
    for texto in textos:
        a = T.normalizar(texto)
        inicio = a.find(f)
        for _ in range(50):
            if inicio < 0:
                break
            if _limite_de_palavra(a, inicio, inicio + len(f), f):
                return True
            inicio = a.find(f, inicio + 1)
    return False


def _apoio_e_literal(pagina, trecho: str, minimo: int, aceita_frase_inteira: bool):
    """None se o trecho é literal da fonte e tem `minimo` palavras seguidas ou (se aceito) é uma frase inteira; senão o motivo."""
    b = _texto_da_fonte(pagina)
    a = b.replace("\n", " ")  # mesma posição de cada letra, para olhar os fins de frase em `b`
    t = T.normalizar(trecho).strip(_PONTUACAO_DAS_PONTAS)  # sem pontuação nas pontas (como a CHK-COMUM-06): o fim da frase é olhado depois dela
    if not t:
        return "APOIO_VAZIO"
    existe, inicio = False, a.find(t)
    for _ in range(50):
        if inicio < 0:
            break
        fim = inicio + len(t)
        if _limite_de_palavra(a, inicio, fim, t):
            existe = True
            if T.contar_palavras(t) >= minimo or (aceita_frase_inteira and T.inicio_de_frase(b, inicio) and T.fim_de_frase(b, fim)):
                return None
        inicio = a.find(t, inicio + 1)
    return "APOIO_CURTO_DEMAIS" if existe else "APOIO_NAO_ESTA_NA_FONTE"


@da_spec("CHK-COPY-08", "Afirmações com apoio literal no pedido ou no pacote",
         "A tabela de afirmações podia citar um apoio que não existe, ou trazer uma frase que nem está no texto, e o fundador confiar na prova.",
         ["C-8", "M-15"])
def afirmacoes_com_apoio(exe, parametros):
    id_ = "CHK-COPY-08"
    try:
        modelo_do_id = re.compile(parametros.get("ids"))
    except (re.error, TypeError):
        raise ErroDeContexto(f"{id_}: o parâmetro 'ids' da especificação deve ser um modelo de texto (ex.: '^A[1-8]$').") from None
    minimo = parametros.get("minimo_palavras")
    if isinstance(minimo, bool) or not isinstance(minimo, int) or minimo < 1:
        raise ErroDeContexto(f"{id_}: o parâmetro 'minimo_palavras' da especificação deve ser um número inteiro maior que zero.")
    aceita_frase_inteira = parametros.get("aceita_frase_inteira") is True
    ids_do_modelo = {s.get("id") for s in exe.modelo.get("secoes") or []}
    for secao in (SECAO_AFIRMACOES, SECAO_VERSAO_FINAL, SECAO_ALTERNATIVA):
        if ids_do_modelo and secao not in ids_do_modelo:
            raise ErroDeContexto(f"{id_}: o modelo do serviço não tem a seção '{secao}'.")
    entrega = exe.acao_obj["entrega"]
    linhas = entrega.get(SECAO_AFIRMACOES)
    if not isinstance(linhas, list):
        return []  # seção ausente ou no formato errado: quem recusa é CHK-COMUM-01
    textos = [entrega[s] for s in (SECAO_VERSAO_FINAL, SECAO_ALTERNATIVA) if isinstance(entrega.get(s), str)]
    falhas, ids_vistos = [], set()

    def falhar(motivo, onde, mensagem, trecho=""):
        falhas.append(Falha(id_, motivo, onde, mensagem, T.cortar(trecho)))

    for i, linha in enumerate(linhas):
        if not isinstance(linha, dict):
            continue  # linha no formato errado: quem recusa é CHK-COMUM-01
        base = f"entrega.{SECAO_AFIRMACOES}[{i}]"
        id_da_linha = linha.get("id")
        if not isinstance(id_da_linha, str) or not modelo_do_id.fullmatch(id_da_linha):
            falhar("ID_FORA_DO_PADRAO", base + ".id", f"O id da afirmação deve seguir o padrão {modelo_do_id.pattern} (A1 a A8).", str(id_da_linha))
        elif id_da_linha in ids_vistos:
            falhar("ID_REPETIDO", base + ".id", f"O id {id_da_linha} aparece em mais de uma afirmação. Cada afirmação tem o seu.", id_da_linha)
        else:
            ids_vistos.add(id_da_linha)
        frase = linha.get("frase")
        if not isinstance(frase, str) or not _frase_esta_no_texto(frase, textos):
            falhar("FRASE_FORA_DO_TEXTO", base + ".frase",
                   "A frase da tabela não aparece igual na versão final nem na alternativa curta. Copie a frase do texto, palavra por palavra.",
                   frase if isinstance(frase, str) else "")
        elif re.fullmatch(r"(?i)(?:oi|ola|bom dia|boa tarde|boa noite)[.!?\s]*", T.dobrar(frase)):
            falhar("AFIRMACAO_TRIVIAL", base + ".frase", "A frase da tabela precisa trazer uma afirmação verificável do convite.", frase)
        apoio = linha.get("apoio")
        if not isinstance(apoio, dict) or not isinstance(apoio.get("trecho_original"), str):
            falhar("APOIO_AUSENTE", base + ".apoio", "A afirmação precisa de um apoio: o trecho literal do pedido ou do pacote ('trecho_original' e 'fonte_importada_id').")
            continue
        trecho = apoio["trecho_original"]
        if "leitura_id" in apoio:
            falhar("APOIO_DE_PAGINA_LIDA", base + ".apoio",
                   "A Isabela não lê página: o apoio vem do pedido ou do pacote (fonte_importada_id), nunca de uma leitura (leitura_id).", trecho)
            continue
        fonte_id = apoio.get("fonte_importada_id")
        if not isinstance(fonte_id, str) or not fonte_id.strip():
            falhar("APOIO_SEM_FONTE", base + ".apoio", "O apoio não diz de qual fonte veio. Informe fonte_importada_id (o pedido ou o pacote da empresa).", trecho)
        elif fonte_id not in exe.fontes:
            falhar("FONTE_INEXISTENTE", base + ".apoio", f"A fonte '{fonte_id}' não veio no pacote do card. Use a do pedido ou a do pacote da empresa.", trecho)
        else:
            motivo = _apoio_e_literal(exe.fontes[fonte_id], trecho, minimo, aceita_frase_inteira)
            if motivo == "APOIO_CURTO_DEMAIS":
                falhar(motivo, base + ".apoio",
                       f"O apoio é curto e não é uma frase inteira da fonte {fonte_id}. Cite a frase do começo ao fim ou {minimo} palavras seguidas.", trecho)
            elif motivo:
                falhar(motivo, base + ".apoio",
                       f"O apoio não é trecho literal da fonte {fonte_id}. Copie do pedido ou do pacote, igual, sem trocar nem juntar pedaços.", trecho)
            elif any(isinstance(outra, dict) and isinstance(outra.get("apoio"), dict)
                     and outra["apoio"].get("trecho_original") == trecho
                     for j, outra in enumerate(linhas) if j != i):
                falhar("APOIO_DE_OUTRA_AFIRMACAO", base + ".apoio",
                       "O mesmo trecho foi usado como apoio de outra afirmação. Use a fonte que trata desta afirmação.", trecho)
    return falhas
