"""Deploy the bounded runtime and narrow specialist tool visibility; no model calls."""
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import yaml
from configurar_perfis import PROFILES, profile_tools, URL


def install(home):
    source=Path(__file__).resolve().parent
    runtime=home/'helena-runtime'
    plans=[]
    for name in ('hermes_dispatch_once.py','hermes_workflow_tick.py','hermes_mcp_preflight.py',
                 'hermes_execution_context.py'):
        text=(source/name).read_text(encoding='utf-8'); ast.parse(text)
        plans.append((runtime/name,text.encode('utf-8')))
    changed_profiles=[]
    for profile in PROFILES:
        path=home/'profiles'/profile/'config.yaml'
        if path.is_symlink() or not path.resolve().is_relative_to(home.resolve()):
            raise ValueError('Unexpected config path')
        config=yaml.safe_load(path.read_text())
        server=config['mcp_servers']['helena_operacao']
        if server.get('url')!=URL or server.get('enabled') is not True:
            raise ValueError('Connector configuration diverged')
        before=server['tools']['include']; expected=profile_tools(profile)
        if set(expected)-set(before):
            raise ValueError('Missing required tool; refusing to expand permissions')
        if set(before)!=set(expected):
            server['tools']['include']=expected
            plans.append((path,yaml.safe_dump(config,allow_unicode=True,sort_keys=False).encode('utf-8')))
            changed_profiles.append(profile)
    backup=runtime/('authorization-backup-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700)
    saved=[]
    try:
        for path,data in plans:
            old=path.read_bytes() if path.exists() else None
            if old==data:continue
            if old is not None:
                copy=backup/path.relative_to(home);copy.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(path,copy)
            saved.append((path,old))
            temp=path.with_suffix('.authorization-tmp')
            with temp.open('xb') as f:os.chmod(temp,0o600);f.write(data)
            temp.replace(path)
    except Exception:
        for path,old in reversed(saved):
            if old is None:path.unlink(missing_ok=True)
            else:path.write_bytes(old)
        raise
    result={'status':'INSTALLED','profiles_checked':len(PROFILES),'profiles_narrowed':len(changed_profiles),
            'backup':str(backup),'model_calls':0,'credential_files_changed':False,'schedule_changed':False,
            'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p,_ in plans if p.parent==runtime}}
    (runtime/'authorization-install-receipt.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))

if __name__=='__main__':
    import fcntl
    with Path('/data/helena-runtime/dispatcher.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        install(Path('/data'))
