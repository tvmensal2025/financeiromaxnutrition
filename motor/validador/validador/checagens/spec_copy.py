"""Checagens do tipo COPY (convite, legenda, mensagem) que olham listas de termos e tamanho: CHK-COPY-01 a 05, 09 e 10.

O que é: o código que confere o texto pronto da Isabela: a versão final, a alternativa curta e a coluna 'frase' da tabela
de afirmações. É determinístico (sem IA) e falha fechado: na dúvida, recusa.

De onde vem: a especificação, helena-v2/deliverables/copy.yaml, bloco 'checagens_codigo'. Os termos, os números e o lugar onde
olhar ficam LÁ, em 'parametros' de cada checagem; o motor entrega esse bloco ao validador (exe.parametros). Nenhuma lista ou
número daquele arquivo é copiado para cá. A lista da CHK-COPY-02 vem do pacote da empresa do card (contexto['pacote_da_empresa']).
O que o código sabe sozinho: os NOMES das seções do tipo (versao_final, alternativa_curta) e o nome do campo 'slogan' do pacote.

Como mudar:
  - proibir mais uma palavra: acrescente-a na lista da checagem, no copy.yaml (CHK-COPY-01, 03, 04, 05 ou 10);
  - termos proibidos de uma empresa: no pacote dela (termos_proibidos_em_todo_texto), nunca aqui;
  - tamanho da alternativa curta: os dois números da CHK-COPY-09, no copy.yaml;
  - a CHK-COPY-01 também usa a lógica de disfarces do CHK-GANHO-01 (letras trocadas por números, separadas, de outro alfabeto,
    símbolos de moeda e emojis), importada de ganho.py sem alterá-la: ela tem a lista própria, em dados/termos_de_ganho.json.
    Se uma palavra é proibida num lugar e liberada no outro, vale a regra mais rígida.

Sem os 'parametros' (contexto antigo, sem especificação) a checagem diz 'não se aplica'. Se ela está em modelo.checagens_a_rodar
e os parâmetros não vieram, o validador para com ErroDeContexto: nunca aprova sem conferir.

Os arquivos spec_copy_fatos.py (CHK-COPY-06, 07 e 08) usam as funções deste.
"""
import re
from decimal import Decimal, InvalidOperation

from .. import texto as T
from ..contexto import ErroDeContexto
from ..registro import checagem
from ..resultado import Falha
from . import ganho as _ganho  # só LÊ as peças do CHK-GANHO-01; nada lá é alterado

# Nomes do tipo copy que o código precisa conhecer (o resto vem dos parâmetros da especificação).
SECAO_VERSAO_FINAL = "versao_final"
SECAO_ALTERNATIVA = "alternativa_curta"
CHAVE_DO_SLOGAN = "slogan"  # nome do campo no pacote da empresa (organograma.yaml)

_TOKEN = re.compile(r"[a-z0-9]+")
_LEET_DE_NUMERO = {k: v for k, v in _ganho._LEET.items() if k.isdigit()}
_SEPARADORES_DE_LETRA_SOLTA = re.compile(r"[ \t.\-_*]+")
_DISFARCES_VISUAIS = str.maketrans({"ᅠ": "", "ᅟ": "", "ㅤ": "", "⠀": "", "ﾠ": "", "ø": "o", "օ": "o", "ɢ": "g", "ʀ": "r", "ɴ": "n"})


def _dobrar_busca(texto: str) -> str:
    return T.dobrar(texto).translate(_DISFARCES_VISUAIS).replace("@", "a")


# ---------------------------------------------------------------------------------------
# Peças comuns (usadas também por spec_copy_fatos.py)
# ---------------------------------------------------------------------------------------
def da_spec(id_, nome, o_que_fecha, fecha_furos, gravidade="RECUSA"):
    """Registra uma checagem da especificação. A função recebe (exe, parametros) e devolve a lista de Falha.

    Devolve None (não se aplica) quando a resposta não é uma entrega no formato certo (quem recusa é CHK-ACAO-01/CHK-COMUM-01) e
    quando não há parâmetros num contexto antigo. Se a checagem está em checagens_a_rodar mas os parâmetros faltam: ErroDeContexto.
    """
    def decorador(funcao):
        def rodar(exe):
            if exe.acao != "ENTREGAR" or not exe.formato_ok:
                return None
            parametros = exe.parametros(id_)
            if not parametros:
                if id_ in (exe.modelo.get("checagens_a_rodar") or []):
                    raise ErroDeContexto(f"{id_} está em modelo.checagens_a_rodar, mas o modelo não traz os parâmetros dela "
                                         "(modelo.parametros_das_checagens): sem eles não dá para conferir.")
                return None
            return funcao(exe, parametros)

        rodar.__name__, rodar.__doc__ = funcao.__name__, funcao.__doc__
        return checagem(id_, nome, o_que_fecha, fecha_furos, gravidade)(rodar)
    return decorador


