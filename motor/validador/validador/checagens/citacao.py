"""CHK-COMUM-06: toda citação é trecho CONTÍNUO de página lida NESTA execução.

Regras (cada uma tem um `motivo` próprio no relatório):
  - a citação aponta UMA origem: página lida (leitura_id + parte) ou fonte importada (fonte_importada_id);
  - a página tem de estar entre as lidas nesta execução (não vale página de outra execução nem inventada);
  - o trecho tem de existir, igual, na parte apontada — depois de igualar aspas, espaços, travessões e
    maiúsculas (acento NÃO é ignorado: citação é literal);
  - trecho CONTÍNUO: pedaços emendados ("..." no meio) são recusados;
  - tem de ter 12 palavras ou mais, ou ser uma FRASE INTEIRA da página (começa onde a frase começa e termina onde termina);
  - não pode começar nem terminar no meio de uma palavra;
  - citação em outra língua precisa de `traducao` em campo à parte (o original é o que se confere);
  - a citação tem de combinar com a afirmação: mesmo número de cláusula e ao menos uma palavra em comum;
  - se a afirmação cita um site, a citação tem de ser desse site;
  - seção que exige citação, ou frase que se apoia em página ("segundo os termos..."), não pode vir sem citação.
"""
import re
from dataclasses import dataclass

from .. import enderecos as E
from .. import texto as T
from ..registro import CONFIG, checagem
from ..resultado import Falha
from . import idioma
from . import leis as _leis

ID = "CHK-COMUM-06"
MAX_OCORRENCIAS = 50
_PONTUACAO_DAS_PONTAS = " .,;:!?…"
_RETICENCIAS = re.compile(r"\.{2,}|…|\[\s*(?:\.{2,}|…)\s*\]|\(\s*(?:\.{2,}|…)\s*\)")

# Frases que dizem "isto vem de uma página/site/termos" — precisam de citação.
_ATRIBUICAO = [
    re.compile(r"\b(?:segundo|conforme|de acordo com|consoante)\s+(?:a|o|os|as)?\s*(?:pagina|site|termos|politica|regulamento|plataforma|portal|faq|central de ajuda|documento)\b"),
    re.compile(r"\b(?:a|o|os|as)\s+(?:pagina|site|plataforma|portal|termos(?: de uso)?|politica de \w+|regulamento)\s+(?:diz|dizem|afirma|afirmam|informa|informam|exige|exigem|proibe|proibem|permite|permitem|cobra|cobram|preve|preveem|estabelece|estabelecem|declara|declaram|determina|determinam|limita|limitam|garante|garantem)\b"),
]

_ROTULO = re.compile(r"(?:cl[aá]usula|se[cç][aã]o|artigo|art\.?|cap[ií]tulo|section|clause|article|chapter)\s*(\d+(?:\.\d+)*)", re.I)
_TITULO_NUMERADO = re.compile(r"(?m)^(\d+(?:\.\d+)*)[.)]?\s+\S")

_PARADAS = set("""para como pelo pela pelos pelas isso esta este essa esse mais muito sobre entre onde quando qual quais cada
todos todas outro outra outros outras pode podem deve devem sera tambem apenas ainda mesmo seus suas seu sua nossa nosso
pagina site termos plataforma documento segundo conforme acordo afirma informa diz preve estabelece contem texto
that this with from have will your must shall they their which than then when what been were also only into such some more
there about would could should these those other each""".split())


# ---------------------------------------------------------------------------------------
# Achar o trecho na página
# ---------------------------------------------------------------------------------------
@dataclass
class Achado:
    pagina: object
    parte: int
    inicio: int
    fim: int


def _ocorrencias(texto: str, trecho: str) -> list:
    achados, ini = [], 0
    while len(achados) < MAX_OCORRENCIAS:
        k = texto.find(trecho, ini)
        if k < 0:
            break
        achados.append((k, k + len(trecho)))
        ini = k + 1
    return achados


