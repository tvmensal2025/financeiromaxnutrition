"""Valida as especificacoes da Helena v3 antes de qualquer uso.

Uso: python validar.py   -> sai com codigo 1 e lista cada problema se algo nao fecha.
Cada checagem fecha um furo encontrado na revisao adversarial (ver docs/PLANO-HELENA-V3.md, secao 4).
"""
import json
import math
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent
ESPECIAIS = {'CODIGO', 'FUNDADOR'}
NAO_ENTREGA = {'card'}                       # card e o recipiente, nao um tipo de entrega
JULGAMENTO = {'parecer'}                     # tipos que julgam entregas anteriores
EFEITO_COLATERAL = {'registrar_lancamento', 'gerar_imagem'}
WEB = {'web_search', 'web_extract'}


def schema(nome):
    return Draft202012Validator(json.loads((ROOT / 'schemas' / f'{nome}.schema.json').read_text(encoding='utf-8')))


def carregar(erros):
    agentes = {}
    for f in sorted((ROOT / 'agents').glob('*.yaml')):
        try:
            a = yaml.safe_load(f.read_text(encoding='utf-8')) or {}
        except yaml.YAMLError as e:
            erros.append(f'{f.name}: YAML invalido: {e}')
            continue
        aid = a.get('id')
        if not aid:
            erros.append(f'{f.name}: sem id')
            continue
        if aid in agentes:
            erros.append(f"{f.name}: id {aid} duplicado com {agentes[aid]['_arquivo']}")
            continue
        agentes[aid] = {**a, '_arquivo': f.name}
    entregas = yaml.safe_load((ROOT / 'deliverables' / 'entregas.yaml').read_text(encoding='utf-8'))
    modelos = yaml.safe_load((ROOT / 'models.yaml').read_text(encoding='utf-8'))
    roteiros = {f.name: yaml.safe_load(f.read_text(encoding='utf-8')) for f in sorted((ROOT / 'playbooks').glob('*.yaml'))}
    return agentes, entregas, modelos, roteiros


def validar_agentes(agentes, entregas, modelos, erros):
    sch = schema('agent')
    for aid, a in agentes.items():
        arq = a['_arquivo']
        for e in sch.iter_errors({k: v for k, v in a.items() if not k.startswith('_')}):
            erros.append(f"{arq}: {'/'.join(map(str, e.path)) or '(raiz)'}: {e.message}")
        for t in a.get('produz', []) + a.get('revisa', []):
            if t not in entregas and t not in NAO_ENTREGA:
                erros.append(f"{arq}: tipo de entrega '{t}' nao existe")
        if a.get('modelo') not in modelos:
            erros.append(f"{arq}: apelido de modelo '{a.get('modelo')}' nao existe em models.yaml")
        rev_id = a.get('revisor')
        if rev_id == aid:
            erros.append(f'{arq}: revisor e o proprio agente')
        elif rev_id not in agentes and rev_id not in ESPECIAIS:
            erros.append(f'{arq}: revisor {rev_id} nao existe')
        rev = agentes.get(rev_id)
        if rev:
            faltam = [t for t in a.get('produz', []) if t not in rev.get('revisa', []) and t not in NAO_ENTREGA | {'plano'}]
            if faltam:
                erros.append(f"{arq}: revisor {rev['nome']} nao tem 'revisa' para {faltam}")
        if set(a.get('revisa', [])) & set(a.get('produz', [])):
            erros.append(f"{arq}: revisa tipo que ele mesmo produz {sorted(set(a['revisa']) & set(a['produz']))}")
        # Orcamento possivel: cada busca e extracao gasta passo (furo 7).
        for chave in ('orcamento', 'orcamento_revisao'):
            o = a.get(chave) or {}
            if o and o.get('passos', 0) < o.get('buscas', 0) + math.ceil(o.get('buscas', 0) / 2) + 4:
                erros.append(f"{arq}: {chave} impossivel: passos {o.get('passos')} < buscas {o.get('buscas')} + extracoes + 4")
        # Web + efeito colateral no mesmo agente abre injecao de prompt com escrita (furo 29).
        ferr = set(a.get('ferramentas', []))
        if ferr & WEB and ferr & EFEITO_COLATERAL:
            erros.append(f'{arq}: ferramenta web junto com ferramenta de efeito colateral {sorted(ferr & EFEITO_COLATERAL)}')
    for t, m in entregas.items():
        if not any(t in a.get('produz', []) for a in agentes.values()):
            erros.append(f"entregas.yaml: '{t}' sem agente que produza")
        if not m.get('aprovacao'):
            erros.append(f"entregas.yaml: '{t}' sem roteiro de aprovacao")