def lista_de_textos(parametros, chave, id_, vazia_ok=False) -> list:
    """Uma lista de textos do bloco 'parametros'. Parâmetro mal escrito para tudo com uma mensagem clara."""
    valor = parametros.get(chave)
    if not isinstance(valor, list) or (not valor and not vazia_ok) or not all(isinstance(x, str) and x.strip() for x in valor):
        raise ErroDeContexto(f"{id_}: o parâmetro '{chave}' da especificação deve ser uma lista de textos"
                             f"{'' if vazia_ok else ' não vazia'}.")
    return valor


def _conferir_onde(exe, onde):
    """Um 'onde' com seção ou coluna que o modelo não tem (erro de digitação no copy.yaml) deixaria de olhar o texto em silêncio: para tudo."""
    secoes = {s.get("id"): s for s in exe.modelo.get("secoes") or []}
    for lugar in onde:
        secao, _, coluna = lugar.partition(".")
        if secoes and secao not in secoes:
            raise ErroDeContexto(f"A especificação manda olhar '{lugar}', mas o modelo do serviço não tem a seção '{secao}'.")
        if secoes and coluna and coluna not in {c.get("id") for c in secoes[secao].get("colunas") or []}:
            raise ErroDeContexto(f"A especificação manda olhar '{lugar}', mas a seção '{secao}' não tem a coluna '{coluna}'.")


def campos(exe, onde) -> list:
    """[(caminho do campo, texto)] dos lugares de `onde`: 'secao' (o texto todo) ou 'secao.coluna' (essa coluna de cada linha da tabela).

    As linhas de um mesmo campo são juntadas com espaço, para um termo de duas palavras não escapar por uma quebra de linha.
    Só entra o que o agente escreveu (os trechos citados de pedido e pacote não são 'texto que sai').
    """
    _conferir_onde(exe, onde)
    juntos = {}
    for item in exe.itens:
        if item.tipo != "livre":
            continue
        base = item.caminho.split("#linha")[0]
        for lugar in onde:
            secao, _, coluna = lugar.partition(".")
            if item.secao == secao and (not coluna or re.search(rf"\.{re.escape(coluna)}(?:\[\d+\])*$", base)):
                juntos.setdefault(base, []).append(item.texto)
                break
    return [(caminho, " ".join(textos)) for caminho, textos in juntos.items()]


def _leitura_com_numeros(tokens, troca_do_um):
    """r3ais -> reais: troca números por letras só nas palavras que misturam letras e números."""
    mapa = {**_LEET_DE_NUMERO, "1": troca_do_um}
    saida = []
    for tk in tokens:
        misturado = any(c.isalpha() for c in tk) and any(c in mapa for c in tk)
        saida.append("".join(mapa.get(c, c) for c in tk) if misturado else tk)
    return saida


def _calcular_visoes(texto: str) -> list:
    """O mesmo texto lido de cinco jeitos, cada um como ' palavra palavra ' (sem acento, minúsculo):
    como está; sem separadores dentro da palavra (g-a-r-a-n-t-i-d-o); com letras soltas juntadas (g a r a n t i d o); e
    com números no lugar de letras (g4rantido), lendo o 1 como i ou como l. Letras de outro alfabeto, largas ou invisíveis
    já são tratadas por T.dobrar."""
    f = _dobrar_busca(texto)
    plano = _TOKEN.findall(f)
    leituras = [
        plano,
        _TOKEN.findall(_ganho._SEPARADORES_INTERNOS.sub("", f)),
        _TOKEN.findall(_ganho._LETRAS_SOLTAS.sub(lambda m: " " + _SEPARADORES_DE_LETRA_SOLTA.sub("", m.group(0)) + " ", f)),
        _leitura_com_numeros(plano, "i"),
        _leitura_com_numeros(plano, "l"),
    ]
    return [" " + " ".join(l) + " " for l in leituras if l]


def visoes(exe, texto: str) -> list:
    return exe.memo(("copy-visoes", texto), lambda: _calcular_visoes(texto))


def _termo_normal(termo: str) -> str:
    return " ".join(_TOKEN.findall(T.dobrar(termo)))