def _limite_de_palavra(texto: str, ini: int, fim: int, trecho: str) -> bool:
    antes_ok = ini == 0 or not trecho[0].isalnum() or not texto[ini - 1].isalnum()
    depois_ok = fim >= len(texto) or not trecho[-1].isalnum() or not texto[fim].isalnum()
    return antes_ok and depois_ok


def trecho_limpo(trecho: str) -> str:
    """Trecho na forma de comparação (aspas e espaços iguais, minúsculas, sem pontuação nas pontas)."""
    return T.chave(trecho).strip(_PONTUACAO_DAS_PONTAS + " ")


def _emendada(core: str, texto: str) -> bool:
    """O trecho é a junção de dois pedaços que existem na página mas não um colado no outro?"""
    palavras = core.split(" ")
    if len(palavras) > 600:
        return False
    for i in range(3, len(palavras) - 2):
        a, b = " ".join(palavras[:i]), " ".join(palavras[i:])
        if a in texto and b in texto:
            return True
    return False


def _tem_reticencias(trecho: str) -> bool:
    return bool(_RETICENCIAS.search(T.normalizar(trecho)))


_PALAVRA = re.compile(r"[a-z0-9]+")


def _cortou_o_sentido(b: str, ini: int, fim: int):
    """O trecho foi cortado deixando de fora uma negação ANTES ou uma ressalva DEPOIS (mudaria o sentido)? Devolve o motivo ou None."""
    cfg = CONFIG["citacao"]
    if not T.inicio_de_frase(b, ini):
        antes = b[max(0, ini - 80):ini]
        for sep in ".!?\n":
            antes = antes.rsplit(sep, 1)[-1]
        palavras = _PALAVRA.findall(T.dobrar(antes))[-cfg["palavras_olhadas_antes"]:]
        if set(palavras) & set(cfg["palavras_antes_que_invertem_o_sentido"]):
            return "CITACAO_SEM_A_NEGACAO"
    if not T.fim_de_frase(b, fim):
        depois = b[fim:fim + 80]
        for sep in ".!?\n":
            depois = depois.split(sep, 1)[0]
        palavras = _PALAVRA.findall(T.dobrar(depois))[:cfg["palavras_olhadas_depois"]]
        if palavras and (palavras[0] in cfg["palavras_depois_que_ressalvam"]
                         or any(palavras[:len(f)] == f for f in cfg["frases_depois_que_ressalvam"])):
            return "CITACAO_SEM_A_RESSALVA"
    return None


def _fonte_de_texto(exe, c):
    """(Pagina|None, parte|None, erro|None, sem_texto_para_conferir). `erro` é (motivo, mensagem)."""
    d = c.dados
    tem_leitura, tem_fonte = "leitura_id" in d, "fonte_importada_id" in d
    if (tem_leitura and not isinstance(d["leitura_id"], str)) or (tem_fonte and not isinstance(d["fonte_importada_id"], str)):
        return None, None, ("ORIGEM_INVALIDA", "leitura_id e fonte_importada_id devem ser textos."), False
    if tem_leitura and tem_fonte:
        return None, None, ("ORIGEM_DUPLA", "A citação aponta duas origens (leitura_id e fonte_importada_id). Aponte só uma."), False
    if not tem_leitura and not tem_fonte:
        return None, None, ("SEM_ORIGEM", "A citação não diz de onde veio. Informe leitura_id e parte (página lida) ou fonte_importada_id."), False
    if tem_fonte:
        fid = d["fonte_importada_id"]
        if fid in exe.fontes:
            return exe.fontes[fid], 1, None, False
        lei = _leis.lei_por_id(exe, fid)
        if lei is not None:
            if _leis.conferida(lei):
                return _leis.como_pagina(lei), 1, None, False
            return None, None, None, True  # tabela de leis sem texto oficial: CHK-LEI-03 marca "não conferida"
        return None, None, ("FONTE_NAO_IMPORTADA", f"A fonte importada '{fid}' não veio no pacote desta tarefa."), False
    lid = d["leitura_id"]
    pagina = exe.paginas.get(lid)
    if pagina is None:
        return None, None, ("PAGINA_NAO_LIDA", f"A página '{lid}' não foi lida nesta execução pela nossa ferramenta."), False
    if pagina.execucao and exe.execucao_id and pagina.execucao != exe.execucao_id:
        return None, None, ("PAGINA_DE_OUTRA_EXECUCAO", f"A página '{lid}' foi lida em outra execução; só vale página lida nesta."), False
    parte = d.get("parte")
    if not isinstance(parte, int) or isinstance(parte, bool):
        return None, None, ("SEM_PARTE", "A citação de página lida precisa do número da 'parte' (inteiro)."), False
    if parte not in pagina.partes:
        return None, None, ("PARTE_INEXISTENTE", f"A página '{lid}' não tem a parte {parte} entre as lidas (partes lidas: {sorted(pagina.partes)})."), False
    return pagina, parte, None, False


