"""Monta contexto do portão 1 exclusivamente com dados operacionais recebidos.

Não lê casos, relógio, páginas, decisões ou fontes por conta própria. A ausência
de prova fica visível ao validador; uma entrada contraditória é erro do chamador.
"""
import copy
import json
import re
from datetime import date

from spec_helena.modelo import montar_modelo
from validador.contexto import conferir_contexto


_URL = re.compile(r"https?://[^\s<>\"')\]]+")


def _copia_json(valor, nome):
    try:
        return json.loads(json.dumps(valor, ensure_ascii=False, allow_nan=False))
    except (TypeError, ValueError, OverflowError) as erro:
        raise ValueError(f"{nome} deve conter só dados JSON") from erro


def _objeto_json(valor, nome):
    if not isinstance(valor, dict):
        raise ValueError(f"{nome} deve ser um objeto JSON")
    return _copia_json(valor, nome)


def _bloco(pedido, nome):
    if nome in pedido:
        valor = pedido[nome]
    else:
        card = pedido.get("card") or {}
        if not isinstance(card, dict):
            raise ValueError("pedido.card deve ser um objeto JSON")
        valor = card.get(nome)
    if valor is not None and not isinstance(valor, dict):
        raise ValueError(f"pedido.{nome} deve ser um objeto JSON")
    return valor or {}


def montar_contexto_real(spec, servico, *, pedido, fontes_importadas, decisoes, execucao_id,
                        paginas_lidas=[], usou_internet=False, hoje=None) -> dict:
    """Devolve contexto compatível com ``validador.validar`` sem inventar prova.

    ``pedido`` contém a ordem de serviço e o plano operacionais. Fontes, decisões
    e páginas são cópias exatas dos argumentos; o chamador precisa ter persistido
    as leituras da própria ``execucao_id`` antes desta chamada.
    """
    if not isinstance(servico, str) or not servico.strip() or servico not in spec.servicos:
        raise ValueError(f"serviço desconhecido: {servico!r}")
    if not isinstance(execucao_id, str) or not execucao_id.strip():
        raise ValueError("execucao_id deve ser texto não vazio")
    p = _objeto_json(pedido, "pedido")
    ordem = _bloco(p, "ordem_de_servico")
    if not ordem:
        raise ValueError("pedido.ordem_de_servico deve existir e conter os dados operacionais")
    plano = _bloco(p, "plano")
    etapas = plano.get("etapas") or []
    if not isinstance(etapas, list) or any(not isinstance(e, dict) for e in etapas):
        raise ValueError("pedido.plano.etapas deve ser lista de objetos")
    acoes = set()
    for etapa in etapas:
        if etapa.get("servico") != servico:
            continue
        acao = etapa.get("acao_do_fundador")
        if acao is not None and (not isinstance(acao, str) or not acao.strip()):
            raise ValueError("pedido.plano.etapas.acao_do_fundador deve ser texto não vazio")
        if acao:
            acoes.add(acao)
    if len(acoes) > 1:
        raise ValueError("pedido.plano traz ações do fundador diferentes para o mesmo serviço")
    acao_do_plano = next(iter(acoes), None)

    if not isinstance(fontes_importadas, dict) or any(not isinstance(i, str) or not i.strip() or
                                                       not isinstance(t, str) for i, t in fontes_importadas.items()):
        raise ValueError("fontes_importadas deve mapear IDs não vazios para textos fornecidos")
    if not isinstance(decisoes, list) or any(not isinstance(d, dict) or
                                            not isinstance(d.get("id"), str) or not d["id"].strip() for d in decisoes):
        raise ValueError("decisoes deve ser lista de objetos com id")
    if len({d["id"] for d in decisoes}) != len(decisoes):
        raise ValueError("decisoes contém IDs repetidos")
    decisoes = _copia_json(decisoes, "decisoes")
    if not isinstance(paginas_lidas, list) or any(not isinstance(pg, dict) or
                                                  pg.get("execucao") != execucao_id for pg in paginas_lidas):
        raise ValueError("paginas_lidas exige execucao igual à execucao_id em cada página")
    paginas_lidas = _copia_json(paginas_lidas, "paginas_lidas")
    if not isinstance(usou_internet, bool) or (paginas_lidas and not usou_internet):
        raise ValueError("usou_internet deve ser verdadeiro quando há paginas_lidas")
    if hoje is not None:
        try:
            if not isinstance(hoje, str) or date.fromisoformat(hoje).isoformat() != hoje:
                raise ValueError
        except ValueError as erro:
            raise ValueError("hoje deve ser data AAAA-MM-DD fornecida pelo chamador") from erro

    original = ordem.get("pedido_original")
    if original is not None and not isinstance(original, str):
        raise ValueError("pedido.ordem_de_servico.pedido_original deve ser texto")
    links = [u.rstrip(".,;:") for u in _URL.findall(original or "")]
    permitidos = ordem.get("fontes_que_pode_ler") or []
    if not isinstance(permitidos, list) or any(not isinstance(u, str) for u in permitidos):
        raise ValueError("pedido.ordem_de_servico.fontes_que_pode_ler deve ser lista de textos")
    links.extend(permitidos)
    contexto = {
        "execucao_id": execucao_id,
        "usou_internet": "SIM" if usou_internet else "NAO",
        "links_do_pedido": list(dict.fromkeys(links)),
        "decisoes_vigentes": decisoes,
        "paginas_lidas": paginas_lidas,
        "fontes_importadas": [{"fonte_importada_id": i, "texto": t} for i, t in fontes_importadas.items()],
        "modelo": copy.deepcopy(montar_modelo(spec, spec.tipo_do_servico(servico), acao_do_plano)),
        "pacote_da_empresa": p.get("pacote_da_empresa"),
        "pedido": p,
    }
    if hoje is not None:
        contexto["hoje"] = hoje
    conferir_contexto(contexto)
    return contexto