def achar(exe, texto: str, termos) -> list:
    """Os termos da lista que aparecem no texto: palavra inteira ou expressão inteira, sem diferenciar maiúscula nem acento."""
    vistas = visoes(exe, texto)
    dobrado = _dobrar_busca(texto) if len(texto) <= 5000 else ""
    achados = []
    for termo in termos:
        t = _termo_normal(termo)
        separado = (dobrado and 3 <= len(t) <= 9 and " " not in t and
                    re.search(r"(?<![a-z0-9])" + r"[ \t.\-_*]+".join(map(re.escape, t)) + r"(?![a-z0-9])",
                              dobrado))
        if t and (separado or any(f" {t} " in v for v in vistas)):
            achados.append(termo)
    return achados


def termos_com_variantes_de_vinculo(termos) -> list:
    """Formas imediatas dos termos de vínculo já proibidos pelo pacote."""
    normalizados = {_termo_normal(t) for t in termos}
    variantes = {
        "emprego": ("empregos", "empregado", "empregada", "empregados", "empregadas"),
        "contratacao": ("contratando", "contratar", "contratado", "contratada", "contratados", "contratadas"),
        "vaga de trabalho": ("vagas de trabalho",),
        "carteira assinada": ("CLT",),
    }
    return list(termos) + [v for chave, formas in variantes.items() if chave in normalizados for v in formas]


def frase_do_termo(texto: str, termo: str) -> str:
    """A frase do texto em que o termo aparece (para o relatório mostrar o trecho certo); se não achar, o texto todo."""
    t = _termo_normal(termo)
    for frase in re.split(r"(?<=[.!?…])\s+", texto):  # só para mostrar o trecho: não mexe nas letras (eLiving™ continua eLiving™)
        if termo.lower() in frase.lower() or (t and any(f" {t} " in v for v in _calcular_visoes(frase))):
            return frase
    return texto


def conferir_lista(exe, parametros, id_, motivo, termos, mensagem) -> list:
    """Uma Falha por campo de `onde` que tem algum termo da lista. `mensagem` leva {termos} no lugar da lista achada."""
    falhas = []
    for caminho, texto in campos(exe, lista_de_textos(parametros, "onde", id_)):
        achados = achar(exe, texto, termos)
        if achados:
            citados = ", ".join(f"'{a}'" for a in achados[:5])
            falhas.append(Falha(id_, motivo, caminho, mensagem.format(termos=citados), T.cortar(frase_do_termo(texto, achados[0]))))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-COPY-01: sem termo de ganho
# ---------------------------------------------------------------------------------------
def _slogan(exe):
    pacote = exe.contexto.get("pacote_da_empresa")
    slogan = pacote.get(CHAVE_DO_SLOGAN) if isinstance(pacote, dict) else None
    return " ".join(slogan.split()) if isinstance(slogan, str) and slogan.strip() else None


def _sem_o_slogan(texto: str, slogan) -> str:
    """O texto sem o slogan oficial do pacote, escrito igual ao pacote (a única exceção da CHK-COPY-01)."""
    if not slogan:
        return texto
    return " . ".join(" ".join(texto.split()).split(slogan))


def _simbolos_em(texto: str, simbolos) -> list:
    f = T.dobrar(texto)
    return [s for s in simbolos if T.dobrar(s) in f]


@da_spec("CHK-COPY-01", "Convite sem termo de ganho (lista do tipo copy)",
         "O convite podia prometer renda ou dinheiro, até para negar ('sem promessa de renda'); o texto vai a estranhos em nome do fundador.",
         ["C-11"])
def sem_termo_de_ganho(exe, parametros):
    id_ = "CHK-COPY-01"
    termos = lista_de_textos(parametros, "termos", id_)
    simbolos = lista_de_textos(parametros, "simbolos", id_, vazia_ok=True)
    slogan = _slogan(exe)
    falhas = []
    for caminho, texto in campos(exe, lista_de_textos(parametros, "onde", id_)):
        t = _sem_o_slogan(texto, slogan)
        achados = achar(exe, t, termos) + _simbolos_em(t, simbolos)
        disfarce = _ganho._acha(t)  # a lógica do CHK-GANHO-01: números por letras, letras soltas, $50, emojis de dinheiro...
        if disfarce and _termo_normal(disfarce) not in {_termo_normal(a) for a in achados}:
            achados.append(disfarce)
        if achados:
            citados = ", ".join(f"'{a}'" for a in achados[:5])
            falhas.append(Falha(id_, "TERMO_DE_GANHO", caminho,
                                f"O texto tem termo de ganho ({citados}). O convite não fala de dinheiro, renda nem ganho, nem para negar. "
                                "Tire a palavra; só o slogan oficial do pacote, escrito igual, é aceito.", T.cortar(frase_do_termo(t, achados[0]))))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-COPY-02: nenhum termo proibido pelo pacote da empresa