def _onde_mais_existe(exe, core: str, pagina, parte):
    """Se o trecho existe em OUTRA parte ou em OUTRA página lida, diz onde (ajuda o autor a corrigir)."""
    if pagina is not None:
        for n in pagina.partes:
            if n != parte and core in pagina.parte_chave(n):
                return ("PARTE_ERRADA", f"O trecho existe, mas na parte {n} da página, não na {parte}.")
    for outra in list(exe.paginas.values()) + list(exe.fontes.values()):
        if outra is pagina:
            continue
        for n in outra.partes:
            if core in outra.parte_chave(n):
                return ("PAGINA_ERRADA", f"O trecho existe, mas na página '{outra.leitura_id}' ({outra.url}), não na que a citação aponta.")
    return None


def _localizar(exe, c):
    """Confere a citação. Devolve (Achado | None, [Falha])."""
    d, cam = c.dados, c.caminho
    trecho = d.get("trecho_original")
    if not isinstance(trecho, str) or not trecho.strip():
        return None, [Falha(ID, "TRECHO_VAZIO", cam, "A citação não traz 'trecho_original'.")]
    core = trecho_limpo(trecho)
    if not core:
        return None, [Falha(ID, "TRECHO_VAZIO", cam, "O trecho citado só tem pontuação.", T.cortar(trecho))]
    pagina, parte, erro, sem_texto = _fonte_de_texto(exe, c)
    if sem_texto:
        return None, []
    if erro:
        achada = _onde_mais_existe(exe, core, None, None) if erro[0] in ("PAGINA_NAO_LIDA", "PAGINA_DE_OUTRA_EXECUCAO") else None
        msg = erro[1] + (f" {achada[1]}" if achada else "")
        return None, [Falha(ID, erro[0], cam, msg, T.cortar(trecho))]

    texto = pagina.parte_chave(parte)
    ocorrencias = _ocorrencias(texto, core)
    cfg = CONFIG["citacao"]
    if not ocorrencias:
        if _tem_reticencias(trecho) or _emendada(core, texto):
            return None, [Falha(ID, "CITACAO_EMENDADA", cam,
                                "A citação junta pedaços separados da página. Cite UM trecho contínuo (12 palavras ou mais, ou uma frase inteira).", T.cortar(trecho))]
        onde = _onde_mais_existe(exe, core, pagina, parte)
        if onde:
            return None, [Falha(ID, onde[0], cam, onde[1], T.cortar(trecho))]
        return None, [Falha(ID, "CITACAO_NAO_ENCONTRADA", cam,
                            f"O trecho não existe na página '{pagina.leitura_id}' (parte {parte}). Copie o trecho exatamente como está na página.", T.cortar(trecho))]

    boas = [(s, e) for s, e in ocorrencias if _limite_de_palavra(texto, s, e, core)]
    if not boas:
        return None, [Falha(ID, "TRECHO_NO_MEIO_DA_PALAVRA", cam,
                            "O trecho começa ou termina no meio de uma palavra. Cite palavras inteiras.", T.cortar(trecho))]
    n = T.contar_palavras(core)
    b = pagina.parte_b(parte)
    cortes = [_cortou_o_sentido(b, s, e) for s, e in boas]
    if all(cortes):  # em todas as ocorrências o trecho deixa de fora uma negação ou uma ressalva
        motivo = cortes[0]
        msg = ("O trecho começa DEPOIS de uma negação (não, nunca, sem...) que está na mesma frase e muda o sentido. Cite a frase desde o começo."
               if motivo == "CITACAO_SEM_A_NEGACAO" else
               "O trecho termina ANTES de uma ressalva (exceto, salvo, mas...) que está na mesma frase e muda o sentido. Cite a frase até o fim.")
        return None, [Falha(ID, motivo, cam, msg, T.cortar(trecho))]
    if n >= cfg["min_palavras"]:
        s, e = next((s, e) for (s, e), c in zip(boas, cortes) if not c)
        return Achado(pagina, parte, s, e), []
    if n < cfg["min_palavras_frase_inteira"]:
        return None, [Falha(ID, "TRECHO_CURTO", cam,
                            f"O trecho tem {n} palavras. Use 12 palavras ou mais, ou uma frase inteira de pelo menos {cfg['min_palavras_frase_inteira']} palavras.", T.cortar(trecho))]
    for s, e in boas:
        if T.inicio_de_frase(b, s) and T.fim_de_frase(b, e):
            return Achado(pagina, parte, s, e), []
    return None, [Falha(ID, "TRECHO_CORTADO", cam,
                        f"O trecho tem só {n} palavras e não é uma frase inteira da página (está cortado). Cite 12 palavras ou mais, ou a frase do começo ao fim.", T.cortar(trecho))]


