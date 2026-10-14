"""Checagens do PARECER (Clara) que olham o TEXTO escrito por ela: garantia jurídica, termo proibido do pacote e lei só mencionada.

O que é: três CHK de helena-v2/deliverables/parecer.yaml (checagens_codigo): CHK-PARECER-SEM-GARANTIA (RECUSA),
CHK-PARECER-TERMO-DO-PACOTE (RECUSA) e CHK-PARECER-LEI-NAO-CONFERIDA (MARCA: a entrega segue, com um aviso na faixa).
De onde vêm as listas: SEM-GARANTIA e LEI-NAO-CONFERIDA leem os `parametros` do YAML; TERMO-DO-PACOTE lê a lista do pacote da
empresa do card (contexto["pacote_da_empresa"]["termos_proibidos_em_todo_texto"]), na hora, sem copiar.
Como mudar: acrescentar um termo de garantia = mudar a lista no YAML do tipo; acrescentar um termo proibido da empresa = mudar o pacote.
"Dentro de citações" fica de fora porque só olhamos o texto escrito pela Clara (Item do tipo "livre"), nunca o trecho_original.
Falha fechada: se uma checagem quebrar por entrega estranha, o núcleo recusa a entrega.
"""
import re

from .. import texto as T
from ..registro import checagem
from .spec_parecer_base import (COLUNA_DA_PECA, COLUNAS_COM_AFIRMACOES, COLUNAS_DE_TEXTO_LIVRE, aplica, coluna_do_item, falha,
                                linhas_da_tabela, parametros, pedido, textos_livres_de)


def _como_busca(texto: str, ignorar_maiusculas: bool) -> str:
    """O texto na forma de busca: sem acento, sem maiúscula e sem letras de outro alfabeto (ou só com espaços iguais)."""
    return " ".join((T.dobrar(texto) if ignorar_maiusculas else T.normalizar(texto)).split())


def _regex_do_termo(termo: str, ignorar_maiusculas: bool):
    """Regex que acha o termo como palavra(s) inteira(s), com qualquer quantidade de espaços entre as palavras."""
    partes = _como_busca(termo, ignorar_maiusculas).split()
    return re.compile(r"(?<!\w)" + r"\s+".join(re.escape(p) for p in partes) + r"(?!\w)")


# ---------------------------------------------------------------------------------------
# CHK-PARECER-SEM-GARANTIA
# ---------------------------------------------------------------------------------------
ID_GARANTIA = "CHK-PARECER-SEM-GARANTIA"


@checagem(ID_GARANTIA, "Nenhuma garantia jurídica nem papel de advogado",
          "A Clara não é advogada: 'fica 100% legal' ou 'conformidade total' (inclusive repetindo um aviso plantado numa página) enganaria o fundador.",
          ["C-13", "K-18"])
def sem_garantia(exe):
    if not aplica(exe, ID_GARANTIA):
        return None
    p = parametros(exe, ID_GARANTIA)
    ignorar = bool(p.get("sem_diferenca_de_maiusculas", True))
    termos = [(t, _regex_do_termo(t, ignorar)) for t in p["termos"]]
    falhas = []
    for item in exe.itens_livres():  # texto escrito pela Clara; citações (original e tradução) ficam de fora
        feno = _como_busca(item.texto, ignorar)
        for termo, rx in termos:
            if rx.search(feno):
                falhas.append(falha(ID_GARANTIA, "GARANTIA_JURIDICA", item.caminho,
                                    f"O texto diz '{termo}'. A Clara não garante nada juridicamente nem fala como advogada: tire a frase e diga só o que o trecho citado diz.", item.texto))
                break
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-TERMO-DO-PACOTE
# ---------------------------------------------------------------------------------------
ID_PACOTE = "CHK-PARECER-TERMO-DO-PACOTE"
CHAVE_DA_LISTA = "termos_proibidos_em_todo_texto"   # nome da lista dentro do pacote da empresa


@checagem(ID_PACOTE, "Nenhum termo proibido pelo pacote da empresa",
          "O ajuste do parecer podia sugerir justamente o termo que o pacote da empresa proíbe (ex.: a eLiving™ nunca é 'contador de calorias').",
          ["DEC-023", "C-13"])
