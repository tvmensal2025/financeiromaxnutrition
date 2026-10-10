"""Testes de MUTAÇÃO: "afrouxar" uma checagem tem de fazer o banco de casos falhar.

Cada mutação estraga uma regra de propósito (desliga a checagem, relaxa um número, troca uma comparação).
Para cada uma dizemos quais casos do banco TÊM de reagir:
  - um defeito plantado que passa a PASSAR (a regra afrouxada deixou escapar), ou
  - uma resposta honesta que passa a FALHAR (a regra apertada demais recusou o que era bom).
Antes de aplicar a mutação, os mesmos casos têm de se comportar como esperado (linha de base).
Se uma mutação não for pega por nenhum caso, o banco está fraco naquele ponto: acrescente um defeito.
"""
import dataclasses
import re
from decimal import ROUND_UP, Decimal

import pytest

import validador.enderecos as E
import validador.execucao as EX
import validador.expressao as EXPR
import validador.texto as T
from validador.checagens import acao_externa as AE
from validador.checagens import calculo as CAL
from validador.checagens import citacao as CIT
from validador.checagens import fonte as FON
from validador.checagens import ganho as GAN
from validador.checagens import leis as LEI
from validador.checagens import marca as MA
from validador.checagens import secoes as SEC
from validador.checagens import temas as TEM
from validador.checagens import texto_puro as TP
from validador.registro import CHECAGENS, CONFIG

from .casos import DEFEITOS
from .rodar_banco import avaliar_caso, casos_por_id

NUNCA = re.compile(r"(?!x)x")  # expressão que nunca casa com nada


def _depois_do_init(mp, mudar):
    """Roda `mudar(self)` logo depois de montar cada Execucao."""
    original = EX.Execucao.__init__

    def novo(self, *a, **k):
        original(self, *a, **k)
        mudar(self)

    mp.setattr(EX.Execucao, "__init__", novo)


def _sem_valor_nas_decisoes(self):
    self.decisoes = {k: {kk: vv for kk, vv in d.items() if kk != "valor"} for k, d in self.decisoes.items()}


def _opcao_desligada(mp, nome):
    mp.setattr(EX.Execucao, "opcao", lambda self, n, padrao=None: None if n == nome else self.opcoes.get(n, padrao))


def _leitor_leniente(mp):
    import json

    original = EX.interpretar_resposta

    def lenient(resposta):
        """Pega só o primeiro objeto JSON, ignorando texto antes e depois e ações a mais."""
        if isinstance(resposta, str) and "{" in resposta:
            try:
                doc, _ = json.JSONDecoder().raw_decode(resposta[resposta.index("{"):])
                return original(doc)
            except ValueError:
                pass
        return original(resposta)

    mp.setattr(EX, "interpretar_resposta", lenient)


def _strings_so_valores(obj, caminho="resposta"):
    if isinstance(obj, str):
        yield caminho, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from _strings_so_valores(v, f"{caminho}.{k}")
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            yield from _strings_so_valores(v, f"{caminho}[{i}]")


def _dados_do_ganho_sem(mp, parte):
    original = GAN._dados()
    palavras, radicais, expressoes = original
    mp.setattr(GAN, "_dados", lambda: (set() if parte == "palavras" else palavras, () if parte == "radicais" else radicais, () if parte == "expressoes" else expressoes))


def _host_ingenuo_com_arroba(url):
    return url.split("//")[-1].split("/")[0].split("@")[0].lower().removeprefix("www.")


def _host_com_letras_dobradas(mp):
    original = E.host_de
    mp.setattr(E, "host_de", lambda url: original(T.dobrar(url)))


def _mesmo_site_por(comparador):
    return lambda mp: mp.setattr(E, "mesmo_site", lambda a, b, sub=False: comparador(E.host_de(a) or "", E.host_de(b) or "#"))


def _conf(mp, secao, chave, valor):
    mp.setitem(CONFIG[secao], chave, valor)


