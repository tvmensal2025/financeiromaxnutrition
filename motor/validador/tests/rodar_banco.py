"""Roda o banco de casos e devolve o que deu errado (usado pelo teste e pelos testes de mutação)."""
from validador import validar

from .banco import montar
from .casos import DEFEITOS, HONESTAS


def avaliar_defeito(d):
    """Devolve None se o defeito foi pego como esperado, ou um texto dizendo o que aconteceu."""
    r, c = montar(d.base, d.remendos)
    rel = validar(r, c)
    cid, motivo, grav = d.esperado
    achadas = [f for f in rel.falhas_de(cid) if (motivo is None or f.motivo == motivo)]
    if not achadas:
        vistos = sorted({(f.id, f.motivo) for f in rel.falhas})
        return f"{d.id}: não pegou {cid}{'/' + motivo if motivo else ''}; veredito {rel.veredito}; falhas vistas: {vistos}"
    if grav and not any(f.gravidade == grav for f in achadas):
        return f"{d.id}: {cid} apareceu com gravidade {[f.gravidade for f in achadas]}, esperada {grav}"
    if grav == "RECUSA" and rel.aprovada:
        return f"{d.id}: era para RECUSAR, mas o veredito foi {rel.veredito}"
    return None


def avaliar_honesta(h):
    """Devolve None se a resposta honesta passou como esperado, ou um texto dizendo o que deu errado."""
    r, c = montar(h.base, h.remendos)
    rel = validar(r, c)
    if rel.recusas:
        return f"{h.id}: honesta foi recusada: {[(f.id, f.motivo, f.item) for f in rel.recusas]}"
    inesperadas = rel.ids_que_falharam() - set(h.marcas)
    if inesperadas:
        return f"{h.id}: marcas inesperadas: {sorted(inesperadas)}"
    faltando = set(h.marcas) - rel.ids_que_falharam()
    if faltando:
        return f"{h.id}: marcas esperadas que não vieram: {sorted(faltando)}"
    return None


def rodar_banco():
    """(defeitos que passaram, honestas que falharam)"""
    escapes = [m for m in (avaliar_defeito(d) for d in DEFEITOS) if m]
    recusadas = [m for m in (avaliar_honesta(h) for h in HONESTAS) if m]
    return escapes, recusadas


def casos_por_id():
    return {c.id: c for c in [*DEFEITOS, *HONESTAS]}


def avaliar_caso(caso):
    """None se o caso se comportou como esperado; senão um texto explicando."""
    return avaliar_defeito(caso) if hasattr(caso, "esperado") else avaliar_honesta(caso)
