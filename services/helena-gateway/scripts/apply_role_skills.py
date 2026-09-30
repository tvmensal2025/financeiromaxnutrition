"""Install owned role skills and apply their procedures without granting tools."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import yaml

START = '## Procedimento profissional de funcao Helena v1'
END = '<!-- fim-procedimento-profissional-funcao-helena-v1 -->'

def digest(data): return hashlib.sha256(data).hexdigest()

def safe(path, root):
    if any(p.is_symlink() for p in [path,*path.parents] if p.is_relative_to(root)) or not path.resolve().is_relative_to(root):
        raise ValueError('UNSAFE_PATH')

def inventory(profile):
    config = yaml.safe_load((profile/'config.yaml').read_text()) or {}
    settings = config.get('skills') or {}
    if not isinstance(settings,dict): raise ValueError('UNKNOWN_SKILLS_CONFIG')
    disabled = settings.get('disabled') or []
    platform_disabled = settings.get('platform_disabled') or {}
    if not isinstance(disabled,list) or not isinstance(platform_disabled,dict): raise ValueError('UNKNOWN_DISABLED_CONFIG')
    rows = []
    for path in sorted((profile/'skills').rglob('SKILL.md')):
        safe(path,profile)
        content = path.read_text(encoding='utf-8')
        parts = content.split('---',2)
        meta = yaml.safe_load(parts[1]) if len(parts)==3 and parts[0].strip()=='' else {}
        meta = meta if isinstance(meta,dict) else {}
        name = meta.get('name') or path.parent.name
        disabled_platforms = sorted(k for k,v in platform_disabled.items() if isinstance(v,list) and name in v)
        enabled = name not in disabled and not (path.parent/'.disabled').exists()
        rows.append({'name':name,'path':str(path),'sha256':digest(path.read_bytes()),'enabled_in_config':enabled,'disabled_platforms':disabled_platforms,'frontmatter_valid':bool(meta.get('name') and meta.get('description'))})
    return rows

def run(home, package_path, apply=False):
    home=home.resolve(strict=True); package=json.loads(package_path.read_text(encoding='utf-8'))
    agents=package['agents']
    if len(agents)!=21 or len({a['profile_slug'] for a in agents})!=21: raise ValueError('EXPECTED_21_UNIQUE_PROFILES')
    manifest_path=home/'helena-runtime'/'quality-manifest.json'
    manifest=json.loads(manifest_path.read_text())
    original_manifest=manifest_path.read_bytes()
    plans=[]; before=[]
    for agent in agents:
        profile=home/'profiles'/agent['profile_slug']; safe(profile,home)
        if not re.fullmatch(r'helena-role-agt-\d{2}',agent['name']): raise ValueError('INVALID_SKILL_NAME')
        soul_path=profile/'SOUL.md'; safe(soul_path,home)
        soul=soul_path.read_text(encoding='utf-8')
        if digest(soul_path.read_bytes())!=manifest['soul_hashes'].get(agent['profile_slug']): raise ValueError('SOUL_CHANGED_SINCE_VALIDATION')
        skills=inventory(profile); before.append({'profile':agent['profile_slug'],'skills':skills})
        if any(s['name']==agent['name'] and (not s['enabled_in_config'] or s['disabled_platforms']) for s in skills): raise ValueError('OWNED_SKILL_DISABLED')
        block=START+'\n'+agent['body']+'\n'+END
        if (START in soul)!=(END in soul) or soul.count(START)>1 or soul.count(END)>1: raise ValueError('PARTIAL_SOUL_BLOCK')
        updated=soul[:soul.index(START)]+block+soul[soul.index(END)+len(END):] if START in soul else soul.rstrip()+'\n\n'+block+'\n'
        skill_path=profile/'skills'/agent['name']/'SKILL.md'; safe(skill_path,home)
        if skill_path.exists() and skill_path.read_text(encoding='utf-8')!=agent['content']: raise ValueError('EXISTING_SKILL_DIVERGENCE')
        plans.extend([(soul_path,updated.encode('utf-8')),(skill_path,agent['content'].encode('utf-8'))])
    changed=[(p,data) for p,data in plans if not p.exists() or p.read_bytes()!=data]
    if not apply: print(json.dumps({'status':'PREFLIGHT','profiles':21,'pending_files':len(changed),'ai_calls':0})); return
    if not changed:
        # Keep the receipt and its real rollback location on a repeated apply.
        print(json.dumps({'status':'UNCHANGED','profiles':21,'changed_files':0,'ai_calls':0}))
        return
    backup=home/'helena-runtime'/('role-skills-backup-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    originals=[]
    try:
        for path,data in changed:
            saved=backup/path.relative_to(home) if path.exists() else None
            if saved: saved.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(path,saved)
            originals.append((path,saved)); path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
            if path.read_bytes()!=data: raise ValueError('WRITE_VERIFICATION_FAILED')
        manifest['soul_hashes']={a['profile_slug']:digest((home/'profiles'/a['profile_slug']/'SOUL.md').read_bytes()) for a in agents}
        manifest['role_skills_version']=package['version']
        manifest_path.write_text(json.dumps(manifest,indent=2))
        after=[{'profile':a['profile_slug'],'agent_id':a['agent_id'],'skills':inventory(home/'profiles'/a['profile_slug'])} for a in agents]
        installed=sum(any(s['name']==a['name'] and s['enabled_in_config'] and s['sha256']==digest(a['content'].encode('utf-8')) for s in row['skills']) for a,row in zip(agents,after))
        if installed!=21: raise ValueError('POST_INSTALL_MISMATCH')
        receipt={'observed_at':datetime.now(timezone.utc).isoformat(),'version':package['version'],'profiles':21,'role_skills_verified':installed,'skill_files_total':sum(len(r['skills']) for r in after),'ai_calls':0,'real_business_tasks_tested':False,'backup':str(backup),'changed_files':len(changed),'activation':'PROFILE_SOUL_PROCEDURE_AND_NATIVE_SKILL','before':before,'after':after,'sources':package['sources']}
        (home/'helena-runtime'/'role-skills-manifest.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
    except Exception:
        for path,saved in reversed(originals):
            if saved: shutil.copy2(saved,path)
            else: path.unlink(missing_ok=True)
        manifest_path.write_bytes(original_manifest)
        raise
    print(json.dumps({k:receipt[k] for k in ['version','profiles','role_skills_verified','skill_files_total','ai_calls','backup','activation','changed_files']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--home',type=Path,default=Path('/data')); parser.add_argument('--package',type=Path,required=True); parser.add_argument('--apply',action='store_true')
    args=parser.parse_args(); run(args.home,args.package,args.apply)