def validar_roteiros(agentes, entregas, roteiros, erros):
    sch = schema('playbook')
    for nome, r in roteiros.items():
        for e in sch.iter_errors(r):
            erros.append(f"{nome}: {'/'.join(map(str, e.path)) or '(raiz)'}: {e.message}")
        etapas = {e['id']: e for e in r.get('etapas', [])}
        externas = set((r.get('entradas_externas') or {}).keys())
        for e in etapas.values():
            resp = agentes.get(e['responsavel'])
            if not resp:
                erros.append(f"{nome}: {e['id']} responsavel {e['responsavel']} nao existe")
                continue
            if e['entrega'] not in resp.get('produz', []):
                erros.append(f"{nome}: {e['id']} {resp['nome']} nao produz '{e['entrega']}'")
            for dep in e.get('depende_de', []):
                if dep not in etapas:
                    erros.append(f"{nome}: {e['id']} depende de {dep}, que nao existe")
            for ent in e.get('entradas', []):
                if ent not in etapas and ent not in externas:
                    erros.append(f"{nome}: {e['id']} entrada '{ent}' nao e etapa nem entrada externa")
                if ent in etapas and ent not in e.get('depende_de', []):
                    erros.append(f"{nome}: {e['id']} usa {ent} como entrada sem depender dela")
            # Quem revisou uma entrega nao pode julga-la depois (furo 1).
            if e['entrega'] in JULGAMENTO:
                for ent in e.get('entradas', []):
                    alvo = etapas.get(ent)
                    if alvo and agentes.get(alvo['responsavel'], {}).get('revisor') == e['responsavel']:
                        erros.append(f"{nome}: {e['id']} {resp['nome']} julga {ent}, que ela/ele mesmo revisou")
            # Parecer precisa de caminho para cada semaforo (furo 2).
            if e['entrega'] in JULGAMENTO:
                ss = e.get('se_semaforo') or {}
                for s in ('AJUSTE', 'NAO_PODE'):
                    if s not in ss:
                        erros.append(f'{nome}: {e["id"]} parecer sem caminho para semaforo {s}')
                aj = ss.get('AJUSTE') or {}
                for alvo in aj.get('refazer', []):
                    if alvo not in e.get('entradas', []):
                        erros.append(f"{nome}: {e['id']} AJUSTE refaz {alvo}, que nao e entrada do parecer")
                if aj and aj.get('reconferir_por') != e['responsavel']:
                    erros.append(f"{nome}: {e['id']} AJUSTE deve ser reconferido por quem julgou")
        erros += ciclos(nome, etapas)
        # Cota de pesquisa em buscas, somando todos os agentes (furo 9).
        buscas = sum(agentes.get(e['responsavel'], {}).get('orcamento', {}).get('buscas', 0) for e in etapas.values())
        if buscas > r.get('orcamento_meta', {}).get('buscas', 0) * 3:
            erros.append(f"{nome}: teto de buscas das etapas ({buscas}) incompativel com orcamento_meta (motor corta em {r.get('orcamento_meta', {}).get('buscas')})")
        finais = [e for e in etapas.values() if e['entrega'] == 'relatorio_final']
        if len(finais) != 1:
            erros.append(f'{nome}: precisa de exatamente 1 etapa relatorio_final (tem {len(finais)})')
        elif set(finais[0].get('depende_de', [])) != set(etapas) - {finais[0]['id']}:
            erros.append(f"{nome}: relatorio_final deve depender de todas as outras etapas")


def ciclos(nome, etapas):
    grafo = {k: v.get('depende_de', []) for k, v in etapas.items()}
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


def main():
    erros = []
    agentes, entregas, modelos, roteiros = carregar(erros)
    validar_agentes(agentes, entregas, modelos, erros)
    validar_roteiros(agentes, entregas, roteiros, erros)
    for p in erros:
        print('ERRO', p)
    print('OK: especificacoes coerentes' if not erros else f'{len(erros)} problema(s)')
    return 1 if erros else 0


if __name__ == '__main__':
    sys.exit(main())