def _cons(mp):
    mp.setitem(CONFIG["calculo"], "constantes_permitidas_em_formulas", [*CONFIG["calculo"]["constantes_permitidas_em_formulas"], "5.4"])


def _numeros_de_tudo(mp):
    mp.setattr(CAL, "numeros_no_texto", lambda t: [Decimal(x) for x in ("0.75", "0.50", "5.40", "10", "20")])


# (nome, função que aplica a mutação, ids dos casos que TÊM de reagir)
MUTACOES = [
    # ---- citações
    ("citação: aceita trecho com só 3 palavras", lambda mp: _conf(mp, "citacao", "min_palavras", 3), ["I03", "I27", "I29", "I30"]),
    ("citação: frase inteira vale com 1 palavra", lambda mp: _conf(mp, "citacao", "min_palavras_frase_inteira", 1), ["I04"]),
    ("citação: começo no meio da palavra aceito", lambda mp: mp.setattr(CIT, "_limite_de_palavra", lambda *a: True), ["I15", "I16"]),
    ("citação: emenda sem aviso não detectada", lambda mp: mp.setattr(CIT, "_emendada", lambda *a: False), ["I06"]),
    ("citação: reticências não detectadas", lambda mp: mp.setattr(CIT, "_tem_reticencias", lambda *a: False), ["I05"]),
    ("citação: não diz onde o trecho existe", lambda mp: mp.setattr(CIT, "_onde_mais_existe", lambda *a: None), ["I07", "I08"]),
    ("citação: página de outra execução aceita", lambda mp: _depois_do_init(mp, lambda self: setattr(self, "execucao_id", None)), ["I10"]),
    ("citação: começo de frase sempre verdadeiro", lambda mp: mp.setattr(T, "inicio_de_frase", lambda *a: True), ["I29", "I30"]),
    ("citação: fim de frase sempre verdadeiro", lambda mp: mp.setattr(T, "fim_de_frase", lambda *a: True), ["I03"]),
    ("citação: abreviações (art.) ignoradas", lambda mp: mp.setattr(T, "ABREVIACOES", set()), ["I30"]),
    ("citação: negação cortada não percebida", lambda mp: mp.setitem(CONFIG["citacao"], "palavras_antes_que_invertem_o_sentido", []), ["I31"]),
    ("citação: ressalva cortada não percebida", lambda mp: (mp.setitem(CONFIG["citacao"], "palavras_depois_que_ressalvam", []), mp.setitem(CONFIG["citacao"], "frases_depois_que_ressalvam", [])), ["I32", "I33"]),
    ("citação: só a primeira palavra de ressalva (frases como 'a menos que' ignoradas)", lambda mp: mp.setitem(CONFIG["citacao"], "frases_depois_que_ressalvam", []), ["I33"]),
    ("citação: número da cláusula ignorado", lambda mp: mp.setattr(CIT, "_ROTULO", NUNCA), ["I18"]),
    ("citação: palavras em comum não exigidas", lambda mp: _conf(mp, "citacao", "min_palavras_em_comum", 0), ["I19"]),
    ("citação: tradução não exigida", lambda mp: mp.setattr(CIT, "_checar_traducao", lambda c: []), ["I17"]),
    ("citação: site mencionado não comparado", lambda mp: mp.setattr(CIT.T, "achar_urls", lambda s: []), ["I20"]),
    ("citação: seção que exige citação deixa passar", lambda mp: mp.setattr(CIT, "_sem_citacao", lambda exe: []), ["I21", "I22", "I23", "I24"]),
    ("citação: aspas não são igualadas (aperta demais)", lambda mp: mp.setattr(T, "TABELA_ASPAS", {}), ["OK05", "OK06", "OK07"]),
    ("citação: maiúsculas importam (aperta demais)", lambda mp: (mp.setattr(T, "chave", lambda t: T.normalizar(t)), mp.setattr(EX.Pagina, "parte_chave", lambda self, n: self.parte_b(n).replace("\n", " "))), ["OK12", "OK14"]),
    ("citação: acentos decompostos não igualados (aperta demais)", lambda mp: mp.setattr(T.unicodedata, "normalize", lambda forma, s: s), ["OK10"]),
    ("citação: espaços duplos não colapsados (aperta demais)", lambda mp: mp.setattr(T, "_ESPACOS_HORIZONTAIS", NUNCA), ["OK08"]),
    ("citação: quebra de linha não vira espaço (aperta demais)", lambda mp: mp.setattr(T, "normalizar", T.normalizar_com_quebras), ["OK09"]),
    ("citação: travessões não igualados (aperta demais)", lambda mp: mp.setattr(T, "TABELA_TRACOS", {}), ["OK15"]),
    # ---- fonte oficial / ausência / termos
    ("oficial: aceita subdomínio", lambda mp: _conf(mp, "oficial", "aceitar_subdominios", True), ["N03"]),
    ("oficial: site 'começa com' o do pedido", _mesmo_site_por(lambda a, b: a.startswith(b)), ["N02"]),
    ("oficial: site 'termina com' o do pedido", _mesmo_site_por(lambda a, b: a.endswith(b)), ["N03"]),
    ("oficial: pedido 'começa com' o site citado", _mesmo_site_por(lambda a, b: b.startswith(a)), ["N08"]),
    ("oficial: letras parecidas dobradas antes de comparar", _host_com_letras_dobradas, ["N04"]),
    ("oficial: usuário@ lido como servidor", lambda mp: mp.setattr(E, "host_de", _host_ingenuo_com_arroba), ["N06"]),
    ("oficial: porta ignorada", lambda mp: mp.setattr(E, "porta_de", lambda url: None), ["N07"]),
    ("ausência: não procura os termos na página", lambda mp: mp.setattr(FON, "_procura", lambda t, termo: None), ["O04", "O08"]),
    ("ausência: partes não guardadas ignoradas", lambda mp: mp.setattr(EX.Pagina, "partes_faltando", lambda self: []), ["O03", "P01"]),
    ("ausência: termo sem plural nem raiz", lambda mp: mp.setattr(FON, "_radical", lambda t: " ".join(T.dobrar(t).split())), ["O13"]),
    ("termos de uso: leitura parcial aceita", lambda mp: mp.setattr(EX.Pagina, "partes_faltando", lambda self: []), ["P01"]),
    # ---- links, marcas, confiança
    ("oficial: só os substantivos antigos (sem 'página web oficial' nem 'regras oficiais')",
     lambda mp: mp.setattr(FON, "_OFICIAL", re.compile(r"\b(?:fonte|site|pagina|portal|canal|comunicado|conta|perfil|documento|termos|politica|regulamento)\s+(?:oficial|oficiais)\b")), ["N16", "N17"]),
    ("ausência: só a frase 'a página não fala de'", lambda mp: mp.setattr(FON, "_AUSENCIA", FON._AUSENCIA[:1]), ["O14", "O15"]),
    ("texto puro: letras largas não igualadas", lambda mp: mp.setattr(TP.unicodedata, "normalize", lambda forma, s: s), ["G11"]),
    ("links: só o servidor é comparado", lambda mp: mp.setattr(E, "chave_da_pagina", lambda u: E.host_de(u)), ["J03"]),
    ("marca: grafia não conferida", lambda mp: mp.setattr(MA, "_MARCA", NUNCA), ["L01", "L02", "L03", "L04", "L05", "L06"]),
    ("confiança no texto não marcada", lambda mp: mp.setattr(MA, "_CONFIANCA", []), ["K02", "K03"]),
    # ---- formato e ação
    ("ação: vários JSONs e texto em volta aceitos", _leitor_leniente, ["A03", "A06", "A07"]),
    ("ação: campos do formato não conferidos", lambda mp: mp.setattr(EX, "_conferir_campos", lambda acao, obj: []), ["A08", "A09", "A10"]),
    ("ação: uso da internet ignorado", lambda mp: _depois_do_init(mp, lambda self: setattr(self, "usou_internet", False)), ["C01", "C02"]),
    ("seções: enfeite (N/A) aceito como conteúdo", lambda mp: mp.setattr(SEC, "PLACEHOLDERS", set()), ["D03"]),
    # ---- texto puro, ação externa, idioma
    ("texto puro: padrões de HTML vazios", lambda mp: mp.setattr(TP, "PADROES", []), ["G01", "G02", "G03", "G04", "G05", "G08", "G10"]),
    ("texto puro: invisíveis não detectados", lambda mp: mp.setattr(T, "INVISIVEIS", NUNCA), ["G06", "G07"]),
    ("texto puro: nomes de campo ignorados", lambda mp: mp.setattr(TP, "_strings", _strings_so_valores), ["G09"]),
    ("ação externa: verbos não detectados", lambda mp: mp.setattr(AE, "_RX_VERBO", NUNCA), ["H01", "H02", "H03", "H04", "H05", "H09", "H10"]),
    ("ação externa: expressões não detectadas", lambda mp: mp.setattr(AE, "_RX_EXPR", NUNCA), ["H06", "H07", "H08"]),
    ("ação externa: 'não enviei' recusado (aperta demais)", lambda mp: mp.setattr(AE, "NEGACOES", set()), ["OK27"]),
    ("idioma: outra língua nunca basta", lambda mp: (_conf(mp, "idioma", "parte_minima_do_outro_idioma", 0.99), _conf(mp, "idioma", "parte_minima_do_portugues", -1)), ["F01", "F02", "F03"]),
    # ---- cálculo
    ("cálculo: número solto na fórmula permitido", _cons, ["Q09"]),
    ("cálculo: arredonda para cima (afrouxa um e aperta outro)", lambda mp: mp.setattr(CAL, "ROUND_HALF_UP", ROUND_UP), ["R03", "OK40"]),
    ("cálculo: câmbio nunca detectado", lambda mp: mp.setattr(CAL, "_e_cambio", lambda e: False), ["S01", "S03", "S05"]),
    ("cálculo: valor não conferido com a citação", _numeros_de_tudo, ["Q08"]),
    ("cálculo: valor do fundador não comparado", lambda mp: _depois_do_init(mp, _sem_valor_nas_decisoes), ["Q04"]),
    ("cálculo: números em dinheiro no texto não conferidos", lambda mp: mp.setattr(CAL, "_VALOR_EM_MOEDA", []), ["R05"]),
    ("avaliador: aceita uma função a mais (eval)", lambda mp: mp.setattr(EXPR, "FUNCOES", EXPR.FUNCOES | {"eval"}), ["T03"]),
    ("avaliador: expoente sem limite", lambda mp: mp.setattr(EXPR, "MAX_EXPOENTE", 1000), ["T13"]),
    ("avaliador: fórmula sem limite de tamanho", lambda mp: (mp.setattr(EXPR, "MAX_TAMANHO", 10**6), mp.setattr(EXPR, "MAX_ELEMENTOS", 10**6)), ["T06"]),
    # ---- leis e temas
    ("leis: trecho de 1 palavra basta", lambda mp: _conf(mp, "leis", "min_palavras_do_trecho", 1), ["V03"]),
    ("leis: lei conferida tratada como não conferida", lambda mp: mp.setattr(LEI, "conferida", lambda lei: False), ["V04"]),
    ("leis: ano no futuro vira só marca", lambda mp: mp.setitem(CONFIG["gravidades"], "CHK-LEI-01:LEI_COM_ANO_NO_FUTURO", "MARCA"), ["U01"]),
    ("leis: número e ano que não batem viram só marca", lambda mp: mp.setitem(CONFIG["gravidades"], "CHK-LEI-01:NUMERO_E_ANO_NAO_BATEM", "MARCA"), ["U04", "U09"]),
    ("leis: nota de jurisprudência sempre presente", lambda mp: mp.setattr(LEI, "_NOTA", re.compile(r"")), ["X01", "X02"]),
    ("leis: artigo sem lei aceito", lambda mp: _opcao_desligada(mp, "confere_leis"), ["V02"]),
    ("temas: frase de 1 palavra basta", lambda mp: _conf(mp, "temas", "min_palavras_na_frase", 1), ["Y05"]),
    ("temas: enfeite ('a definir', 'n/a') aceito", lambda mp: mp.setattr(TEM, "_ENFEITES", NUNCA), ["Y02", "Y09"]),
    ("temas: 'não se aplica' sem explicar aceito", lambda mp: mp.setattr(TEM, "_NAO_SE_APLICA", NUNCA), ["Y04"]),
    ("temas: a seção da pergunta também vale", lambda mp: _opcao_desligada(mp, "secoes_dos_temas"), ["Y03"]),
    # ---- convite sem ganho
    ("ganho: letras de outro alfabeto não igualadas", lambda mp: mp.setattr(T, "TABELA_PARECIDAS", {}), ["Z15"]),
    ("ganho: separadores dentro da palavra", lambda mp: mp.setattr(GAN, "_SEPARADORES_INTERNOS", NUNCA), ["Z12"]),
    ("ganho: letras soltas (r e n d a)", lambda mp: mp.setattr(GAN, "_LETRAS_SOLTAS", NUNCA), ["Z11", "Z31", "Z34"]),
    ("ganho: números no lugar de letras", lambda mp: mp.setattr(GAN, "_LEET", {}), ["Z13", "Z14", "Z21", "Z22"]),
    ("ganho: emojis de dinheiro", lambda mp: mp.setattr(GAN, "_EMOJIS", set()), ["Z18"]),
    ("ganho: símbolos de moeda", lambda mp: mp.setattr(GAN, "_SIMBOLOS", []), ["Z19", "Z20", "Z28", "Z32"]),
    ("ganho: radicais (ganh, lucr, dinheir...)", lambda mp: _dados_do_ganho_sem(mp, "radicais"), ["Z01", "Z24", "Z25", "Z26", "Z35", "Z36", "Z37"]),
    ("ganho: expressões (por hora)", lambda mp: _dados_do_ganho_sem(mp, "expressoes"), ["Z07"]),
    ("ganho: palavras (renda, extra, dólares)", lambda mp: _dados_do_ganho_sem(mp, "palavras"), ["Z03", "Z05", "Z06", "Z08", "Z09", "Z10", "Z38"]),
]


