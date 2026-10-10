"""CHK-TEMA-01: todo tema obrigatório do serviço tem resposta.

Como decide (simples e explicável): um tema está RESPONDIDO se existe uma frase com pelo menos
`temas.min_palavras_na_frase` palavras (configuracao.json) que contém um dos termos do tema e não é só
um enfeite ("a definir", "n/a", "não analisado", "não se aplica" sem explicar por quê).
Os temas vêm do modelo (`temas_obrigatorios`) ou, se o modelo não trouxer, de dados/temas.json pelo id do serviço.
A opção `secoes_dos_temas` do modelo limita onde procurar (ex.: não vale a seção que só repete a pergunta).
"""
import re

from .. import texto as T
from ..registro import CONFIG, carregar_json, checagem
from ..resultado import Falha

ID = "CHK-TEMA-01"
_ENFEITES = re.compile(r"\ba definir\b|\btbd\b|\bn/a\b|\bnao analisad|\bnao avaliad|\bsem resposta\b|\bsem informac")
_NAO_SE_APLICA = re.compile(r"\bnao se aplica\b")
_JUSTIFICATIVA = re.compile(r"\bporque\b|\bpois\b|\bja que\b|\buma vez que\b|\bvisto que\b|\bdado que\b|\bcomo\b")


def temas_do_modelo(exe) -> list:
    """Lista de {id, tema, termos}. O modelo manda; se não trouxer temas, vale a tabela por serviço."""
    dados = carregar_json("temas.json")
    catalogo = dados["catalogo"]
    saida = []
    if exe.modelo.get("temas_obrigatorios"):
        for t in exe.modelo["temas_obrigatorios"]:
            termos = t.get("termos") or catalogo.get(t["id"], {}).get("termos") or [t.get("tema", t["id"])]
            saida.append({"id": t["id"], "tema": t.get("tema") or catalogo.get(t["id"], {}).get("tema", t["id"]), "termos": termos})
    else:
        for tid in dados["por_servico"].get(exe.modelo.get("servico"), []):
            saida.append({"id": tid, "tema": catalogo[tid]["tema"], "termos": catalogo[tid]["termos"]})
    return saida


def _regex_do_termo(termo: str):
    f = T.dobrar(termo.strip())
    if f.endswith("*"):
        return re.compile(r"(?<![a-z0-9])" + re.escape(f[:-1]).replace(r"\ ", r"\s+") + r"[a-z0-9]*")
    return re.compile(r"(?<![a-z0-9])" + re.escape(f).replace(r"\ ", r"\s+") + r"(?:s|es)?(?![a-z0-9])")


def _frase_responde(frase: str, rxs, minimo: int) -> bool:
    if T.contar_palavras(frase) < minimo:
        return False
    f = T.dobrar(frase)
    if not any(rx.search(f) for rx in rxs):
        return False
    if _ENFEITES.search(f):
        return False
    if _NAO_SE_APLICA.search(f) and not _JUSTIFICATIVA.search(f):
        return False
    return True


@checagem(ID, "Tema obrigatório do serviço respondido",
          "Um parecer jurídico podia ser entregue sem falar de imagem, voz, dado sensível, transferência para fora do país, menores, vínculo de trabalho ou publicidade.",
          ["C-10"])
def temas_obrigatorios(exe):
    if exe.acao != "ENTREGAR":
        return None
    temas = temas_do_modelo(exe)
    if not temas:
        return None
    secoes = exe.opcao("secoes_dos_temas")
    minimo = CONFIG["temas"]["min_palavras_na_frase"]
    frases = []
    for i in exe.itens:
        if i.tipo == "livre" and (secoes is None or i.secao in secoes):
            frases += T.separar_frases(i.texto)
    falhas = []
    for t in temas:
        rxs = [_regex_do_termo(x) for x in t["termos"]]
        if not any(_frase_responde(fr, rxs, minimo) for fr in frases):
            falhas.append(Falha(ID, "TEMA_SEM_RESPOSTA", "entrega",
                                f"Falta responder o tema obrigatório '{t['tema']}' ({t['id']}). Escreva ao menos uma frase completa sobre ele (não vale 'a definir' nem 'não se aplica' sem explicar).", t["tema"]))
    return falhas
