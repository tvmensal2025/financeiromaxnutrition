#!/usr/bin/env python3
"""Prepara os arquivos gerados por `gerar-instalacao` para o transporte: tira begin;/commit; e gera JSON + manifesto."""
import hashlib, json, pathlib, re, sys
origem, saida = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); saida.mkdir(parents=True, exist_ok=True)
def sem_transacao(txt):
    txt = re.sub(r'^(\s*--[^\n]*\n)*\s*begin;\s*\n', lambda m: ''.join(l for l in m.group(0).splitlines(True) if l.strip().startswith('--')), txt, count=1, flags=re.S)
    return re.sub(r'\n\s*commit;\s*$', '\n', txt)
manifesto = {}
for nome, alvo in (('01_instalar_v2.sql', '01'), ('02_base_tecnica.sql', '02')):
    t = sem_transacao((origem / nome).read_text(encoding='utf-8'))
    (saida / f'{alvo}.sql').write_text(t, encoding='utf-8')
    (saida / f'{alvo}.json').write_text(json.dumps({'arquivo': alvo, 'parte': 0, 'conteudo': t}), encoding='utf-8')
    manifesto[alvo] = {'bytes': len(t.encode('utf-8')), 'sha256': hashlib.sha256(t.encode('utf-8')).hexdigest()}
(saida / 'manifesto.json').write_text(json.dumps(manifesto, indent=1))
print(json.dumps(manifesto, indent=1))
