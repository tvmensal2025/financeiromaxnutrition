"""Valida as especificacoes da Helena v2 antes de qualquer uso (fichas validadas, plano secao 6).

Uso: python validar.py   -> sai com codigo 1 e lista cada problema se algo nao fecha.
Confere: formato de cada ficha, coerencia entre fichas, entregas e roteiros, e regras de ouro
(revisor nunca e o autor, toda entrega tem quem produz e quem revisa, dependencias sem ciclo).
"""
import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent
ESPECIAIS = {'CODIGO', 'FUNDADOR'}


def carregar():
    agentes = {}
    for f in sorted((ROOT / 'agents').glob('*.yaml')):
        a = yaml.safe_load(f.read_text(encoding='utf-8'))
        agentes[a['id']] = {**a, '_arquivo': f.name}
    entregas = yaml.safe_load((ROOT / 'deliverables' / 'entregas.yaml').read_text(encoding='utf-8'))
    roteiros = {f.name: yaml.safe_load(f.read_text(encoding='utf-8')) for f in sorted((ROOT / 'playbooks').glob('*.yaml'))}
    return agentes, entregas, roteiros


def validar(agentes, entregas, roteiros):
    erros = []
    schema = Draft202012Validator(json.loads((ROOT / 'schemas' / 'agent.schema.json').read_text(encoding='utf-8')))
    for aid, a in agentes.items():
        ficha = {k: v for k, v in a.items() if not k.startswith('_')}
        for e in schema.iter_errors(ficha):
            erros.append(f"{a['_arquivo']}: {'/'.join(map(str, e.path)) or '(raiz)'}: {e.message}")
        for t in a.get('produz', []) + a.get('revisa', []):
            if t not in entregas and t != 'card':
                erros.append(f"{a['_arquivo']}: tipo de entrega '{t}' nao existe em deliverables/entregas.yaml")
        if a.get('revisor') == aid:
            erros.append(f"{a['_arquivo']}: revisor e o proprio agente")
        if a.get('revisor') not in agentes and a.get('revisor') not in ESPECIAIS:
            erros.append(f"{a['_arquivo']}: revisor {a.get('revisor')} nao existe")
        rev = agentes.get(a.get('revisor'))
        if rev:
            sem_revisao = [t for t in a.get('produz', []) if t not in rev.get('revisa', []) and t not in ('card', 'plano')]
            if sem_revisao:
                erros.append(f"{a['_arquivo']}: revisor {rev['nome']} nao tem 'revisa' para {sem_revisao}")
        if set(a.get('revisa', [])) & set(a.get('produz', [])):
            erros.append(f"{a['_arquivo']}: revisa um tipo que ele mesmo produz {sorted(set(a['revisa']) & set(a['produz']))}")
    for t, m in entregas.items():
        if not any(t in a.get('produz', []) for a in agentes.values()):
            erros.append(f"entregas.yaml: '{t}' nao tem nenhum agente que produza")
        if not m.get('aprovacao'):
            erros.append(f"entregas.yaml: '{t}' sem roteiro de aprovacao")
    for nome, r in roteiros.items():
        ids = {e['id'] for e in r['etapas']}
        for e in r['etapas']:
            resp = agentes.get(e['responsavel'])
            if not resp:
                erros.append(f"{nome}: {e['id']} responsavel {e['responsavel']} nao existe")
            elif e['entrega'] not in resp.get('produz', []):
                erros.append(f"{nome}: {e['id']} {resp['nome']} nao produz '{e['entrega']}'")
            for dep in e.get('depende_de', []):
                if dep not in ids:
                    erros.append(f"{nome}: {e['id']} depende de {dep}, que nao existe")
        erros += ciclos(nome, r['etapas'])
        dossies = sum(1 for e in r['etapas'] if e['entrega'] == 'dossie')
        if dossies > r.get('cota_pesquisa', 0):
            erros.append(f"{nome}: {dossies} dossies excede a cota de pesquisa {r.get('cota_pesquisa', 0)}")
    return erros


def ciclos(nome, etapas):
    grafo = {e['id']: e.get('depende_de', []) for e in etapas}
    visitando, feito, erros = set(), set(), []

    def visita(n, caminho):
        if n in visitando:
            erros.append(f"{nome}: ciclo de dependencia {' -> '.join(caminho + [n])}")
            return
        if n in feito:
            return
        visitando.add(n)
        for d in grafo.get(n, []):
            visita(d, caminho + [n])
        visitando.discard(n)
        feito.add(n)

    for n in grafo:
        visita(n, [])
    return erros


if __name__ == '__main__':
    problemas = validar(*carregar())
    for p in problemas:
        print('ERRO', p)
    print('OK: especificacoes coerentes' if not problemas else f'{len(problemas)} problema(s)')
    sys.exit(1 if problemas else 0)