# ---------------------------------------------------------------------------------------
# Por citação
# ---------------------------------------------------------------------------------------
def _checar_traducao(c) -> list:
    d = c.dados
    trecho = d.get("trecho_original")
    if not isinstance(trecho, str):
        return []
    if idioma.esta_em_portugues(trecho, 6) is False:
        t = d.get("traducao")
        if not isinstance(t, str) or not t.strip():
            return [Falha(ID, "TRADUCAO_AUSENTE", c.caminho,
                          "A citação está em outra língua e não tem 'traducao'. Ponha a tradução em português no campo 'traducao' (o original continua no campo do trecho).", T.cortar(trecho))]
    return []


def _rotulos_do_trecho(achado: Achado):
    """(rótulo do trecho, rótulos dentro do trecho) — ex.: cláusula 4.2 / título '4.2 Contas'."""
    b = achado.pagina.parte_b(achado.parte)
    antes, dentro = [], []
    for rx in (_ROTULO, _TITULO_NUMERADO):
        for m in rx.finditer(b[: achado.fim]):
            (antes if m.start() < achado.inicio else dentro).append((m.start(), m.group(1)))
    antes.sort()
    dono = antes[-1][1] if antes else None
    return dono, [r for _, r in dentro]


def _mesmo_rotulo(a: str, b: str) -> bool:
    return a == b or a.startswith(b + ".") or b.startswith(a + ".")


def _conteudo(texto: str) -> set:
    return {t[:5] for t in re.findall(r"[^\W_]+", T.dobrar(texto)) if (len(t) >= 4 and t not in _PARADAS) or t.isdigit()}


