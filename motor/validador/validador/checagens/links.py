"""CHK-COMUM-07: link que não veio de página lida chega marcado "link não conferido"."""
from .. import enderecos as E
from .. import texto as T
from ..registro import checagem
from ..resultado import Falha
from . import leis as _leis

ID = "CHK-COMUM-07"


def links_conferidos(exe) -> set:
    """Chaves das páginas que o agente pode apontar: lidas nesta execução, fontes importadas, links do pedido, sites oficiais da tabela de leis."""
    def calcular():
        urls = [p.url for p in exe.paginas.values()] + [f.url for f in exe.fontes.values()] + list(exe.links_do_pedido)
        urls += [lei["url_oficial"] for lei in _leis.tabela(exe)["leis"] if lei.get("url_oficial")]
        return {k for k in (E.chave_da_pagina(u) for u in urls) if k}
    return exe.memo("links_conferidos", calcular)


@checagem(ID, "Link só de página lida",
          "Um site podia plantar um link no texto e o agente repassá-lo ao fundador como se fosse confiável.",
          ["C-7", "B-9"], gravidade="MARCA")
def link_conferido(exe):
    if not exe.formato_ok:
        return None
    ok = links_conferidos(exe)
    falhas = []
    for i in exe.itens:
        if i.tipo != "livre":
            continue
        for u in T.achar_urls(i.texto):
            chave = E.chave_da_pagina(u)
            if chave is None or chave not in ok:
                falhas.append(Falha(ID, "LINK_NAO_CONFERIDO", i.caminho,
                                    "Link não conferido: ele não é de nenhuma página lida nesta tarefa. Chega ao fundador com essa marca.", u))
    return falhas