@pytest.mark.parametrize("nome,aplicar,casos", MUTACOES, ids=[m[0] for m in MUTACOES])
def test_mutacao_e_pega_pelo_banco(nome, aplicar, casos, monkeypatch):
    indice = casos_por_id()
    for cid in casos:  # linha de base: sem a mutação, o caso se comporta como esperado
        assert avaliar_caso(indice[cid]) is None, f"caso {cid} já falhava antes da mutação"
    aplicar(monkeypatch)
    sem_reacao = [cid for cid in casos if avaliar_caso(indice[cid]) is None]
    assert not sem_reacao, f"a mutação '{nome}' NÃO foi pega pelos casos {sem_reacao}: o banco está fraco aqui"


@pytest.mark.parametrize("id_da_checagem", sorted(CHECAGENS))
def test_desligar_uma_checagem_deixa_escapar_todos_os_defeitos_dela(id_da_checagem, monkeypatch):
    """Se a checagem X for desligada, TODO defeito que espera X passa a escapar (nenhuma outra checagem cobre o mesmo furo)."""
    seus = [d for d in DEFEITOS if d.esperado[0] == id_da_checagem]
    assert seus, f"{id_da_checagem} não tem defeito plantado"
    for d in seus:
        assert avaliar_caso(d) is None
    monkeypatch.setitem(CHECAGENS, id_da_checagem, dataclasses.replace(CHECAGENS[id_da_checagem], funcao=lambda exe: []))
    seguem_pegos = [d.id for d in seus if avaliar_caso(d) is None]
    assert not seguem_pegos, f"com {id_da_checagem} desligada, estes defeitos continuam sendo pegos por outra coisa: {seguem_pegos}"
