from pathlib import Path
import json,hashlib,zipfile
ROOT=Path(r'C:\Users\plata\Documents\Codex\Helena-HUB')
CAP=ROOT/'artifacts/checkpoint-20261001'
DOCS=ROOT/'docs'
load=lambda n:json.loads((CAP/n).read_text(encoding='utf-8'))
v=load('verification.json')
m=load('manifest.json')
r=load('publication-receipt.json')
assert v['active']['id']=='CP-20261001-V034'
assert v['active_count']==1 and v['max_version']==34
assert v['active']['previous']=='CP-20260928-V033' and v['previous_status']=='SUPERADO'
assert v['active']['normalized_markdown_md5']==m['markdown_md5']
assert v['active']['agent_count']==21 and v['active']['skill_count']==45
assert v['current_job']['status']=='FAILED' and v['current_job']['attempts']==2 and v['current_job']['version']==3672
assert v['counts']==load('prepublication.json')['counts']
cmd_path=DOCS/'COMANDO-RETOMADA-HELENA-20261001.txt'
cmd=cmd_path.read_text(encoding='utf-8').replace('o checkpoint canônico publicado a partir de CP-20260928-V033','o checkpoint canônico CP-20261001-V034, publicado em 01/10/2026 12:38:46 de Brasília, com predecessor CP-20260928-V033')
cmd_path.write_text(cmd,encoding='utf-8',newline='\n')
receipt={'publication':r,'verification':v,'local_master_sha256':m['markdown_sha256'],'local_master_md5':m['markdown_md5'],'line_endings':'Supabase SQL Editor converteu LF em CRLF; conteúdo normalizado integralmente igual ao arquivo local.','model_calls_for_checkpoint':0,'paid_image_generations_for_checkpoint':0,'jobs_changed':False,'new_jobs':0,'authorization_expanded':False,'canonical_record':'public.checkpoint_mestre / CP-20261001-V034'}
(DOCS/'RECIBO-CHECKPOINT-MESTRE-20261001.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
readme='''# Continuidade do Sistema Helena — 01/10/2026

Checkpoint canônico **CP-20261001-V034**, versão 34, ATIVO no Supabase ecosistemadossonhos. Criado 01/10/2026 15:38:46 UTC (12:38:46 Brasília), com predecessor CP-20260928-V033 preservado SUPERADO. Conferidos uma versão ATIVA, maior versão, fontes/delta/snapshot preenchidos e conteúdo integral igual ao arquivo local após normalização de quebras de linha.

Para um novo chat, anexe CHECKPOINT-MESTRE-20261001.md e cole COMANDO-RETOMADA-HELENA-20261001.txt. O ZIP contém os documentos e anexos. Um novo chat com acesso ao Supabase deve começar por public.checkpoint_mestre_atual, pois uma versão posterior ou mudança operacional pode existir.

Arquivos:

- CHECKPOINT-MESTRE-20261001.md: documento completo, 25 seções, 21 contratos, regras, cronologia, fontes, copy protegida, divergências, pendências e próximos passos.
- COMANDO-RETOMADA-HELENA-20261001.txt: comando pronto para colar no novo chat.
- CHECKPOINT-MESTRE-20261001.snapshot.json: fotografia estruturada de fonte, papéis, inventário, regras e estados.
- BRIEFING-VIGENTE-HELENA-20261001.md: último briefing do job atual, preservado para consulta; tarefa esgotada, não é um novo despacho.
- SKILLS-HELENA-20261001.json: inventário dos 45 registros; inclui conteúdo integral das 21 skills de função e referências das 24 anteriores.
- RECIBO-CHECKPOINT-MESTRE-20261001.json: confirmação de publicação e integridade.

Estado que precisa ser preservado: JOB-HR-fd62fc9a1659086444127a218432d958 FAILED/RENDERER_PREFLIGHT_UNVERIFIED 2/2, tarefa BLOQUEADA versão 3672. Quatro v1 reprovados; nenhum v2. Finalizador corrigido depois, com teste técnico, ainda sem nova entrega aprovada. Sucessora vinculada após esgotamento proposta e não autorizada. Uso apenas interno, sem link, publicação ou envio externo. Não resetar tentativas nem duplicar campanha.

Esta criação de checkpoint não executou modelo, gerou imagem, alterou tarefa, criou job ou ampliou permissão. A atualização substituiu somente o apontador de continuidade por nova versão, preservando todas as anteriores.
'''
(DOCS/'LEIA-PRIMEIRO-CONTINUIDADE-HELENA-20261001.md').write_text(readme,encoding='utf-8',newline='\n')
files=[DOCS/x for x in ['LEIA-PRIMEIRO-CONTINUIDADE-HELENA-20261001.md','CHECKPOINT-MESTRE-20261001.md','COMANDO-RETOMADA-HELENA-20261001.txt','CHECKPOINT-MESTRE-20261001.snapshot.json','BRIEFING-VIGENTE-HELENA-20261001.md','SKILLS-HELENA-20261001.json','RECIBO-CHECKPOINT-MESTRE-20261001.json']]
m['publication']=r
m['verification']=v
m['files']=[{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in files]
(CAP/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
with zipfile.ZipFile(DOCS/'CONTINUIDADE-HELENA-20261001.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in files:z.write(p,p.name)
    z.write(CAP/'manifest.json','manifest.json')
print(json.dumps({'checkpoint':'CP-20261001-V034','integrity':'PASS','previous_preserved':True,'operational_state_unchanged':True,'bundle_files':len(files)+1,'zip_bytes':(DOCS/'CONTINUIDADE-HELENA-20261001.zip').stat().st_size}))