# ---------------------------------------------------------------------------------------
def _termos_do_pacote(exe, parametros, id_):
    """A lista do pacote. O nome do campo vem da própria especificação (parametros['fonte'], depois dos dois-pontos)."""
    fonte = parametros.get("fonte")
    achou = re.search(r":\s*([A-Za-z_][A-Za-z0-9_]*)\s*$", fonte) if isinstance(fonte, str) else None
    if not achou:
        raise ErroDeContexto(f"{id_}: o parâmetro 'fonte' deve terminar com o nome do campo do pacote (ex.: '...: termos_proibidos_em_todo_texto').")
    pacote = exe.contexto.get("pacote_da_empresa")
    termos = pacote.get(achou.group(1)) if isinstance(pacote, dict) else None
    if termos is None or termos == []:
        return []  # a especificação manda passar quando o pacote não tem lista (a faixa do card avisa 'pacote sem lista de termos')
    if not isinstance(termos, list) or not all(isinstance(t, str) and t.strip() for t in termos):
        raise ErroDeContexto(f"O pacote da empresa traz '{achou.group(1)}' mal escrito: deve ser uma lista de textos.")
    return termos


@da_spec("CHK-COPY-02", "Nenhum termo proibido pelo pacote da empresa",
         "O pacote de cada empresa tem palavras que ela não admite em texto nenhum; sem conferir, um convite podia usá-las.",
         ["DEC-023", "DEC-024", "DEC-025"])
def sem_termo_proibido_do_pacote(exe, parametros):
    termos = _termos_do_pacote(exe, parametros, "CHK-COPY-02")
    if not termos:
        return []
    return conferir_lista(exe, parametros, "CHK-COPY-02", "TERMO_PROIBIDO_DO_PACOTE", termos_com_variantes_de_vinculo(termos),
                          "O texto tem termo que o pacote da empresa proíbe ({termos}). Reescreva sem ele.")


# ---------------------------------------------------------------------------------------
# CHK-COPY-03 e 04: promessa e pressão; orientação de saúde
# ---------------------------------------------------------------------------------------
@da_spec("CHK-COPY-03", "Sem promessa nem pressão da lista fechada",
         "Garantia, 'sem risco' e urgência inventada ('últimas vagas', 'corra') convenciam a pessoa sem base.",
         ["C-11", "C-13"])
def sem_promessa_nem_pressao(exe, parametros):
    termos = lista_de_textos(parametros, "termos", "CHK-COPY-03")
    return conferir_lista(exe, parametros, "CHK-COPY-03", "PROMESSA_OU_PRESSAO", termos,
                          "O texto promete ou pressiona ({termos}), mesmo negando. Tire a promessa ou a pressa: a pessoa decide com calma.")


@da_spec("CHK-COPY-04", "Sem orientação de saúde da lista fechada",
         "Diagnóstico, remédio, cura e emagrecimento num convite viravam orientação de saúde que ninguém habilitado deu.",
         ["DEC-023", "C-13"])
def sem_orientacao_de_saude(exe, parametros):
    termos = lista_de_textos(parametros, "termos", "CHK-COPY-04")
    return conferir_lista(exe, parametros, "CHK-COPY-04", "ORIENTACAO_DE_SAUDE", termos,
                          "O texto fala de saúde com termo da lista ({termos}), mesmo negando. O convite não dá orientação de saúde.")


# ---------------------------------------------------------------------------------------
# CHK-COPY-05: a eLiving não vira app de calorias (só no card da empresa que a especificação nomeia)
# ---------------------------------------------------------------------------------------
def _empresas_do_card(exe) -> set:
    """Códigos de empresa que o contexto cita para este card (pacote, ordem de serviço, pedido)."""
    achadas = set()

    def olhar(no):
        if isinstance(no, dict) and isinstance(no.get("empresa"), str):
            achadas.add(no["empresa"])

    pedido = exe.contexto.get("pedido")
    olhar(exe.contexto.get("pacote_da_empresa"))
    if isinstance(pedido, dict):
        card = pedido.get("card") if isinstance(pedido.get("card"), dict) else {}
        for no in (pedido, pedido.get("ordem_de_servico"), card, card.get("ordem_de_servico")):
            olhar(no)
    return achadas


@da_spec("CHK-COPY-05", "A eLiving não vira app de calorias",
         "O convite da eLiving podia falar de calorias, dieta ou app fitness e desfazer o posicionamento da marca (DEC-023).",
         ["DEC-023"])
