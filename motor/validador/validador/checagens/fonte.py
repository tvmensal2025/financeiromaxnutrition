"""Checagens sobre FONTES:

CHK-FONTE-01  "fonte oficial" só se o site é o do link do pedido (sites parecidos não valem).
CHK-FONTE-02  "a página não fala de X" só com os termos buscados e todas as partes lidas.
CHK-FONTE-03  no jurídico, os termos de uso precisam ter sido lidos por inteiro.
"""
import re

from .. import enderecos as E
from .. import texto as T
from ..execucao import lista_ou_vazia
from ..registro import CONFIG, checagem
from ..resultado import Falha

ID1, ID2, ID3 = "CHK-FONTE-01", "CHK-FONTE-02", "CHK-FONTE-03"

# ---- "fonte oficial"
_SUBSTANTIVOS = ("fonte|fontes|site|sites|pagina|paginas|portal|canal|canais|comunicado|comunicados|conta|perfil|documento|documentos|termos|politica|"
                 "regulamento|regras|informacao|informacoes|dados|documentacao|publicacao|anuncio|declaracao|versao")
_OFICIAL = re.compile(r"\b(?:" + _SUBSTANTIVOS + r")\s+(?:[a-z]+\s+){0,2}(?:oficial|oficiais)\b|\boficialmente\b")


def _fala_de_fonte_oficial(texto: str) -> bool:
    """O texto chama algo de 'oficial'? ('Diário Oficial' é o nome de um jornal, não conta.)"""
    f = T.dobrar(texto).replace("diario oficial", " ").replace("diarios oficiais", " ")
    return bool(_OFICIAL.search(f))


def _hosts_citados(exe, grupo) -> list:
    """Sites das páginas lidas que o grupo cita + sites escritos no texto. Fonte importada não entra (veio aprovada no pacote)."""
    hosts = []
    for c in grupo.citacoes:
        p = exe.pagina(c.dados.get("leitura_id"))
        if p is not None:
            hosts.append((c.caminho, p.url))
    for u in T.achar_urls(grupo.texto):
        hosts.append((grupo.caminho, u))
    return hosts


@checagem(ID1, "Fonte 'oficial' é o site do link do pedido",
          "Um site parecido (sufixo, subdomínio, letras trocadas) podia ser chamado de 'fonte oficial' e enganar o fundador.",
          ["C-8"])
def fonte_oficial(exe):
    if exe.acao != "ENTREGAR":
        return None
    falhas, vistos = [], set()
    aceitar_sub = CONFIG["oficial"]["aceitar_subdominios"]
    for i in exe.itens:
        if i.tipo != "livre" or not _fala_de_fonte_oficial(i.texto) or i.grupo is None or id(i.grupo) in vistos:
            continue
        vistos.add(id(i.grupo))
        g = i.grupo
        usa_importada = any("fonte_importada_id" in c.dados for c in g.citacoes)
        origens = _hosts_citados(exe, g)
        if not origens:
            if usa_importada:
                continue
            falhas.append(Falha(ID1, "OFICIAL_SEM_FONTE_APONTADA", g.caminho,
                                "A frase chama algo de 'oficial' mas não aponta a página (citação ou link). Aponte a página lida.", T.cortar(i.texto)))
            continue
        if not exe.links_do_pedido:
            falhas.append(Falha(ID1, "OFICIAL_SEM_LINK_DO_PEDIDO", g.caminho,
                                "O pedido não trouxe nenhum link: não há como confirmar que a página é oficial. Não use a palavra 'oficial'.", T.cortar(i.texto)))
            continue
        for caminho, url in origens:
            if not any(E.mesmo_site(url, ped, aceitar_sub) for ped in exe.links_do_pedido):
                falhas.append(Falha(ID1, "FONTE_OFICIAL_DE_OUTRO_SITE", caminho,
                                    f"A frase chama de oficial a página {url}, mas o site não é o do link do pedido ({', '.join(exe.links_do_pedido)}). Cuidado com sites parecidos.", url))
                break
    return falhas


# ---- "a página não fala de X"
_SUJEITO = r"(?:pagina|site|termos(?: de uso)?|politica(?: de [a-z]+)?|regulamento|contrato|documento|plataforma|portal|faq|central de ajuda|fonte|clausulas?)"
_NAO_FALA = (r"nao\s+(?:fala|falam|menciona|mencionam|cita|citam|trata|tratam|aborda|abordam|diz|dizem|preve|preveem|contem|possui|possuem|tem|traz|trazem|"
             r"apresenta|apresentam|define|definem|estabelece|estabelecem|regula|regulam|especifica|especificam|esclarece|esclarecem|informa|informam|"
             r"explica|explicam|comenta|comentam|detalha|detalham)\b")
_AUSENCIA = [
    re.compile(r"\b" + _SUJEITO + r"\b[^.!?\n]{0,80}?\b" + _NAO_FALA),
    re.compile(r"\bnao\s+(?:consta|constam|ha|existe|existem)\s+(?:nenhum\w*|qualquer|mencao|referencia|clausula|previsao|regra|nada)"),
    re.compile(r"\bnao\s+encontrei\s+(?:nenhum\w*|qualquer|mencao)"),
    re.compile(r"\bnenhuma\s+(?:mencao|referencia|clausula|previsao)"),
    re.compile(r"\bsem\s+(?:qualquer\s+)?mencao\b"),
    re.compile(r"\bsilenci\w+|\bomiss[ao]\b|\bomit\w+|\bnada\s+(?:consta|diz|fala)\s+sobre\b"),
    re.compile(r"\bnao\s+(?:aparece|aparecem)\b|\bnao\s+faz(?:em)?\s+(?:mencao|referencia)|\bausencia\s+d[eao]s?\b"),
]