def _checar_grupo(exe, g, achados: dict) -> list:
    """Confere se as citações do grupo combinam com a afirmação (cláusula, palavras em comum e site)."""
    falhas, texto = [], g.texto
    if not g.citacoes or not texto.strip():
        return falhas
    # 1) afirmação cita um site: a citação tem de ser dele
    hosts_citados = []
    for c in g.citacoes:
        a = achados.get(id(c))
        if a is not None:
            hosts_citados.append(E.host_de(a.pagina.url))
    mencionados = [u for u in T.achar_urls(texto) if E.host_de(u)]
    if hosts_citados and mencionados:
        for u in mencionados:
            if not any(h is not None and h == E.host_de(u) for h in hosts_citados):
                falhas.append(Falha(ID, "CITACAO_DE_OUTRO_SITE", g.caminho,
                                    f"A frase fala do site {E.host_de(u)}, mas a citação é de outro site ({', '.join(sorted({h for h in hosts_citados if h}))}).", u))
                break
    # 2) número da cláusula
    rotulos_da_frase = [m.group(1) for m in _ROTULO.finditer(texto)]
    if rotulos_da_frase:
        for c in g.citacoes:
            a = achados.get(id(c))
            if a is None:
                continue
            dono, dentro = _rotulos_do_trecho(a)
            conhecidos = ([dono] if dono else []) + dentro
            if conhecidos and not any(_mesmo_rotulo(x, y) for x in rotulos_da_frase for y in conhecidos):
                falhas.append(Falha(ID, "OUTRA_CLAUSULA", c.caminho,
                                    f"A frase fala da cláusula {', '.join(rotulos_da_frase)}, mas o trecho citado é da cláusula {conhecidos[0]}.", T.cortar(c.dados.get('trecho_original', ''))))
    # 3) pelo menos uma palavra em comum
    cfg = CONFIG["citacao"]
    frase = _conteudo(texto)
    if len(frase) >= cfg["min_palavras_da_afirmacao_para_comparar"] and not any(f.motivo == "OUTRA_CLAUSULA" for f in falhas):
        apoio = set()
        comparavel = False
        for c in g.citacoes:
            if id(c) not in achados:
                continue
            d = c.dados
            em_pt = idioma.esta_em_portugues(d.get("trecho_original", ""), 6) is not False
            if em_pt:
                apoio |= _conteudo(d.get("trecho_original", ""))
                comparavel = True
            if isinstance(d.get("traducao"), str):
                apoio |= _conteudo(d["traducao"])
                comparavel = True
        if comparavel and len(frase & apoio) < cfg["min_palavras_em_comum"]:
            falhas.append(Falha(ID, "OUTRA_CLAUSULA", g.caminho,
                                "A citação não tem nenhuma palavra em comum com a frase: parece ser de outra cláusula. Cite o trecho que diz o que a frase afirma.", T.cortar(texto)))
    return falhas


def _sem_citacao(exe) -> list:
    falhas = []
    exigem = {s["id"] for s in exe.modelo.get("secoes", []) if s.get("exige_citacao")}
    for g in exe.grupos:
        if g.citacoes or g.ausencia or not g.itens:
            continue
        if g.secao in exigem:
            falhas.append(Falha(ID, "SEM_CITACAO", g.caminho,
                                f"Esta afirmação da seção '{g.secao}' precisa de citação (trecho contínuo de página lida).", T.cortar(g.texto)))
    if exe.opcao("exige_fontes", False):
        ja = {f.item for f in falhas}
        for g in exe.grupos:
            if g.citacoes or g.ausencia:
                continue
            for i in g.itens:
                if i.tipo == "livre" and i.caminho not in ja and any(rx.search(T.dobrar(i.texto)) for rx in _ATRIBUICAO):
                    falhas.append(Falha(ID, "SEM_CITACAO", i.caminho,
                                        "A frase se apoia numa página ou nos termos ('segundo...', 'a página diz...') mas não traz citação. Ponha a afirmação num item com citação.", T.cortar(i.texto)))
    return falhas


@checagem(ID, "Citação é trecho contínuo de página lida nesta execução",
          "Citação inventada, cortada, emendada, de outra cláusula ou de outro site parecia prova; e afirmação com fonte chegava sem citação.",
          ["C-8", "K-1", "M-15"])
def citacao_valida(exe):
    if not exe.formato_ok or exe.acao != "ENTREGAR":
        return None
    falhas, achados = [], {}
    for c in exe.citacoes:
        achado, fs = _localizar(exe, c)
        falhas += fs
        if achado is not None:
            achados[id(c)] = achado
            falhas += _checar_traducao(c)
    for g in exe.grupos:
        falhas += _checar_grupo(exe, g, achados)
    falhas += _sem_citacao(exe)
    return falhas