def eliving_sem_app_de_calorias(exe, parametros):
    id_ = "CHK-COPY-05"
    empresa = parametros.get("so_empresa")
    if not isinstance(empresa, str) or not empresa.strip():
        raise ErroDeContexto(f"{id_}: o parâmetro 'so_empresa' da especificação deve ser o código de uma empresa.")
    empresas = _empresas_do_card(exe)
    if not empresas:
        raise ErroDeContexto(f"{id_}: o contexto não diz de qual empresa é o card; sem isso não dá para saber se a regra da {empresa} vale.")
    if empresa not in empresas:
        return None  # outra empresa: não se aplica
    termos = lista_de_textos(parametros, "termos", id_)
    return conferir_lista(exe, parametros, id_, "ELIVING_COMO_APP_DE_CALORIAS", termos,
                          "O texto da eLiving™ tem termo de caloria, dieta ou app fitness ({termos}), mesmo negando. "
                          "A eLiving™ é inteligência pessoal de evolução.")


# ---------------------------------------------------------------------------------------
# CHK-COPY-09: a alternativa é curta de verdade
# ---------------------------------------------------------------------------------------
def _decimal_do_parametro(parametros, chave, id_) -> Decimal:
    try:
        valor = Decimal(str(parametros.get(chave)))
        if valor.is_finite() and valor > 0:
            return valor
    except InvalidOperation:
        pass
    raise ErroDeContexto(f"{id_}: o parâmetro '{chave}' da especificação deve ser um número maior que zero.")


@da_spec("CHK-COPY-09", "A alternativa é curta de verdade",
         "A 'alternativa curta' podia vir quase do tamanho da versão final e não servir de alternativa.",
         ["CONF-21"])
def alternativa_curta_de_verdade(exe, parametros):
    id_ = "CHK-COPY-09"
    maximo = _decimal_do_parametro(parametros, "maximo_caracteres", id_)
    proporcao = _decimal_do_parametro(parametros, "maximo_proporcao", id_)
    ids_do_modelo = {s.get("id") for s in exe.modelo.get("secoes") or []}
    for secao in (SECAO_VERSAO_FINAL, SECAO_ALTERNATIVA):
        if ids_do_modelo and secao not in ids_do_modelo:
            raise ErroDeContexto(f"{id_}: o modelo do serviço não tem a seção '{secao}'.")
    entrega = exe.acao_obj["entrega"]
    final, alternativa = entrega.get(SECAO_VERSAO_FINAL), entrega.get(SECAO_ALTERNATIVA)
    if not isinstance(final, str) or not isinstance(alternativa, str):
        return []  # seção ausente ou no formato errado: quem recusa é CHK-COMUM-01
    n_final, n_alt = len(final.strip()), len(alternativa.strip())
    caminho = f"entrega.{SECAO_ALTERNATIVA}"
    falhas = []
    if n_alt > maximo:
        falhas.append(Falha(id_, "ALTERNATIVA_GRANDE_DEMAIS", caminho,
                            f"A alternativa curta tem {n_alt} caracteres e o máximo é {maximo}. Corte até caber.", f"{n_alt} > {maximo}"))
    if n_alt > proporcao * n_final:
        limite = int(proporcao * n_final)
        falhas.append(Falha(id_, "ALTERNATIVA_COMPRIDA_COMO_A_FINAL", caminho,
                            f"A alternativa curta tem {n_alt} caracteres e a versão final tem {n_final}: ela pode ter no máximo "
                            f"{proporcao * 100:.0f}% do tamanho da final (até {limite}). Faça uma versão mesmo mais curta.", f"{n_alt} > {limite}"))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-COPY-10: não pedir dado sensível
# ---------------------------------------------------------------------------------------
@da_spec("CHK-COPY-10", "Sem pedir dado sensível no canal aberto",
         "O convite podia pedir CPF, senha, código de verificação ou foto de documento numa conversa aberta.",
         ["C-11", "M-13"])
def sem_pedir_dado_sensivel(exe, parametros):
    id_ = "CHK-COPY-10"
    termos = lista_de_textos(parametros, "termos", id_)
    lista_de_textos(parametros, "siglas_maiusculas_palavra_inteira", id_, vazia_ok=True)
    falhas = []
    for caminho, texto in campos(exe, lista_de_textos(parametros, "onde", id_)):
        achados = achar(exe, texto, termos)
        if achados:
            citados = ", ".join(f"'{a}'" for a in achados[:5])
            falhas.append(Falha(id_, "DADO_SENSIVEL_PEDIDO", caminho,
                                f"O texto pede ou cita dado sensível ({citados}), mesmo negando. Não peça isso num canal aberto.",
                                T.cortar(frase_do_termo(texto, achados[0]))))
    return falhas