def afirma_ausencia(texto: str) -> bool:
    f = T.dobrar(texto)
    return any(rx.search(f) for rx in _AUSENCIA)


def _singular(palavra: str) -> str:
    """Singular simples (sem acento): comissoes -> comissao, animais -> animal, papeis -> papel, mulheres -> mulher."""
    if len(palavra) <= 3:
        return palavra
    for fim, troca in (("oes", "ao"), ("aes", "ao"), ("ais", "al"), ("eis", "el"), ("ois", "ol"), ("res", "r"), ("ns", "m")):
        if palavra.endswith(fim):
            return palavra[: -len(fim)] + troca
    return palavra[:-1] if palavra.endswith("s") else palavra


def _radical(termo: str) -> str:
    """Raiz do termo para achar também o plural e variações (comissões -> comiss)."""
    t = " ".join(_singular(p) for p in T.dobrar(termo).split())
    if len(t) >= 6:
        return t[:-2]
    if len(t) >= 5:
        return t[:-1]
    return t


def _procura(texto_dobrado: str, termo: str):
    r = _radical(termo)
    return re.search(r"(?<![a-z0-9])" + re.escape(r).replace(r"\ ", r"\s+"), texto_dobrado)


@checagem(ID2, "Afirmação de ausência com termos buscados e leitura completa",
          "'A página não fala de X' era escrito sem ter procurado X, ou sem ter lido a página inteira.",
          ["C-8", "M-15"])
def ausencia_comprovada(exe):
    if exe.acao != "ENTREGAR":
        return None
    falhas, vistos, achou = [], set(), False
    for i in exe.itens:
        if i.tipo != "livre" or i.grupo is None or id(i.grupo) in vistos or not afirma_ausencia(i.texto):
            continue
        vistos.add(id(i.grupo))
        achou = True
        g, a = i.grupo, i.grupo.ausencia

        def erro(motivo, msg, trecho=None):
            falhas.append(Falha(ID2, motivo, g.caminho, msg, T.cortar(trecho if trecho is not None else i.texto)))

        if not isinstance(a, dict):
            erro("AUSENCIA_SEM_PROVA", "A frase diz que a página não fala de algo, mas o item não traz o campo 'ausencia' com os termos buscados e as partes lidas.")
            continue
        termos = a.get("termos_buscados")
        if not (isinstance(termos, list) and termos and all(isinstance(t, str) and len(t.strip()) >= 3 for t in termos)):
            erro("SEM_TERMOS_BUSCADOS", "Diga em 'ausencia.termos_buscados' quais termos você procurou (lista de textos com pelo menos 3 letras).")
            continue
        pagina = exe.pagina(a.get("leitura_id"))
        if pagina is None:
            erro("PAGINA_NAO_LIDA", f"A página '{a.get('leitura_id')}' não foi lida nesta execução.")
            continue
        faltando = pagina.partes_faltando()
        declaradas = {n for n in lista_ou_vazia(a.get("partes_lidas")) if isinstance(n, int) and not isinstance(n, bool)}
        if faltando or not set(range(1, pagina.partes_total + 1)) <= declaradas:
            erro("LEITURA_INCOMPLETA",
                 f"Para dizer que a página não fala de algo é preciso ter lido TODAS as partes. A página tem {pagina.partes_total} partes; "
                 f"foram lidas {len(pagina.partes)}{'' if not faltando else ' (faltam ' + ', '.join(map(str, faltando)) + ')'}; a resposta declarou {sorted(declaradas)}.")
            continue
        frase = T.dobrar(g.texto)
        if not any(_procura(frase, t) for t in termos):
            erro("TERMOS_NAO_APARECEM_NA_FRASE", "Nenhum dos termos buscados aparece na frase: a frase fala de uma coisa e a busca foi de outra.")
            continue
        for n in sorted(pagina.partes):
            achado = next((t for t in termos if _procura(pagina.parte_dobrada(n), t)), None)
            if achado:
                erro("TERMO_ENCONTRADO_NA_PAGINA", f"O termo '{achado}' aparece na página (parte {n}). A frase está errada.", achado)
                break
    return falhas if achou else None


@checagem(ID3, "Termos de uso lidos por inteiro (jurídico)",
          "O parecer jurídico podia se apoiar em termos de uso lidos só em parte.",
          ["C-8"])
def termos_lidos_por_inteiro(exe):
    if exe.acao != "ENTREGAR" or not exe.opcao("exigir_termos_lidos_por_inteiro", False):
        return None
    termos = [p for p in exe.paginas.values() if p.tipo == "termos_de_uso"]
    if not termos:
        return [Falha(ID3, "NENHUM_TERMO_LIDO", "contexto.paginas_lidas",
                      "Este serviço exige ter lido os termos de uso por inteiro, mas nenhuma página de termos foi lida nesta execução.")]
    falhas = []
    for p in termos:
        if p.partes_faltando():
            falhas.append(Falha(ID3, "TERMOS_LIDOS_EM_PARTE", f"contexto.paginas_lidas[{p.leitura_id}]",
                                f"Os termos de uso ({p.url}) foram lidos em parte: faltam as partes {', '.join(map(str, p.partes_faltando()))} de {p.partes_total}.", p.url))
    return falhas
