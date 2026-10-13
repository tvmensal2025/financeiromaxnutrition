"""Conferência do plano antes de PLANO_VALIDO; não modifica estado."""
from pathlib import Path
from executor_helena.ficha import ler_ficha

RAIZ = Path(__file__).resolve().parents[3]


def validar_plano(plano: dict, spec) -> str | None:
    etapas = plano.get('etapas') or []
    codigos = [e.get('id') for e in etapas]
    if not codigos or len(codigos) != len(set(codigos)) or any(not c for c in codigos):
        return 'etapas ausentes ou códigos repetidos'
    servicos = spec.servicos
    for etapa in etapas:
        if etapa.get('servico') not in servicos:
            return f"serviço desconhecido: {etapa.get('servico')}"
        if any(d not in codigos for d in etapa.get('depende_de', [])):
            return f"dependência desconhecida em {etapa['id']}"
        origens = set(codigos) | set(plano.get('entradas_externas') or {})
        if any(entrada not in origens for entrada in etapa.get('entradas', [])):
            return f"entrada sem origem em {etapa['id']}"
        if any(entrada in codigos and entrada not in etapa.get('depende_de', [])
               for entrada in etapa.get('entradas', [])):
            return f"entrada de {etapa['id']} sem dependência"
    visitando, visitados = set(), set()

    def visitar(codigo):
        if codigo in visitando:
            return False
        if codigo in visitados:
            return True
        visitando.add(codigo)
        for dep in next(e for e in etapas if e['id'] == codigo).get('depende_de', []):
            if not visitar(dep):
                return False
        visitando.remove(codigo)
        visitados.add(codigo)
        return True

    if not all(visitar(c) for c in codigos):
        return 'plano contém ciclo'
    chamadas = 0
    for etapa in etapas:
        servico = etapa['servico']
        dono = servicos[servico]['dono'].lower()
        ficha = ler_ficha(RAIZ / 'helena-v2' / 'agents' / f'{dono}.yaml',
                          caminho_dos_modelos=RAIZ / 'helena-v2' / 'models.yaml',
                          fase_em_curso='fase 3', servico=servico)
        chamadas += ficha.orcamento.chamadas_total
    orcamento = plano.get('orcamento_meta') or {}
    if orcamento.get('execucoes', 0) < len(etapas) * 2 or orcamento.get('chamadas_total', 0) < chamadas:
        return 'orçamento insuficiente para autores e revisores'
    return None
