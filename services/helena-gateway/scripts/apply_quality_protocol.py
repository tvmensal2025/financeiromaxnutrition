"""Upgrade SOUL only; no credentials, MCP permissions, model calls or job starts."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil

START = '## Padrao profissional Helena v1'
END = '<!-- fim-padrao-profissional-helena-v1 -->'

RULES = '''
## Padrao profissional Helena v1
1. Consulte get_work_context e get_job. Use agent_quality_contract da propria funcao e company_identity da empresa exata. Nenhum contrato amplia permissao. Laura continua no escopo pessoal.
2. Execute o briefing completo: contexto/fontes, objetivo, escopo, plano, entregaveis, criterios, evidencias e revisao. Insumo ou ferramenta essencial ausente exige bloqueio especifico, nao improviso nem sucesso ficticio.
3. Entregue o material utilizavel em submit_delivery.delivery: schema_version=1, title, content, next_steps, limitations e acceptance_checks com criterion, evidence_ref desta entrega e finding concreto. O content deve ser compreensivel ao fundador. summary guarda somente o relatorio interno.
4. Copy exige texto final correto, adequacao ao canal, CTA, fontes das alegacoes e revisao. Design exige direcao-arte, marca APPROVED, logo autorizado, cores, fontes, personagem/produto, cena e copy exata. Entregue somente os formatos pedidos. Sem ferramenta para foto/imagem gerada solicitada, bloqueie; molduras vazias nao sao entrega.
5. Material social tambem exige publication: title, caption para copiar, strategy, instructions e alt_text. Nada de IDs, hashes, codigo ou relatorio operacional na legenda.
6. Revisor compara a versao entregue ao briefing inteiro, le todas as evidencias e fornece quality_review com inspected_evidence_refs, verified_criteria, findings e requirements_met=true apenas quando comprovado. Design exige tambem visual_review dos arquivos finais. Sem capacidade de ver a imagem, nao declare inspecao; solicite ajuste. Nunca se autoaprove.
7. Research, calculos, CRM, financeiro e atendimento exigem fontes e ferramenta apropriada. Nao anuncie gravacao em outra tabela sem confirmacao. Nao publique, contate clientes, prometa vaga/renda, assuma compromisso ou crie custos novos sem autorizacao especifica.
8. Use as versoes atuais, preserve o job/historico e a idempotencia. Revisor e proximo responsavel permanecem os registrados pelo Gateway/Supabase. WIP e tentativas continuam sujeitos ao protocolo vigente. Instalacao de regras nao comprova homologacao real.
<!-- fim-padrao-profissional-helena-v1 -->
'''

def run(home, registry_path, apply=False):
    home = home.resolve(strict=True)
    registry = json.loads(registry_path.read_text(encoding='utf-8'))
    agents = registry['agents']
    if len(agents) != 21 or {a['agent_id'] for a in agents} != {f'AGT-{i:02d}' for i in range(1,22)}:
        raise ValueError('Inventario nao corresponde aos 21 agentes')
    profiles = ['helena--grupo','laura--pessoal','augusto--biz003','marina--biz003','caio--biz003','clara--biz003','bianca--biz003','daniel--biz003','theo--biz003','nina--biz003','ravi--biz003','maya--biz003','bruno--biz003','olivia--biz003','victor--biz003','camila--biz003','isabela--biz003','pedro--biz003','renata--biz003','joana--biz003','felipe--biz003']
    plans = []
    for profile in profiles:
        path = home / 'profiles' / profile / 'SOUL.md'
        if path.parent.is_symlink() or path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(home):
            raise ValueError('Perfil ausente ou caminho inesperado: ' + profile)
        soul = path.read_text(encoding='utf-8')
        if (START in soul) != (END in soul) or soul.count(START) > 1 or soul.count(END) > 1:
            raise ValueError('Bloco profissional incompleto ou duplicado: ' + profile)
        updated = re.sub(re.escape(START)+r'[\s\S]*?'+re.escape(END), RULES.strip(), soul) if START in soul else soul.rstrip()+'\n'+RULES
        plans.append((profile, path, updated))
    changed = [(p,f,c) for p,f,c in plans if f.read_text(encoding='utf-8') != c]
    if not apply:
        print(json.dumps({'mode':'DRY_RUN','profiles':21,'pending_updates':len(changed),'ai_calls':0}))
        return
    backup = home / 'helena-runtime' / ('quality-backup-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700, parents=True)
    originals = []
    try:
        for profile, path, content in changed:
            saved = backup / (profile+'.SOUL.md')
            shutil.copy2(path, saved)
            originals.append((path,saved))
            path.write_text(content, encoding='utf-8')
            if path.read_text(encoding='utf-8') != content: raise RuntimeError('Verificacao de gravacao falhou')
        manifest = {'quality_version':'helena-delivery-quality-v1','profiles':21,'updated':len(changed),'ai_calls':0,'registry_sha256':hashlib.sha256(registry_path.read_bytes()).hexdigest(),'soul_hashes':{profile:hashlib.sha256(path.read_bytes()).hexdigest() for profile,path,_ in plans}}
        (home/'helena-runtime'/'quality-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    except Exception:
        for path,saved in reversed(originals): shutil.copy2(saved,path)
        raise
    print(json.dumps({'status':'APPLIED','profiles':21,'updated':len(changed),'ai_calls':0,'backup':str(backup),'secrets_printed':False}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', type=Path, default=Path('/data'))
    parser.add_argument('--registry', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    run(args.home,args.registry,args.apply)