def termo_do_pacote(exe):
    if not aplica(exe, ID_PACOTE):
        return None
    pacote = exe.contexto.get("pacote_da_empresa")
    lista = pacote.get(CHAVE_DA_LISTA) if isinstance(pacote, dict) else None
    if not isinstance(lista, list) or not lista:
        return []  # pacote sem lista de termos: passa (a faixa do card mostra 'pacote sem lista de termos')
    termos = [(str(t), _regex_do_termo(str(t), True)) for t in lista if str(t).strip()]
    falhas = []
    for item in exe.itens_livres():
        if coluna_do_item(item) == COLUNA_DA_PECA:  # cópia da peça julgada: não é texto da Clara
            continue
        feno = _como_busca(item.texto, True)
        for termo, rx in termos:
            if rx.search(feno):
                falhas.append(falha(ID_PACOTE, "TERMO_PROIBIDO_DO_PACOTE", item.caminho,
                                    f"O texto usa '{termo}', que o pacote da empresa proíbe. Tire o termo (e nunca o sugira num ajuste).", item.texto))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-LEI-NAO-CONFERIDA (MARCA)
# ---------------------------------------------------------------------------------------
ID_NAO_CONFERIDA = "CHK-PARECER-LEI-NAO-CONFERIDA"
_NUMERO_DO_ARTIGO = re.compile(r"art(?:\.|igo)\s*(\d+)", re.IGNORECASE)
_RESTO_DO_NUMERO = re.compile(r"[\d./\-ºo°]*")
_SO_LETRAS_E_NUMEROS = re.compile(r"[^a-z0-9]")


def _chave_de_norma(texto: str) -> str:
    """'Lei nº 12.965/2014' e 'Lei 12965/2014' viram a mesma chave (sem acento, sem 'nº', só letras e números)."""
    t = re.sub(r"\bn[º°o]?\.?\s*(?=\d)", "", T.dobrar(texto))
    return _SO_LETRAS_E_NUMEROS.sub("", t)


def _nomes_das_leis_da_tabela(exe) -> set:
    """Chaves dos nomes e apelidos das leis da tabela do pacote (aliases_das_leis, a lei e a norma de cada linha)."""
    tabela = pedido(exe).tabela or {}
    nomes = []
    for apelidos in (tabela.get("aliases_das_leis") or {}).values():
        nomes += [a for a in apelidos if isinstance(a, str)]
    nomes += [l["lei"] for l in linhas_da_tabela(exe) if isinstance(l.get("lei"), str)]
    nomes += [l["norma"] for l in tabela.get("linhas") or [] if isinstance(l, dict) and isinstance(l.get("norma"), str)]
    return {k for k in (_chave_de_norma(n) for n in nomes) if k}


def _artigos_da_tabela(exe) -> set:
    """Números de artigo que têm linha na tabela ('LGPD, art. 33, caput' -> '33')."""
    saida = set()
    for l in linhas_da_tabela(exe):
        m = _NUMERO_DO_ARTIGO.search(l["referencia"])
        if m:
            saida.add(m.group(1))
    return saida


@checagem(ID_NAO_CONFERIDA, "Lei só mencionada chega marcada 'não conferida'",
          "Uma norma citada de memória no texto livre (sem estar na tabela de leis do pacote) parecia conferida; agora chega marcada na faixa.",
          ["K-18"], gravidade="MARCA")
def lei_nao_conferida(exe):
    if not aplica(exe, ID_NAO_CONFERIDA):
        return None
    padroes = [re.compile(p) for p in parametros(exe, ID_NAO_CONFERIDA)["padroes"]]
    nomes, artigos = _nomes_das_leis_da_tabela(exe), _artigos_da_tabela(exe)
    falhas = []
    for item in textos_livres_de(exe, COLUNAS_DE_TEXTO_LIVRE):
        texto, vistos = T.normalizar_com_quebras(item.texto), set()
        for rx in padroes:
            for m in rx.finditer(texto):
                eh_artigo = m.group(0).lower().startswith("art")
                if eh_artigo:
                    n = _NUMERO_DO_ARTIGO.match(texto, m.start())
                    mencao = n.group(0) if n else m.group(0)
                    aceita = bool(n) and n.group(1) in artigos
                else:
                    mencao = (m.group(0) + _RESTO_DO_NUMERO.match(texto, m.end()).group(0)).strip()
                    chave = _chave_de_norma(mencao)
                    aceita = any(nome in chave for nome in nomes)
                if aceita or mencao in vistos:
                    continue
                vistos.add(mencao)
                falhas.append(falha(ID_NAO_CONFERIDA, "NORMA_FORA_DA_TABELA", item.caminho,
                                    f"'{mencao}' não está na tabela de leis do pacote. Chega ao fundador marcada 'não conferida'.", mencao))
    return falhas
